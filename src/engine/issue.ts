import { CONFIG } from './config';
import { SKILLS, TPL, TPL_BY_SKILL, type SkillId, type Step, type Template } from './content';
import { pool, type PoolEntry } from './pools';
import { parseAnswer, type Parsed } from './parse';
import { replaySkill, unlockedSkills } from './learner';
import type { Ctx, IssueReason, IssuedItem, Lane, Session, State } from './state';
import { hashStr, rng } from './util/random';
import { R, eqR } from './util/rational';
import { DAY } from './util/time';

/* Issuance: one path. It never changes assignedStep; exhaustion never steps up (§5 invariant 7). */

export function stepFor(S: State, sid: SkillId, lane: Lane): Step {
  const st = replaySkill(S, sid).step;
  return lane === 'challenge' ? Math.min(3, st + 1) as Step : lane === 'review' ? Math.max(1, st - 1) as Step : st;
}

/** Pool entries not shown to this child in the last NO_REPEAT_DAYS. */
export function freshIn(S: State, tid: string, step: Step, t: number): PoolEntry[] {
  const cutoff = t - CONFIG.NO_REPEAT_DAYS * DAY;
  const recentKeys = new Set(S.issued.filter(i => i.shownAt >= cutoff).map(i => i.key));
  return pool(tid, step).filter(x => !recentKeys.has(x.key));
}

function lastShownTemplate(S: State, tid: string): number {
  let t = -1; for (const it of S.issued) if (it.tpl === tid && it.shownAt > t) t = it.shownAt;
  return t;
}

/** Least-recently-seen template first, never the one just shown; a seeded draw within it. */
function issueAt(ctx: Ctx, sid: SkillId, step: Step, lane: Lane, session: Session, reason: IssueReason): IssuedItem | null {
  const { S } = ctx; const t = ctx.now(); const lastTpl = session.lastTpl;
  const tpls = TPL_BY_SKILL[sid].slice().sort((a, b) => lastShownTemplate(S, a.id) - lastShownTemplate(S, b.id) || (hashStr(S.child.seed + a.id) - hashStr(S.child.seed + b.id)));
  const candidates = tpls.filter(x => x.id !== lastTpl);
  for (const tp of candidates) {
    const fresh = freshIn(S, tp.id, step, t); if (!fresh.length) continue;
    const r = rng(hashStr(S.child.seed + ':' + S.issued.length)); const choice = fresh[Math.floor(r() * fresh.length)];
    return makeItem(ctx, tp, step, choice, lane, session, reason);
  }
  return null;
}

function makeItem(ctx: Ctx, tp: Template, step: Step, choice: PoolEntry, lane: Lane, session: Session, reason: IssueReason, evidenceEligible = true): IssuedItem {
  const a = tp.ans(choice.p);
  // a format example that is never the answer
  const ex = tp.kind === 'whole'
    ? [3, 7, 12, 5].find(x => !eqR(R(x), a))
    : ['1/2', '2/3', '3/4'].find(x => { const q = parseAnswer(x, 'fraction') as Parsed; return !eqR(q.value, a); });
  const item: IssuedItem = { iid: ctx.nextId('it'), key: choice.key, skill: tp.skill, tpl: tp.id, ver: tp.ver, step, p: choice.p, lane, sessionId: session.id,
                             issueReason: reason, evidenceEligible, shownAt: ctx.now(), policy: CONFIG.POLICY_VERSION, formatExample: ex, slot: session.cursor };
  ctx.S.issued.push(item); session.lastTpl = tp.id;
  return item;
}

export function issue(ctx: Ctx, session: Session, slotSkill: SkillId, lane: Lane): IssuedItem {
  const { S } = ctx;
  const step = stepFor(S, slotSkill, lane);
  let it = issueAt(ctx, slotSkill, step, lane, session, 'normal');
  if (it) return it;
  // template_switch: only the just-shown template has fresh items → move on to the next skill
  const onlyLast = !!session.lastTpl && TPL[session.lastTpl].skill === slotSkill && freshIn(S, session.lastTpl, step, ctx.now()).length > 0;
  const order = SKILLS.map(s => s.id), start = order.indexOf(slotSkill);
  const us = unlockedSkills(S);
  for (let k = 1; k < order.length; k++) {
    const sid = order[(start + k) % order.length]; if (!us.includes(sid)) continue;
    it = issueAt(ctx, sid, stepFor(S, sid, lane), lane, session, onlyLast ? 'template_switch' : 'exhausted_switch'); if (it) return it;
  }
  // last resort: repeat the item seen longest ago at this step; never evidence
  const cands = S.issued.filter(i => i.skill === slotSkill && i.step === step && i.tpl !== session.lastTpl).sort((a, b) => a.shownAt - b.shownAt);
  const old = cands[0] || S.issued.filter(i => i.skill === slotSkill && i.step === step)[0];
  return makeItem(ctx, TPL[old.tpl], step, { key: old.key, p: old.p }, lane, session, 'exhausted_repeat', false);
}
