import { CONFIG } from './config';
import { SKILL, TPL, type SkillId } from './content';
import { bugsFor } from './pools';
import { formOk, parseAnswer, typedText } from './parse';
import { chooseFocus, mixSkillsFor, RANK, replaySkill } from './learner';
import { issue } from './issue';
import { emit, flame, pieces, unlockPiece, xpTotal, type PieceUnlock } from './bus';
import { buildFrame } from './feedback';
import { badgesView, clientView, fuel, homeView, inspect, publicItem, reviewUsedThisWeek, stepLabel } from './views';
import { makeCtx, type Attempt, type Band, type Lane, type QEvent, type Session, type State } from './state';
import { eqR } from './util/rational';

/* The "server": the only place the engine is driven from. It reads and appends to the
   state arrays; in the hosted app those arrays become tables, written in one transaction
   per call (HANDOFF §3). Item payloads never carry answers. */
export function createServer(state: State, clock?: () => number) {
  const ctx = makeCtx(state, clock);
  const S = state;

  function startSession(lane?: Lane) {
    lane = lane || 'recommended';
    if (lane === 'review' && reviewUsedThisWeek(ctx) >= CONFIG.REVIEW_PER_WEEK) lane = 'recommended';
    // an abandoned session simply ends; nothing is minted for it
    S.sessions.filter(s => !s.endedAt).forEach(s => { s.endedAt = ctx.now(); s.abandoned = true; });
    const focus = chooseFocus(S); const mixCount = CONFIG.MIX_SLOTS.filter(x => x <= CONFIG.SESSION_ITEMS).length;
    const mix = mixSkillsFor(S, focus, mixCount); let mi = 0;
    // the plan is frozen at creation (Arch §31a addendum 3)
    const plan: SkillId[] = []; for (let i = 1; i <= CONFIG.SESSION_ITEMS; i++) plan.push(CONFIG.MIX_SLOTS.includes(i) && mix.length ? mix[mi++ % mix.length] : focus);
    const st = replaySkill(S, focus);
    const session: Session = { id: ctx.nextId('ss'), focus, lane, plan, cursor: 0, startedAt: ctx.now(), endedAt: null, lastTpl: null, attempted: 0, bandAtStart: st.band, stepAtStart: st.step,
                               xpAtStart: xpTotal(S), piecesAtStart: pieces(S).total, leveledUp: false, currentIid: null };
    S.sessions.push(session);
    return { sessionId: session.id, focus: SKILL[focus].name, lane, total: plan.length };
  }
  const getSession = (id: string) => S.sessions.find(s => s.id === id);

  function nextItem(sessionId: string) {
    const s = getSession(sessionId); if (!s || s.endedAt) return { done: true as const };
    if (s.currentIid) { const it = S.issued.find(i => i.iid === s.currentIid); if (it && !S.attempts.some(a => a.iid === it.iid)) return publicItem(it, s); }
    if (s.cursor >= s.plan.length) return { done: true as const };
    const slotSkill = s.plan[s.cursor]; const lane: Lane = slotSkill === s.focus ? s.lane : (s.lane === 'review' ? 'review' : 'recommended');
    const it = issue(ctx, s, slotSkill, lane); s.cursor++; s.currentIid = it.iid;
    return publicItem(it, s);
  }

  function submit(iid: string, raw: unknown, latencyMs?: number): any {
    const prior = S.attempts.find(a => a.iid === iid); if (prior) return prior.response;     // same-key replay: original result, no new mint
    const it = S.issued.find(i => i.iid === iid); if (!it) return { error: 'unknown-item' };
    const s = getSession(it.sessionId); const tp = TPL[it.tpl];
    const pa = parseAnswer(raw, tp.kind);
    if (!pa.ok) {                                                                           // a format reject is not an attempt
      S.rejects.push({ iid, tpl: it.tpl, ver: it.ver, kind: tp.kind, reason: pa.reason, at: ctx.now() });
      return { kind: 'format_rejected', hint: tp.kind === 'whole' ? `Use numbers only, like ${it.formatExample}.` : `Write it as a fraction, like ${it.formatExample}.` };
    }
    const ans = tp.ans(it.p); const rt = Math.max(0, Math.min(CONFIG.RT_CAP_MS, Math.round(latencyMs || 0)));
    let outcome: Attempt['outcome'], bug: string | null = null;
    if (eqR(pa.value, ans)) outcome = formOk(pa, tp.form) ? 'correct' : 'form_mismatch';
    else { outcome = 'wrong'; const m = bugsFor(tp, it.p).find(b => eqR(b.v, pa.value)); bug = m ? m.tag : null; }
    const correct = outcome === 'correct';

    // integrity: too fast, or the same wrong answer typed into three different items in a row
    const lastTwo = S.attempts.slice(-2);
    const spam = !correct && lastTwo.length === 2 && lastTwo.every(a => !a.correct && a.typed === typedText(pa));
    const honest = rt >= CONFIG.MIN_LATENCY_MS && !spam;
    const countsForBand = honest && it.evidenceEligible && it.lane !== 'review';

    const before = replaySkill(S, it.skill);
    const att: Attempt = { iid, skill: it.skill, tpl: it.tpl, ver: it.ver, step: it.step, lane: it.lane, sessionId: it.sessionId, outcome, bug, correct, typed: typedText(pa),
                           rtMs: rt, fastGuess: rt < CONFIG.FAST_GUESS_MS, honest, countsForBand, issueReason: it.issueReason, at: ctx.now(), day: ctx.today(), policy: CONFIG.POLICY_VERSION };
    S.attempts.push(att); if (s) { s.attempted++; s.currentIid = null; }
    const after = replaySkill(S, it.skill);

    // ----- mints: only through the bus -----
    const minted: QEvent[] = []; let xpNow = 0; let tier = 'none'; let flameLit = false;
    let piece: PieceUnlock | null = null, levelUp: { skill: string; step: number; stepLabel: string } | null = null, badge: string | null = null, bandUp: Band | null = null;
    if (honest) {
      const base = correct ? (it.lane === 'challenge' ? CONFIG.XP.challenge : CONFIG.XP.correct) : CONFIG.XP.effort;
      const xp = it.lane === 'review' ? Math.max(1, Math.round(base * CONFIG.REVIEW_XP_MULT)) : base;
      minted.push(emit(ctx, 'HonestAttempt', { iid, skill: it.skill, lane: it.lane, correct }, xp)); xpNow += xp;
      // QualifyingPracticeDay: K honest attempts today, at least one from Recommended or Challenge
      const todays = S.attempts.filter(a => a.honest && a.day === att.day);
      if (!S.events.some(e => e.type === 'QualifyingPracticeDay' && e.day === att.day) && todays.length >= CONFIG.QPD_K && todays.some(a => a.lane !== 'review')) {
        minted.push(emit(ctx, 'QualifyingPracticeDay', { lanes: todays.map(a => a.lane) }, 0)); flameLit = true;
        const f = flame(ctx); if (CONFIG.FLAME_MILESTONES.includes(f.count)) { const u = unlockPiece(ctx, 'flame-' + f.count, att.day); minted.push(u.ev); piece = u; }
      }
    }
    if (countsForBand) {
      // level-up only on a new max step (HANDOFF §4.7)
      if (after.levelUps.length > before.levelUps.length) {
        const lu = after.levelUps[after.levelUps.length - 1];
        minted.push(emit(ctx, 'LevelUpSlight', { skill: it.skill, toStep: lu.step }, CONFIG.XP.levelUp)); xpNow += CONFIG.XP.levelUp; levelUp = { skill: SKILL[it.skill].name, step: lu.step, stepLabel: stepLabel(lu.step) };
        if (s) s.leveledUp = true;
      }
      // band transitions mint only on the first reach of each band per skill (HANDOFF §4.8)
      if (RANK[after.band] > RANK[before.band] && !S.bandLog.some(b => b.skill === it.skill && b.to === after.band)) {
        S.bandLog.push({ skill: it.skill, from: before.band, to: after.band, at: ctx.now(), policy: CONFIG.POLICY_VERSION, iid });
        minted.push(emit(ctx, 'MasteryBandTransition', { skill: it.skill, from: before.band, to: after.band }, CONFIG.XP.band)); xpNow += CONFIG.XP.band; bandUp = after.band;
        const u = unlockPiece(ctx, 'band-' + after.band, it.skill); minted.push(u.ev); piece = u;
        if (after.band === 'Got it') { minted.push(emit(ctx, 'BadgeMilestone', { skill: it.skill }, 0)); badge = SKILL[it.skill].name; }
      }
    }
    // full celebration only when a band transition or level-up committed here; fails closed
    if (bandUp || levelUp) tier = 'full'; else if (xpNow > 0) tier = 'quietXp';

    const frame = buildFrame(tp, it.p, ans, outcome, att.typed, bug);
    const rewardLine: string[] = [];
    if (correct && xpNow > 0) rewardLine.push(`+${xpNow} XP`);
    if (correct && flameLit) rewardLine.push('Flame lit');
    if (correct && piece) rewardLine.push(piece.completedGoal ? `Warrior ${piece.completedGoal} complete` : `Piece ${pieces(S).have}/${CONFIG.PIECES_PER_GOAL}`);
    if (correct && badge) rewardLine.push(`Badge: ${badge}`);

    const response = { kind: 'scored', correct, outcome, frame, clientView: Object.assign(clientView(S, it.skill), { celebrationTier: tier }), skillName: SKILL[it.skill].name,
                       rewardLine: (correct && rewardLine.length) ? rewardLine : null, levelUp, fuel: fuel(ctx), mintedIds: minted.map(m => m.id), bandUp };
    att.response = response;
    return response;
  }

  function endSession(sessionId: string) {
    const s = getSession(sessionId); if (!s) return null;
    if (!s.endedAt) {
      s.endedAt = ctx.now();
      // ConceptProgressTick: late-third accuracy beats early-third on the focus skill
      const fa = S.attempts.filter(a => a.sessionId === s.id && a.skill === s.focus && a.countsForBand);
      if (fa.length >= CONFIG.TICK_MIN) {
        const k = Math.floor(fa.length / 3), acc = (xs: Attempt[]) => xs.filter(a => a.correct).length / xs.length;
        if (acc(fa.slice(-k)) - acc(fa.slice(0, k)) >= CONFIG.TICK_DELTA) { emit(ctx, 'ConceptProgressTick', { skill: s.focus, sessionId: s.id }, CONFIG.XP.tick); s.tick = true; }
      }
    }
    const atts = S.attempts.filter(a => a.sessionId === s.id && a.issueReason !== 'exhausted_repeat');
    const ms = atts.reduce((m, a) => m + Math.min(a.rtMs, CONFIG.RT_CAP_MS), 0);
    return { fuel: fuel(ctx), xpGained: xpTotal(S) - s.xpAtStart, piecesGained: pieces(S).total - s.piecesAtStart, tick: !!s.tick, focus: SKILL[s.focus].name,
             minutes: Math.floor(ms / 60000), questions: new Set(atts.map(a => a.iid)).size, completed: s.cursor >= s.plan.length && !s.currentIid };
  }

  return {
    homeView: () => homeView(ctx),
    badgesView: () => badgesView(ctx),
    startSession, nextItem, submit, endSession,
    inspect: () => inspect(ctx),
    fuel: () => fuel(ctx),
    now: ctx.now,
    _replay: (sid: SkillId) => replaySkill(S, sid),
    _state: S,
  };
}

export type Server = ReturnType<typeof createServer>;
