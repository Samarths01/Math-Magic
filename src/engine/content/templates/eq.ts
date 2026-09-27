import { tpl, W } from '../define';
import { ri, pick } from '../../util/random';
import { R, gcd, fmtR } from '../../util/rational';
import { B } from '../../util/digits';

/* 10 · Equivalent fractions — improper · scale · lowest · mixed */
export const eqScale = tpl<{ a: number; b: number; k: number; top: boolean }>({ id: 'eq-scale', skill: 'eq', name: 'missing part of an equal fraction',
  gen: { 1: r => { const b = ri(r, 2, 8), a = ri(r, 1, b - 1); return gcd(a, b) === 1 ? { a, b, k: 2, top: true } : null; },
         2: r => { const b = ri(r, 2, 8), a = ri(r, 1, b - 1), k = ri(r, 3, 5); return gcd(a, b) === 1 ? { a, b, k, top: true } : null; },
         3: r => { const b = ri(r, 3, 9), a = ri(r, 1, b - 1), k = ri(r, 2, 6); return gcd(a, b) === 1 ? { a, b, k, top: false } : null; } },
  stem: p => p.top ? `${p.a}/${p.b} = ${B}/${p.b * p.k}` : `${p.a}/${p.b} = ${p.a * p.k}/${B}`, ans: p => W(p.top ? p.a * p.k : p.b * p.k),
  bugs: [['added-difference', p => p.top ? p.a + p.b * p.k - p.b : p.b + p.a * p.k - p.a], ['copied', p => p.top ? p.a : p.b]],
  focus: { 'added-difference': p => p.top ? `The bottom went from ${p.b} to ${p.b * p.k}. That's × ${p.k}, so multiply the top by ${p.k} too.` : `The top went from ${p.a} to ${p.a * p.k}. That's × ${p.k}, so multiply the bottom by ${p.k} too.`,
           copied: () => 'Equal fractions change both numbers by the same multiple.',
           default: () => 'Find what one number was multiplied by, and multiply the other by the same.' },
  well: () => 'You scaled the top and bottom the same.', why: () => 'Multiplying the top and bottom by the same number makes an equal fraction.' });

export const eqLowest = tpl<{ q: number; s: number; g: number }>({ id: 'eq-lowest', skill: 'eq', name: 'lowest terms', kind: 'fraction', form: 'lowest',
  gen: { 1: r => { const s = ri(r, 3, 9), q = ri(r, 1, s - 1); return gcd(q, s) === 1 ? { q, s, g: 2 } : null; },
         2: r => { const s = ri(r, 2, 7), q = ri(r, 1, s - 1), g = ri(r, 3, 5); return gcd(q, s) === 1 ? { q, s, g } : null; },
         3: r => { const s = ri(r, 2, 6), q = ri(r, 1, 11), g = pick(r, [4, 6, 8]); return (gcd(q, s) === 1 && q !== s) ? { q, s, g } : null; } },
  stem: p => `Write ${p.q * p.g}/${p.s * p.g} in lowest terms.  ${B}`, ans: p => R(p.q, p.s),
  bugs: [['top-only', p => R(p.q, p.s * p.g)], ['bottom-only', p => R(p.q * p.g, p.s)]],
  focus: { 'top-only': p => `Divide the top and the bottom by the same number, ${p.g}.`, 'bottom-only': p => `Divide the top and the bottom by the same number, ${p.g}.`,
           default: p => `Find the biggest number that divides both ${p.q * p.g} and ${p.s * p.g}.` },
  well: () => 'You found the simplest form.', why: p => `${p.q * p.g}/${p.s * p.g} and ${p.q}/${p.s} are the same amount. ${p.q}/${p.s} uses the fewest pieces.`,
  lock: (p, a) => `${p.q * p.g}/${p.s * p.g} = ${fmtR(a)}` });

type WND = { w: number; n: number; d: number };
export const eqImproper = tpl<WND>({ id: 'eq-improper', skill: 'eq', name: 'mixed to one fraction', kind: 'fraction', form: 'improper',
  gen: { 1: r => { const d = ri(r, 2, 5), w = ri(r, 1, 3), n = ri(r, 1, d - 1); return gcd(n, d) === 1 ? { w, n, d } : null; },
         2: r => { const d = ri(r, 2, 6), w = ri(r, 4, 6), n = ri(r, 1, d - 1); return gcd(n, d) === 1 ? { w, n, d } : null; },
         3: r => { const d = ri(r, 6, 10), w = ri(r, 2, 6), n = ri(r, 1, d - 1); return gcd(n, d) === 1 ? { w, n, d } : null; } },
  stem: p => `Write ${p.w} ${p.n}/${p.d} as one fraction.  ${B}`, ans: p => R(p.w * p.d + p.n, p.d),
  bugs: [['added-whole', p => R(p.w + p.n, p.d)], ['times-only', p => R(p.w * p.n, p.d)], ['forgot-part', p => R(p.w * p.d, p.d)]],
  focus: { 'added-whole': p => `Each whole is ${p.d}/${p.d}. ${p.w} whole${p.w > 1 ? 's are' : ' is'} ${p.w * p.d}/${p.d}, then add ${p.n}/${p.d}.`,
           'times-only': p => `Each whole is ${p.d}/${p.d}. ${p.w} whole${p.w > 1 ? 's are' : ' is'} ${p.w * p.d}/${p.d}, then add ${p.n}/${p.d}.`,
           'forgot-part': p => `You have the wholes. Now add the ${p.n}/${p.d}.`, default: p => `Change the wholes into ${p.d}ths, then add ${p.n}/${p.d}.` },
  well: () => 'You turned the wholes into parts.', why: p => `${p.w} whole${p.w > 1 ? 's' : ''} = ${p.w * p.d}/${p.d}.`,
  lock: (p, a) => `${p.w} ${p.n}/${p.d} = ${fmtR(a)}` });

export const eqMixed = tpl<WND>({ id: 'eq-mixed', skill: 'eq', name: 'one fraction to mixed', kind: 'fraction', form: 'mixed',
  gen: { 1: r => { const d = ri(r, 2, 4), w = ri(r, 1, 3), n = ri(r, 1, d - 1); return gcd(n, d) === 1 ? { w, n, d } : null; },
         2: r => { const d = ri(r, 5, 8), w = ri(r, 1, 5), n = ri(r, 1, d - 1); return gcd(n, d) === 1 ? { w, n, d } : null; },
         3: r => { const d = ri(r, 6, 12), w = ri(r, 2, 9), n = ri(r, 1, d - 1); return gcd(n, d) === 1 ? { w, n, d } : null; } },
  stem: p => `Write ${p.w * p.d + p.n}/${p.d} as a mixed number.  ${B}`, ans: p => R(p.w * p.d + p.n, p.d),
  bugs: [['swapped', p => R(p.n * p.d + p.w, p.d)], ['kept-numerator', p => R(p.w * p.d + p.w * p.d + p.n, p.d)]],
  focus: { swapped: p => `How many whole ${p.d}/${p.d} fit in ${p.w * p.d + p.n}/${p.d}? That's the whole number. The leftover goes on top.`,
           'kept-numerator': p => `Take the wholes out of ${p.w * p.d + p.n}/${p.d}. Only the leftover stays as a fraction.`,
           default: p => `How many groups of ${p.d} fit in ${p.w * p.d + p.n}? The leftover goes on top.` },
  well: () => 'You pulled out the wholes.', why: p => `${p.w * p.d + p.n}/${p.d} has ${p.w} whole${p.w > 1 ? 's' : ''} (${p.w * p.d}/${p.d}) and ${p.n}/${p.d} left.`,
  lock: (p, a) => `${p.w * p.d + p.n}/${p.d} = ${fmtR(a, 'mixed')}` });

export default [eqScale, eqLowest, eqImproper, eqMixed];
