import type { AnswerForm, AnswerKind } from './content';
import { R, gcd, type Rat } from './util/rational';

/* Answer parsing: one grammar, used for the client pre-check and for authority. */
export type TypedForm = 'whole' | 'proper' | 'improper' | 'mixed' | 'mixed-odd';
export type RejectReason = 'empty' | 'not-whole' | 'zero-denominator' | 'unreadable';

export interface Parsed { ok: true; value: Rat; form: TypedForm; parts: { w: number; n: number; d: number } }
export interface Unreadable { ok: false; reason: RejectReason }
export type ParseResult = Parsed | Unreadable;

export function parseAnswer(raw: unknown, kind: AnswerKind): ParseResult {
  const s = String(raw || '').trim().replace(/,/g, '').replace(/\s+/g, ' ');
  if (!s) return { ok: false, reason: 'empty' };
  if (/^\d+$/.test(s)) return { ok: true, value: R(+s), form: 'whole', parts: { w: +s, n: 0, d: 1 } };
  if (kind === 'whole') return { ok: false, reason: 'not-whole' };
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d+) ?\/ ?(\d+)$/))) {
    const n = +m[1], d = +m[2]; if (!d) return { ok: false, reason: 'zero-denominator' };
    return { ok: true, value: R(n, d), form: n >= d ? 'improper' : 'proper', parts: { w: 0, n, d } };
  }
  if ((m = s.match(/^(\d+) (\d+) ?\/ ?(\d+)$/))) {
    const w = +m[1], n = +m[2], d = +m[3]; if (!d) return { ok: false, reason: 'zero-denominator' };
    return { ok: true, value: R(w * d + n, d), form: n >= d || n === 0 ? 'mixed-odd' : 'mixed', parts: { w, n, d } };
  }
  return { ok: false, reason: 'unreadable' };
}

export function formOk(pa: Parsed, req: AnswerForm): boolean {
  if (req === 'any') return true;
  if (req === 'lowest') { if (pa.form === 'whole') return true; if (pa.form === 'mixed-odd') return false; return gcd(pa.parts.n, pa.parts.d) === 1; }
  if (req === 'improper') return pa.form === 'improper' || pa.form === 'proper';
  if (req === 'mixed') return pa.form === 'mixed';
  return true;
}

/** The child's answer, re-rendered canonically (never the raw input). */
export function typedText(pa: Parsed): string {
  const { w, n, d } = pa.parts;
  if (pa.form === 'whole') return String(w);
  return (w ? w + ' ' : '') + n + '/' + d;
}
