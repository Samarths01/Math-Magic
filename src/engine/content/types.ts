import type { Rat } from '../util/rational';
import type { Rng } from '../util/random';

export type SkillId = 'pv' | 'add2' | 'sub2' | 'as3' | 'mul' | 'div' | 'mdm' | 'mn' | 'uf' | 'eq' | 'af';
export type Step = 1 | 2 | 3;
export type AnswerKind = 'whole' | 'fraction';
/** The form a correct answer must take (ML note parser rulings). */
export type AnswerForm = 'any' | 'lowest' | 'improper' | 'mixed';
export type Layout = 'row' | 'column';

export interface Skill {
  id: SkillId;
  name: string;
  short: string;
  /** A starting prior only: it decides which skills are open at first (memo §2). */
  grade: number;
  prereq: SkillId[];
}

type Copy<P> = (p: P) => string;
/** A known wrong computation. Returns a value, or a negative/null value when it can't apply. */
export type BugRule<P> = [tag: string, fn: (p: P) => number | Rat | null];

/* gen[step](r) → params | null.  ans(p) → rational.  stem(p) → string with ▢.
   bugs: [tag, p → value] — known wrong computations.  focus[tag] / focus.default → oneFocus copy.
   well(p) → "Nice move" copy.  why(p) → "Why it works" copy or null (omitted when not real). */
export interface Template<P = any> {
  id: string;
  skill: SkillId;
  name: string;
  ver: number;
  kind: AnswerKind;
  form: AnswerForm;
  layout: Layout;
  gen: Record<Step, (r: Rng) => P | null>;
  stem: (p: P) => string;
  ans: (p: P) => Rat;
  bugs: BugRule<P>[];
  focus: Partial<Record<string, Copy<P>>>;
  well: Copy<P>;
  why?: (p: P) => string | null;
  lock?: (p: P, a: Rat) => string;
}

export type TemplateInput<P> =
  Omit<Template<P>, 'ver' | 'kind' | 'form' | 'layout' | 'bugs' | 'focus'> &
  Partial<Pick<Template<P>, 'ver' | 'kind' | 'form' | 'layout' | 'bugs' | 'focus'>>;
