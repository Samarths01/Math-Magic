import { tpl, W } from '../define';
import { ri, pick } from '../../util/random';
import { colDiff, B } from '../../util/digits';

/* 8 · Missing numbers */
export const mnAdd = tpl<{ a: number; s: number; left: boolean }>({ id: 'mn-add', skill: 'mn', name: 'missing addend',
  gen: { 1: r => { const a = ri(r, 2, 9), s = ri(r, 11, 18); return s - a >= 2 ? { a, s, left: false } : null; },
         2: r => { const a = ri(r, 12, 58), s = ri(r, 31, 99); return s - a >= 10 ? { a, s, left: false } : null; },
         3: r => { const a = ri(r, 12, 58), s = ri(r, 31, 99); return s - a >= 10 ? { a, s, left: true } : null; } },
  stem: p => p.left ? `${B} + ${p.a} = ${p.s}` : `${p.a} + ${B} = ${p.s}`, ans: p => W(p.s - p.a),
  bugs: [['added-all', p => p.a + p.s], ['smaller-from-larger', p => colDiff(p.s, p.a)]],
  focus: { 'added-all': p => `${p.s} is the total. Take ${p.a} away from ${p.s} to find the missing part.`, 'smaller-from-larger': p => `To find ${p.s} − ${p.a}, trade a ten when the ones are too small.`,
           default: p => `Count up from ${p.a} to ${p.s}.` },
  well: () => 'You found the missing part.', why: () => 'Adding and subtracting undo each other, so subtracting finds a missing part.' });

export const mnSub = tpl<{ a: number; x: number; m: 'sub' | 'start'; res?: number }>({ id: 'mn-sub', skill: 'mn', name: 'missing in take away',
  gen: { 1: r => { const a = ri(r, 11, 18), x = ri(r, 2, 9); return a - x >= 2 ? { a, x, m: 'sub' } : null; },
         2: r => { const a = ri(r, 34, 99), x = ri(r, 12, a - 11); return { a, x, m: 'sub' }; },
         3: r => { const b = ri(r, 12, 49), res = ri(r, 12, 49); return { a: b + res, x: b, m: 'start', res }; } },
  stem: p => p.m === 'sub' ? `${p.a} − ${B} = ${p.a - p.x}` : `${B} − ${p.x} = ${p.res}`, ans: p => W(p.m === 'sub' ? p.x : p.a),
  bugs: [['added', p => p.m === 'sub' ? p.a + (p.a - p.x) : -1], ['subtracted-instead', p => p.m === 'start' ? Math.abs(p.res! - p.x) : -1]],
  focus: { added: p => `${p.a} take away the missing number leaves ${p.a - p.x}. So the missing number is ${p.a} − ${p.a - p.x}.`,
           'subtracted-instead': p => `The missing number is where it started. Add back what was taken: ${p.res} + ${p.x}.`,
           default: p => p.m === 'sub' ? `Ask: what do I take from ${p.a} to leave ${p.a - p.x}?` : `Add ${p.res} and ${p.x} to find where it started.` },
  well: () => 'You worked out the missing number.', why: () => 'You can check any take-away by adding back.' });

export const mnMulDiv = tpl<{ b: number; q: number; m: 'mul' | 'div' | 'start' }>({ id: 'mn-muldiv', skill: 'mn', name: 'missing in times and divide',
  gen: { 1: r => ({ b: pick(r, [2, 3, 4, 5, 10]), q: ri(r, 2, 10), m: 'mul' }), 2: r => ({ b: pick(r, [3, 4, 5, 6, 8]), q: ri(r, 2, 10), m: 'div' }), 3: r => ({ b: pick(r, [3, 4, 6, 7, 8, 9]), q: ri(r, 2, 10), m: 'start' }) },
  stem: p => p.m === 'mul' ? `${p.b} × ${B} = ${p.b * p.q}` : p.m === 'div' ? `${p.b * p.q} ÷ ${B} = ${p.b}` : `${B} ÷ ${p.b} = ${p.q}`,
  ans: p => W(p.m === 'start' ? p.b * p.q : p.q),
  bugs: [['subtracted', p => p.m === 'mul' ? p.b * p.q - p.b : -1], ['multiplied', p => p.m === 'div' ? p.b * p.q * p.b : -1], ['added', p => p.m === 'start' ? p.b + p.q : -1]],
  focus: { subtracted: p => `How many groups of ${p.b} make ${p.b * p.q}?`, multiplied: p => `${p.b * p.q} split into groups of what size gives ${p.b}?`, added: p => `The missing number is the whole: ${p.q} groups of ${p.b}.`,
           default: p => p.m === 'start' ? `Multiply to find the whole: ${p.b} × ${p.q}.` : `Use the times fact that has ${p.b * p.q} in it.` },
  well: () => 'You used the fact family.', why: () => 'Times and division undo each other.' });

export const mnBalance = tpl<{ L: number; ls: string; c: number; op: '+' }>({ id: 'mn-balance', skill: 'mn', name: 'balance both sides',
  gen: { 1: r => { const a = ri(r, 2, 9), b = ri(r, 2, 9), c = ri(r, 1, 9); return a + b - c >= 1 ? { L: a + b, ls: `${a} + ${b}`, c, op: '+' } : null; },
         2: r => { const a = ri(r, 12, 45), b = ri(r, 3, 9), c = ri(r, 5, 25); return a + b - c >= 2 ? { L: a + b, ls: `${a} + ${b}`, c, op: '+' } : null; },
         3: r => { const a = ri(r, 3, 8), b = ri(r, 3, 8), c = ri(r, 2, 15); const L = a * b; return L - c >= 2 ? { L, ls: `${a} × ${b}`, c, op: '+' } : null; } },
  stem: p => `${p.ls} = ${B} + ${p.c}`, ans: p => W(p.L - p.c),
  bugs: [['left-total', p => p.L], ['running-total', p => p.L + p.c]],
  focus: { 'left-total': p => `= means both sides are equal. What plus ${p.c} makes ${p.L}?`, 'running-total': p => `Don't add ${p.c}. Find the number that goes with ${p.c} to make ${p.L}.`,
           default: p => `Work out the left side first (${p.L}), then find what goes with ${p.c}.` },
  well: () => 'You balanced both sides.', why: () => 'The equals sign means both sides have the same value.' });

export default [mnAdd, mnSub, mnMulDiv, mnBalance];
