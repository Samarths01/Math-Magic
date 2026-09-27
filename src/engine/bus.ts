import { CONFIG } from './config';
import type { Ctx, QEType, QEvent, State } from './state';
import { dayDiff } from './util/time';

/* QualifyingEvent bus + append-only, credit-only ledger. `emit` is the only mint path:
   XP, flame and pieces are all derived from these rows (§5 invariant 1). */

export function emit(ctx: Ctx, type: QEType, data: Record<string, unknown>, xp: number): QEvent {
  const ev: QEvent = Object.assign({ id: ctx.nextId('qe'), type, at: ctx.now(), day: ctx.today(), policy: CONFIG.POLICY_VERSION }, data);
  ctx.S.events.push(ev);
  if (xp > 0) ctx.S.ledger.push({ eventId: ev.id, xp });
  return ev;
}

export const xpTotal = (S: State): number => S.ledger.reduce((s, l) => s + l.xp, 0);

export function qpdDays(S: State): string[] {
  return [...new Set(S.events.filter(e => e.type === 'QualifyingPracticeDay').map(e => e.day))].sort();
}

export type FlameState = 'none' | 'hot' | 'warm' | 'ember' | 'resting';
export interface Flame { state: FlameState; count: number }

/* Hot today, Warm yesterday, Ember after one missed day (count holds), Resting after two or
   more. Qualifying days only (§5 invariant 10). */
export function flame(ctx: Ctx): Flame {
  const days = qpdDays(ctx.S); if (!days.length) return { state: 'none', count: 0 };
  const gap = dayDiff(days[days.length - 1], ctx.today());
  let count = 1; for (let i = days.length - 1; i > 0; i--) { if (dayDiff(days[i - 1], days[i]) <= 2) count++; else break; }
  const state = gap <= 0 ? 'hot' : gap === 1 ? 'warm' : gap === 2 ? 'ember' : 'resting';
  return { state, count: state === 'resting' ? 0 : count };
}

export interface Pieces { total: number; have: number; per: number; goal: number; justCompleted: boolean }

export function pieces(S: State): Pieces {
  const n = S.events.filter(e => e.type === 'BuildPieceUnlock').length, per = CONFIG.PIECES_PER_GOAL;
  const goal = Math.floor(n / per) + 1, have = n % per;
  return { total: n, have, per, goal, justCompleted: n > 0 && have === 0 };
}

export interface PieceUnlock { ev: QEvent; n: number; completedGoal: number | null }

export function unlockPiece(ctx: Ctx, reason: string, ref: string): PieceUnlock {
  const before = pieces(ctx.S); const ev = emit(ctx, 'BuildPieceUnlock', { reason, ref }, 0); const after = pieces(ctx.S);
  return { ev, n: before.total + 1, completedGoal: after.justCompleted ? before.goal : null };
}
