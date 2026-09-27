import type { AnswerForm, Template } from './content';
import type { Outcome } from './state';
import { fmtR, type Rat } from './util/rational';
import { fmtN } from './util/digits';

/* Feedback frames, assembled from template metadata only. Verdict first; beats follow
   (Opportunity §11 stamp 4, design stamp 1). */

export type Beat = [label: string, text: string];
export interface Frame {
  verdict: 'Correct' | 'Not yet';
  beats: Beat[];
  next: string;
  reason?: { kind: 'wrong_form'; required: AnswerForm };
  hideTryNext?: boolean;
}

/** The worked answer line: a template's own `lock`, or the stem with the blank filled. */
export function lockLine(tp: Template, p: unknown, ans: Rat, canon: string): string {
  if (tp.lock) return tp.lock(p, ans);
  const st = tp.stem(p);
  if (/\?\s+▢$/.test(st)) return st.replace(/\?\s+▢$/, '').replace(/^What is /, '') + ' = ' + canon;   // prose question → equation
  return st.replace('▢', canon);
}

const keep = (b: [string, string | null | undefined]): b is Beat => !!b[1];

export function buildFrame(tp: Template, p: unknown, ans: Rat, outcome: Outcome, typed: string, bug: string | null): Frame {
  const canon = fmtR(ans, tp.form === 'mixed' ? 'mixed' : null);
  const lock = lockLine(tp, p, ans, ans.d === 1 ? fmtN(ans.n) : canon);
  if (outcome === 'correct') {
    return { verdict: 'Correct', beats: ([['Nice move', tp.well(p)], ['Why it works', tp.why ? tp.why(p) : null], ['Answer', lock]] as [string, string | null][]).filter(keep), next: 'Next one' };
  }
  if (outcome === 'form_mismatch') {
    const req = ({ lowest: `This one asks for lowest terms, so it's ${canon}.`, improper: `This one asks for one fraction with no whole number in front, so it's ${canon}.`, mixed: `This one asks for the whole number first, then the fraction, so it's ${canon}.` } as Record<string, string>)[tp.form];
    return { verdict: 'Not yet', reason: { kind: 'wrong_form', required: tp.form }, beats: [['What you tried', `You wrote ${typed}. That's the right amount!`], ['One focus', req], ['Lock in', `${typed} = ${canon}`]], next: 'Next', hideTryNext: true };
  }
  const f = (bug && tp.focus[bug]) || tp.focus.default;
  return { verdict: 'Not yet', beats: ([['What you tried', `You wrote ${typed}.`], ['One focus', f ? f(p) : null], ['Lock in', lock]] as [string, string | null][]).filter(keep), next: 'Try another' };
}
