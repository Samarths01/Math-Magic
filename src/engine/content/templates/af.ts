import { tpl, W, NO_BUG } from '../define';
import { ri } from '../../util/random';
import { R } from '../../util/rational';
import { B } from '../../util/digits';

/* 11 · Adding and subtracting fractions */
export const afAdd = tpl<{ a: number; b: number; d: number }>({ id: 'af-add', skill: 'af', name: 'add fractions', kind: 'fraction',
  gen: { 1: r => { const d = ri(r, 3, 8), a = ri(r, 1, d - 2), b = ri(r, 1, d - 1 - a); return b >= 1 ? { a, b, d } : null; },
         2: r => { const d = ri(r, 6, 12), a = ri(r, 1, d - 1), b = ri(r, 1, d - a); return b >= 1 ? { a, b, d } : null; },
         3: r => { const d = ri(r, 3, 10), a = ri(r, 1, d - 1), b = ri(r, 1, d - 1); return a + b > d ? { a, b, d } : null; } },
  stem: p => `${p.a}/${p.d} + ${p.b}/${p.d} = ${B}`, ans: p => R(p.a + p.b, p.d),
  bugs: [['added-denominators', p => R(p.a + p.b, 2 * p.d)]],
  focus: { 'added-denominators': p => `The parts are ${p.d}ths. Adding them doesn't change the part size, so the bottom stays ${p.d}.`, default: p => `Add the tops. Keep the bottom as ${p.d}.` },
  well: () => 'You kept the same-size parts.', why: p => `${p.a}/${p.d} + ${p.b}/${p.d} is ${p.a} + ${p.b} parts of size 1/${p.d}.` });

export const afSub = tpl<{ a: number; b: number; d: number; w: number }>({ id: 'af-sub', skill: 'af', name: 'subtract fractions', kind: 'fraction',
  gen: { 1: r => { const d = ri(r, 3, 8), a = ri(r, 2, d - 1), b = ri(r, 1, a - 1); return { a, b, d, w: 0 }; },
         2: r => { const d = ri(r, 6, 12), a = ri(r, 2, d - 1), b = ri(r, 1, a - 1); return { a, b, d, w: 0 }; },
         3: r => { const d = ri(r, 3, 10), w = ri(r, 1, 2), b = ri(r, 1, d - 1); return { a: w * d, b, d, w }; } },
  stem: p => p.w ? `${p.w} − ${p.b}/${p.d} = ${B}` : `${p.a}/${p.d} − ${p.b}/${p.d} = ${B}`, ans: p => R(p.a - p.b, p.d),
  bugs: [['added', p => R(p.a + p.b, p.d)], ['forgot-whole', p => p.w === 2 ? R(p.d - p.b, p.d) : NO_BUG], ['took-from-one', p => p.w ? R(p.b - 1 >= 0 ? p.b - 1 : 0, p.d) : NO_BUG]],
  focus: { added: () => 'This is take-away, so the answer is smaller.', 'forgot-whole': p => `2 is ${2 * p.d}/${p.d}. Take ${p.b}/${p.d} from that.`,
           'took-from-one': p => `${p.w} is ${p.w * p.d}/${p.d}. Take ${p.b}/${p.d} from that.`, default: p => p.w ? `${p.w} is ${p.w * p.d}/${p.d}. Take ${p.b}/${p.d} from that.` : `Take away the tops. Keep the bottom as ${p.d}.` },
  well: p => p.w ? 'You turned the whole into parts.' : 'You took away same-size parts.',
  why: p => p.w ? `One whole is ${p.d}/${p.d}.` : 'The parts are the same size, so only the count of parts changes.' });

export const afMissing = tpl<{ a: number; s: number; d: number; m: 'add' | 'sub' | 'one' }>({ id: 'af-missing', skill: 'af', name: 'missing part of a sum',
  gen: { 1: r => { const d = ri(r, 4, 9), a = ri(r, 1, d - 2), s = ri(r, a + 1, d - 1); return { a, s, d, m: 'add' }; },
         2: r => { const d = ri(r, 5, 12), s = ri(r, 3, d - 1), a = ri(r, 1, s - 1); return { a, s, d, m: 'sub' }; },
         3: r => { const d = ri(r, 3, 12), a = ri(r, 1, d - 1); return { a, s: d, d, m: 'one' }; } },
  stem: p => p.m === 'add' ? `${p.a}/${p.d} + ${B}/${p.d} = ${p.s}/${p.d}` : p.m === 'sub' ? `${p.s}/${p.d} − ${B}/${p.d} = ${p.a}/${p.d}` : `${p.a}/${p.d} + ${B}/${p.d} = 1`,
  ans: p => W(p.s - p.a),
  bugs: [['added', p => p.a + p.s], ['used-denominator', p => p.m === 'one' ? p.d : -1]],
  focus: { added: p => `The total is ${p.s}/${p.d}. What goes with ${p.a}/${p.d} to make it?`, 'used-denominator': p => `1 whole is ${p.d}/${p.d}. What goes with ${p.a} to make ${p.d}?`,
           default: p => p.m === 'one' ? `1 whole is ${p.d}/${p.d}.` : 'The parts are the same size, so work with the top numbers.' },
  well: () => 'You found the missing part.', why: () => 'With same-size parts, you only need to count parts.' });

export const afThree = tpl<{ a: number; b: number; c: number; d: number; op: '+' | '−' }>({ id: 'af-three', skill: 'af', name: 'three fractions', kind: 'fraction',
  gen: { 1: r => { const d = ri(r, 5, 10), a = ri(r, 1, 3), b = ri(r, 1, 3), c = ri(r, 1, 3); return a + b + c < d ? { a, b, c, d, op: '+' } : null; },
         2: r => { const d = ri(r, 5, 12), a = ri(r, 1, d - 1), b = ri(r, 1, d - 1), c = ri(r, 1, d - 1); return (a + b - c > 0 && a + b - c < d && a + b <= d + 3) ? { a, b, c, d, op: '−' } : null; },
         3: r => { const d = ri(r, 3, 8), a = ri(r, 1, d - 1), b = ri(r, 1, d - 1), c = ri(r, 1, d - 1); return a + b + c > d ? { a, b, c, d, op: '+' } : null; } },
  stem: p => `${p.a}/${p.d} + ${p.b}/${p.d} ${p.op} ${p.c}/${p.d} = ${B}`, ans: p => R(p.op === '+' ? p.a + p.b + p.c : p.a + p.b - p.c, p.d),
  bugs: [['added-denominators', p => R(p.op === '+' ? p.a + p.b + p.c : p.a + p.b - p.c, 3 * p.d)], ['all-plus', p => p.op === '−' ? R(p.a + p.b + p.c, p.d) : NO_BUG]],
  focus: { 'added-denominators': p => `The parts are all ${p.d}ths, so the bottom stays ${p.d}.`, 'all-plus': p => `The last ${p.c}/${p.d} is taken away.`,
           default: p => `Work with the top numbers. The bottom stays ${p.d}.` },
  well: () => 'You kept all the parts the same size.', why: () => 'Same-size parts can be counted together.' });

export default [afAdd, afSub, afMissing, afThree];
