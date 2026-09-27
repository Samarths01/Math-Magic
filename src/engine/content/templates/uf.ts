import { tpl, W, NO_BUG } from '../define';
import { ri, pick } from '../../util/random';
import { R, gcd, fmtR, type Rat } from '../../util/rational';
import { B } from '../../util/digits';

/* 9 · Naming and comparing fractions */
export const ufName = tpl<{ n: number; d: number }>({ id: 'uf-name', skill: 'uf', name: 'name the parts', kind: 'fraction',
  gen: { 1: r => ({ n: 1, d: ri(r, 2, 12) }), 2: r => { const d = ri(r, 3, 12), n = ri(r, 2, d - 1); return { n, d }; }, 3: r => { const d = ri(r, 2, 8), n = ri(r, d + 1, 2 * d - 1); return { n, d }; } },
  stem: p => p.n === 1 ? `A whole is cut into ${p.d} equal parts. Write one part as a fraction.  ${B}` : p.n < p.d ? `A whole is cut into ${p.d} equal parts. Write ${p.n} parts as a fraction.  ${B}` : `Each whole is cut into ${p.d} equal parts. Write ${p.n} parts as a fraction.  ${B}`,
  ans: p => R(p.n, p.d),
  bugs: [['swapped', p => R(p.d, p.n)], ['counted-rest', p => p.n < p.d && p.n > 1 ? R(p.d - p.n, p.d) : NO_BUG]],
  focus: { swapped: p => `The bottom number counts the equal parts in one whole (${p.d}). The top counts the parts you have (${p.n}).`, 'counted-rest': p => `Count the parts you're writing (${p.n}), not the ones left over.`,
           default: () => 'The bottom number is how many equal parts make one whole.' },
  well: () => 'You named the parts.', why: p => `${p.n}/${p.d} means ${p.n} part${p.n > 1 ? 's' : ''}, each 1/${p.d} of a whole.`,
  lock: p => `${p.n} part${p.n > 1 ? 's' : ''} of size 1/${p.d} = ${p.n}/${p.d}` });

type Cmp = { x: Rat; y: Rat; which: 'larger' | 'smaller'; half?: boolean };
/* Identity matters here: the answer is x or y itself, and the bug is "the other one". */
const cmpPick = (x: Rat, y: Rat, which: Cmp['which']) => (which === 'larger') === (x.n * y.d > y.n * x.d) ? x : y;

export const ufCmpUnit = tpl<Cmp>({ id: 'uf-cmp-unit', skill: 'uf', name: 'compare unit fractions', kind: 'fraction',
  gen: { 1: r => { const a = ri(r, 2, 8), b = ri(r, 2, 8); return a !== b ? { x: R(1, a), y: R(1, b), which: 'larger' } : null; },
         2: r => { const a = ri(r, 2, 12), b = ri(r, 2, 12); return a !== b ? { x: R(1, a), y: R(1, b), which: pick(r, ['larger', 'smaller'] as const) } : null; },
         3: r => { const n = ri(r, 2, 5), a = ri(r, n + 1, 12), b = ri(r, n + 1, 12); return (a !== b && gcd(n, a) === 1 && gcd(n, b) === 1) ? { x: { n, d: a }, y: { n, d: b }, which: pick(r, ['larger', 'smaller'] as const) } : null; } },
  stem: p => `Which is ${p.which}: ${fmtR(p.x)} or ${fmtR(p.y)}?  ${B}`, ans: p => cmpPick(p.x, p.y, p.which),
  bugs: [['picked-other', p => { const c = cmpPick(p.x, p.y, p.which); return c === p.x ? p.y : p.x; }]],
  focus: { 'picked-other': p => `More equal parts means each part is smaller. ${p.x.n}/${Math.min(p.x.d, p.y.d)} has fewer, bigger parts.`,
           default: () => 'Compare the size of the parts: fewer parts means bigger parts.' },
  well: () => 'You compared the size of the parts.', why: () => 'With the same top number, fewer parts in a whole means each part is bigger.',
  lock: (p, a) => `${fmtR(a)} is ${p.which}.` });

export const ufCmpSame = tpl<Cmp>({ id: 'uf-cmp-same', skill: 'uf', name: 'compare same-size parts', kind: 'fraction',
  gen: { 1: r => { const d = ri(r, 3, 8), a = ri(r, 1, d - 1), b = ri(r, 1, d - 1); return a !== b ? { x: { n: a, d }, y: { n: b, d }, which: 'larger' } : null; },
         2: r => { const d = ri(r, 5, 12), a = ri(r, 1, d - 1), b = ri(r, 1, d - 1); return a !== b ? { x: { n: a, d }, y: { n: b, d }, which: pick(r, ['larger', 'smaller'] as const) } : null; },
         3: r => { const d = pick(r, [4, 6, 8, 10, 12]), n = ri(r, 1, d - 1); return n * 2 !== d ? { x: { n: 1, d: 2 }, y: { n, d }, which: pick(r, ['larger', 'smaller'] as const), half: true } : null; } },
  stem: p => `Which is ${p.which}: ${p.x.n}/${p.x.d} or ${p.y.n}/${p.y.d}?  ${B}`, ans: p => cmpPick(p.x, p.y, p.which),
  bugs: [['picked-other', p => { const c = cmpPick(p.x, p.y, p.which); return c === p.x ? p.y : p.x; }]],
  focus: { 'picked-other': p => p.half ? `Half of ${p.y.d} is ${p.y.d / 2}. Is ${p.y.n} more or less than ${p.y.d / 2}?` : `The parts are the same size, so more parts means more.`,
           default: p => p.half ? `Half of ${p.y.d} is ${p.y.d / 2}. Compare ${p.y.n} with ${p.y.d / 2}.` : 'Same-size parts: compare the top numbers.' },
  well: p => p.half ? 'You compared with one half.' : 'You compared same-size parts.',
  why: p => p.half ? `1/2 is the same as ${p.y.d / 2}/${p.y.d}.` : 'When the bottom numbers match, the parts are the same size.',
  lock: (p, a) => `${a.n}/${a.d === p.x.d && a.n === p.x.n ? p.x.d : p.y.d} is ${p.which}.`.replace(/^(\d+)\/(\d+)/, (_m, n, d) => fmtR(R(+n, +d)) === fmtR(a) ? `${n}/${d}` : fmtR(a)) });

export const ufOf = tpl<{ n: number; d: number; N: number }>({ id: 'uf-of', skill: 'uf', name: 'fraction of a number',
  gen: { 1: r => { const d = ri(r, 2, 5), k = ri(r, 2, 6); return { n: 1, d, N: d * k }; }, 2: r => { const d = ri(r, 3, 10), k = ri(r, 3, 9); return d * k <= 60 ? { n: 1, d, N: d * k } : null; }, 3: r => { const d = ri(r, 3, 8), n = ri(r, 2, d - 1), k = ri(r, 2, 8); return { n, d, N: d * k }; } },
  stem: p => `What is ${p.n}/${p.d} of ${p.N}?  ${B}`, ans: p => W(p.n * p.N / p.d),
  bugs: [['unit-only', p => p.n > 1 ? p.N / p.d : -1], ['multiplied', p => p.N * p.d], ['subtracted', p => p.N - p.d]],
  focus: { 'unit-only': p => `1/${p.d} of ${p.N} is ${p.N / p.d}. You need ${p.n} of those.`, multiplied: p => `Finding 1/${p.d} means splitting ${p.N} into ${p.d} equal groups, so it gets smaller.`,
           subtracted: p => `Split ${p.N} into ${p.d} equal groups instead of taking ${p.d} away.`, default: p => `Split ${p.N} into ${p.d} equal groups.` },
  well: () => 'You split it into equal groups.', why: p => `1/${p.d} of ${p.N} is ${p.N} ÷ ${p.d}.` });

export default [ufName, ufCmpUnit, ufCmpSame, ufOf];
