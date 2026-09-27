import { CONFIG } from './config';
import { SKILL, SKILLS, TPL, TPL_BY_SKILL, type SkillId, type Step } from './content';
import { flame, pieces, qpdDays, xpTotal, type Flame } from './bus';
import { chooseFocus, laneOffer, replaySkill, unlocked } from './learner';
import { freshIn } from './issue';
import { pool } from './pools';
import type { Band, Ctx, IssuedItem, Session, State } from './state';
import { DAY } from './util/time';

/* Client-facing shapes. Nothing here may carry params, answers, provenance,
   evidence_eligible, issue_reason, raw confidence or percentages (§5 invariant 2). */

export function stepLabel(n: number): string { return ['', 'Easy', 'Medium', 'Hard'][n]; }

export interface Fuel { flame: Flame; xp: number; pieces: { have: number; per: number; goal: number } }

export function fuel(ctx: Ctx): Fuel {
  const f = flame(ctx), pc = pieces(ctx.S);
  return { flame: f, xp: xpTotal(ctx.S), pieces: { have: pc.justCompleted ? pc.per : pc.have, per: pc.per, goal: pc.justCompleted ? pc.goal - 1 : pc.goal } };
}

export interface ClientView { bandLabel: Band; showConceptChip: boolean }
export function clientView(S: State, sid: SkillId): ClientView {
  const st = replaySkill(S, sid);
  return { bandLabel: st.band, showConceptChip: st.n >= CONFIG.BAND_MIN };
}

export interface PublicItem {
  iid: string; skillId: SkillId; skillName: string; step: Step; lane: string; stem: string; layout: string;
  answerKind: string; formatExample: number | string | undefined; index: number; total: number;
}
export function publicItem(it: IssuedItem, session: Session): PublicItem {
  const tp = TPL[it.tpl];
  return { iid: it.iid, skillId: it.skill, skillName: SKILL[it.skill].name, step: it.step, lane: it.lane, stem: tp.stem(it.p), layout: tp.layout,
           answerKind: tp.kind, formatExample: it.formatExample, index: session.cursor, total: session.plan.length };
}

export function reviewUsedThisWeek(ctx: Ctx): number {
  const t = ctx.now();
  return ctx.S.sessions.filter(s => s.lane === 'review' && t - s.startedAt < 7 * DAY).length;
}

export function homeView(ctx: Ctx) {
  const { S } = ctx;
  const focus = chooseFocus(S); const cv = clientView(S, focus);
  const open = S.sessions.find(s => !s.endedAt && s.cursor < s.plan.length && s.cursor > 0);
  return { name: S.child.name, focus: { id: focus, name: SKILL[focus].name, bandLabel: cv.bandLabel }, fuel: fuel(ctx), laneOffer: laneOffer(S, focus),
           reviewLeft: Math.max(0, CONFIG.REVIEW_PER_WEEK - reviewUsedThisWeek(ctx)), resumable: !!open, stepLabel: stepLabel(replaySkill(S, focus).step) };
}

export function badgesView(ctx: Ctx) {
  const { S } = ctx;
  const got = new Set(S.events.filter(e => e.type === 'BadgeMilestone').map(e => e.skill));
  return { skills: SKILLS.map(s => { const st = replaySkill(S, s.id); return { id: s.id, name: s.name, bandLabel: st.n ? st.band : null, badge: got.has(s.id), open: unlocked(S, s.id) }; }),
           pieces: pieces(S), fuel: fuel(ctx) };
}

/** Behind the glass (dev only). This one is allowed to show internals. */
export function inspect(ctx: Ctx) {
  const { S } = ctx;
  return {
    clock: { today: ctx.today(), dayOffset: S.dayOffset },
    skills: SKILLS.map(s => {
      const st = replaySkill(S, s.id);
      const fresh = TPL_BY_SKILL[s.id].reduce((n, t) => n + freshIn(S, t.id, st.step, ctx.now()).length, 0);
      return { id: s.id, name: s.name, open: unlocked(S, s.id), band: st.band, step: st.step, evidence: st.n, fresh, pool: TPL_BY_SKILL[s.id].reduce((n, t) => n + pool(t.id, st.step).length, 0) };
    }),
    events: S.events.slice(-14).reverse(),
    issued: S.issued.slice(-10).reverse().map(i => ({ skill: i.skill, tpl: i.tpl, step: i.step, lane: i.lane, reason: i.issueReason, evidence: i.evidenceEligible })),
    totals: { attempts: S.attempts.length, honest: S.attempts.filter(a => a.honest).length, rejects: S.rejects.length, fastGuess: S.attempts.filter(a => a.fastGuess).length, xp: xpTotal(S), qpd: qpdDays(S).length },
    focus: chooseFocus(S), config: CONFIG,
  };
}
