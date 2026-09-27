import type { SkillId, Step } from './content';
import { DAY, dayKey } from './util/time';
import { hashStr } from './util/random';

/* The stored state. Every array is append-only except `sessions` (cursor, endedAt, …),
   and each maps to a table in HANDOFF §3.1. Derived values (XP total, flame, pieces, band,
   step, template recency) are never stored; they are recomputed from these rows. */

export type Lane = 'recommended' | 'challenge' | 'review';
export type Band = 'Still learning' | 'Getting it' | 'Got it';
export type IssueReason = 'normal' | 'template_switch' | 'exhausted_switch' | 'exhausted_repeat';
export type Outcome = 'correct' | 'wrong' | 'form_mismatch';
export type QEType =
  | 'HonestAttempt' | 'QualifyingPracticeDay' | 'LevelUpSlight' | 'MasteryBandTransition'
  | 'BadgeMilestone' | 'BuildPieceUnlock' | 'ConceptProgressTick';

export interface Child { name: string; grade: number; seed: number }

export interface IssuedItem {
  iid: string; key: string; skill: SkillId; tpl: string; ver: number; step: Step;
  /** Resolved params, never just a seed (Arch §26.2). Server-only. */
  p: any;
  lane: Lane; sessionId: string; issueReason: IssueReason; evidenceEligible: boolean;
  shownAt: number; policy: string; formatExample: number | string | undefined; slot: number;
}

export interface Attempt {
  iid: string; skill: SkillId; tpl: string; ver: number; step: Step; lane: Lane; sessionId: string;
  outcome: Outcome; bug: string | null; correct: boolean; typed: string;
  rtMs: number; fastGuess: boolean; honest: boolean; countsForBand: boolean; issueReason: IssueReason;
  at: number; day: string; policy: string;
  /** The stored response, returned verbatim on a same-key replay. */
  response?: unknown;
}

/** Never stores the raw input (ML note). */
export interface FormatReject { iid: string; tpl: string; ver: number; kind: string; reason: string; at: number }

export interface QEvent {
  id: string; type: QEType; at: number; day: string; policy: string;
  skill?: SkillId; iid?: string;
  [data: string]: unknown;
}

export interface LedgerRow { eventId: string; xp: number }

export interface BandLogRow { skill: SkillId; from: Band; to: Band; at: number; policy: string; iid: string }

export interface Session {
  id: string; focus: SkillId; lane: Lane; plan: SkillId[]; cursor: number;
  startedAt: number; endedAt: number | null; lastTpl: string | null; attempted: number;
  bandAtStart: Band; stepAtStart: Step; xpAtStart: number; piecesAtStart: number;
  leveledUp: boolean; currentIid: string | null; abandoned?: boolean; tick?: boolean;
}

export interface State {
  v: number; child: Child; dayOffset: number; seq: number;
  issued: IssuedItem[]; attempts: Attempt[]; rejects: FormatReject[]; events: QEvent[];
  ledger: LedgerRow[]; sessions: Session[]; bandLog: BandLogRow[];
  dev: { alwaysOfferLanes: boolean; focusOverride: SkillId | null };
  sample?: boolean;
}

export function freshState(name?: string, grade?: number): State {
  return { v: 1, child: { name: name || 'Leo', grade: grade || 3, seed: hashStr((name || 'Leo') + ':' + Date.now()) }, dayOffset: 0, seq: 0,
           issued: [], attempts: [], rejects: [], events: [], ledger: [], sessions: [], bandLog: [], dev: { alwaysOfferLanes: false, focusOverride: null } };
}

/** Time and ids for one server instance. Everything that reads the clock goes through here. */
export interface Ctx {
  S: State;
  now(): number;
  today(): string;
  nextId(pfx: string): string;
}

export function makeCtx(S: State, clock?: () => number): Ctx {
  const now = () => (clock ? clock() : Date.now()) + S.dayOffset * DAY;
  return { S, now, today: () => dayKey(now()), nextId: pfx => pfx + '_' + (++S.seq).toString(36) };
}
