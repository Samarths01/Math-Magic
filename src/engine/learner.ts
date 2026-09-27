import { CONFIG } from './config';
import { SKILL, SKILLS, type SkillId, type Step } from './content';
import type { Attempt, Band, State } from './state';

/* Learner state: a pure replay of stored evidence under the current policy. */
export interface SkillState {
  step: Step;
  maxStep: Step;
  /** Every first reach of a new max step, in order. */
  levelUps: { iid: string; step: Step }[];
  win: Attempt[];
  band: Band;
  n: number;
}

export const RANK: Record<Band, number> = { 'Still learning': 0, 'Getting it': 1, 'Got it': 2 };

export function replaySkill(S: State, sid: SkillId): SkillState {
  let step = 1, maxStep = 1, run = 0, recent: boolean[] = [];
  const win: Attempt[] = [], levelUps: SkillState['levelUps'] = [];
  for (const a of S.attempts) {
    if (a.skill !== sid || !a.countsForBand) continue;
    win.push(a); if (win.length > CONFIG.BAND_WINDOW) win.shift();
    if (a.lane === 'review') continue;
    if (a.step >= step) run = a.correct ? run + 1 : 0;
    if (a.step === step) { recent.push(a.correct); if (recent.length > CONFIG.STEP_DOWN_WINDOW) recent.shift(); }
    if (run >= CONFIG.STEP_UP_RUN && step < 3) { step++; run = 0; recent = []; if (step > maxStep) { maxStep = step; levelUps.push({ iid: a.iid, step: step as Step }); } }
    else if (recent.filter(x => !x).length >= CONFIG.STEP_DOWN_MISSES && step > 1) { step--; run = 0; recent = []; }
  }
  return { step: step as Step, maxStep: maxStep as Step, levelUps, win, band: bandOf(win), n: win.length };
}

export function bandOf(win: Attempt[]): Band {
  const n = win.length; if (n < CONFIG.BAND_MIN) return 'Still learning';
  const acc = win.filter(a => a.correct).length / n;
  const lastRun = win.slice(-CONFIG.GOT_IT_RUN).every(a => a.correct);
  // Got it needs a correct step-2+ answer from Recommended or Challenge (§5 invariant 9)
  const stretch = win.some(a => a.correct && a.step >= 2 && a.lane !== 'review');
  // …and correct answers from more than one session, so one hot streak isn't mastery
  const sessions = new Set(win.filter(a => a.correct).map(a => a.sessionId)).size;
  if (n >= CONFIG.BAND_WINDOW && acc >= CONFIG.GOT_IT && lastRun && stretch && sessions >= CONFIG.GOT_IT_MIN_SESSIONS) return 'Got it';
  return acc >= CONFIG.GETTING_IT ? 'Getting it' : 'Still learning';
}

/* A skill is open if its grade is at or below the child's grade prior, if it has any
   attempts, or if every prerequisite is at Getting it or above (HANDOFF §4.6). */
export function unlocked(S: State, sid: SkillId): boolean {
  const sk = SKILL[sid];
  if (sk.grade <= S.child.grade) return true;
  if (S.attempts.some(a => a.skill === sid)) return true;
  return sk.prereq.every(p => RANK[replaySkill(S, p).band] >= 1);
}
export const unlockedSkills = (S: State): SkillId[] => SKILLS.filter(s => unlocked(S, s.id)).map(s => s.id);

/* Focus: the only skill chooser. */
export function chooseFocus(S: State): SkillId {
  if (S.dev.focusOverride && SKILL[S.dev.focusOverride]) return S.dev.focusOverride;
  const us = unlockedSkills(S);
  const last = S.sessions.filter(s => s.attempted > 0).slice(-1)[0];
  if (last && us.includes(last.focus)) {
    const cur = replaySkill(S, last.focus);
    const streak = [];
    for (let i = S.sessions.length - 1; i >= 0 && S.sessions[i].focus === last.focus; i--) if (S.sessions[i].attempted > 0) streak.push(S.sessions[i]);
    const moved = streak.length && RANK[cur.band] > RANK[streak[streak.length - 1].bandAtStart];
    if (cur.band !== 'Got it' && (streak.length < CONFIG.FOCUS_MAX_SESSIONS || moved)) return last.focus;
  }
  const recentFocus = S.sessions.slice(-3).map(s => s.focus);
  const scored = us.map((sid, i) => ({
    sid, i,
    r: RANK[replaySkill(S, sid).band],
    recent: recentFocus.includes(sid) ? 1 : 0,
    prereqGap: SKILL[sid].prereq.every(p => !us.includes(p) || RANK[replaySkill(S, p).band] >= 1) ? 0 : 1,
  }));
  scored.sort((a, b) => a.r - b.r || a.prereqGap - b.prereqGap || a.recent - b.recent || a.i - b.i);
  return scored[0].sid;
}

/** Interleaved skills for a session: least recently seen first. */
export function mixSkillsFor(S: State, focus: SkillId, count: number): SkillId[] {
  const us = unlockedSkills(S).filter(s => s !== focus);
  const lastSeen = (sid: SkillId) => { let t = -1; for (const it of S.issued) if (it.skill === sid && it.shownAt > t) t = it.shownAt; return t; };
  us.sort((a, b) => lastSeen(a) - lastSeen(b) || SKILLS.findIndex(s => s.id === a) - SKILLS.findIndex(s => s.id === b));
  const out: SkillId[] = []; for (let i = 0; i < count; i++) if (us.length) out.push(us[i % us.length]);
  return out;
}

export function laneOffer(S: State, focus: SkillId): boolean {
  if (S.dev.alwaysOfferLanes) return true;
  const b = replaySkill(S, focus).band; const last = S.sessions.slice(-1)[0];
  return b !== 'Still learning' || !!(last && last.leveledUp);
}
