import { R, type Rat } from '../util/rational';
import type { Template, TemplateInput } from './types';

export function tpl<P>(o: TemplateInput<P>): Template<P> {
  return { ver: 1, kind: 'whole', form: 'any', bugs: [], focus: {}, layout: 'row', ...o };
}

/** A whole-number answer. */
export const W = (n: number): Rat => R(n);

/** A bug value that never applies (the prototype's `{ n: -1, d: 1 }`). */
export const NO_BUG: Rat = { n: -1, d: 1 };

/** Times-table sets by difficulty step. */
export const SETS = { 1: [2, 5, 10], 2: [3, 4, 6], 3: [7, 8, 9] } as const;
