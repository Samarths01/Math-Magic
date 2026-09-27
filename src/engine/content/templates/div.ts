import { tpl, W, SETS } from '../define';
import { ri, pick } from '../../util/random';
import { B } from '../../util/digits';

/* 6 · Division facts */
export const divFact = tpl<{ b: number; q: number }>({ id: 'div-fact', skill: 'div', name: 'division fact',
  gen: { 1: r => ({ b: pick(r, SETS[1]), q: ri(r, 2, 12) }), 2: r => ({ b: pick(r, SETS[2]), q: ri(r, 2, 12) }), 3: r => ({ b: pick(r, SETS[3]), q: ri(r, 2, 12) }) },
  stem: p => `${p.b * p.q} ÷ ${p.b} = ${B}`, ans: p => W(p.q),
  bugs: [['subtracted', p => p.b * p.q - p.b], ['off-by-one', p => p.q - 1], ['off-by-one', p => p.q + 1], ['multiplied', p => p.b * p.q * p.b]],
  focus: { subtracted: p => `÷ asks how many groups of ${p.b} fit in ${p.b * p.q}.`, multiplied: p => `÷ splits ${p.b * p.q} into groups, so the answer is smaller.`,
           'off-by-one': p => `Check with times: ${p.b} × your answer should make ${p.b * p.q}.`, default: p => `Think: ${p.b} times what makes ${p.b * p.q}?` },
  well: () => 'You knew the times fact behind it.', why: p => `${p.b * p.q} ÷ ${p.b} = ${p.q} because ${p.b} × ${p.q} = ${p.b * p.q}.` });

export const divMissing = tpl<{ b: number; q: number; m: 'divisor' | 'dividend' }>({ id: 'div-missing', skill: 'div', name: 'missing number in division',
  gen: { 1: r => ({ b: pick(r, [...SETS[1], ...SETS[2]]), q: ri(r, 2, 10), m: 'divisor' }), 2: r => ({ b: pick(r, [...SETS[2], ...SETS[3]]), q: ri(r, 2, 10), m: 'divisor' }), 3: r => ({ b: pick(r, [3, 4, 6, 7, 8, 9]), q: ri(r, 2, 10), m: 'dividend' }) },
  stem: p => p.m === 'divisor' ? `${p.b * p.q} ÷ ${B} = ${p.q}` : `${B} ÷ ${p.b} = ${p.q}`, ans: p => W(p.m === 'divisor' ? p.b : p.b * p.q),
  bugs: [['multiplied', p => p.m === 'divisor' ? p.b * p.q * p.q : -1], ['subtracted', p => p.m === 'divisor' ? p.b * p.q - p.q : -1], ['added', p => p.m === 'dividend' ? p.b + p.q : -1]],
  focus: { multiplied: p => `${p.b * p.q} split into groups of what size gives ${p.q} groups?`, subtracted: p => `Think: ${p.q} × what makes ${p.b * p.q}?`,
           added: p => `The missing number is the whole. ${p.q} groups of ${p.b} make it.`,
           default: p => p.m === 'divisor' ? `Think: ${p.q} × what makes ${p.b * p.q}?` : `Multiply to find the whole: ${p.b} × ${p.q}.` },
  well: () => 'You found the missing number.', why: () => 'Times and division undo each other.' });

export const divRelated = tpl<{ a: number; b: number; by: 'a' | 'b' }>({ id: 'div-related', skill: 'div', name: 'fact families',
  gen: { 1: r => ({ a: pick(r, SETS[1]), b: ri(r, 2, 10), by: r() < 0.5 ? 'a' : 'b' }), 2: r => ({ a: pick(r, SETS[2]), b: ri(r, 3, 10), by: r() < 0.5 ? 'a' : 'b' }), 3: r => ({ a: pick(r, SETS[3]), b: ri(r, 3, 12), by: r() < 0.5 ? 'a' : 'b' }) },
  stem: p => `${p.a} × ${p.b} = ${p.a * p.b}, so ${p.a * p.b} ÷ ${p.by === 'a' ? p.a : p.b} = ${B}`, ans: p => W(p.by === 'a' ? p.b : p.a),
  bugs: [['restated', p => p.a * p.b], ['gave-divisor', p => p.by === 'a' ? p.a : p.b]],
  focus: { restated: p => `${p.a * p.b} is the total. The answer is the other number in the times fact.`, 'gave-divisor': p => `You're dividing by ${p.by === 'a' ? p.a : p.b}. The answer is the other number.`,
           default: () => 'Look for the other number in the times fact.' },
  well: () => 'You used the times fact.', why: () => 'One times fact gives two division facts.' });

export const divTens = tpl<{ b: number; q: number }>({ id: 'div-tens', skill: 'div', name: 'dividing tens',
  gen: { 1: r => ({ b: pick(r, SETS[1]), q: ri(r, 2, 9) }), 2: r => ({ b: pick(r, SETS[2]), q: ri(r, 2, 9) }), 3: r => ({ b: pick(r, SETS[3]), q: ri(r, 2, 9) }) },
  stem: p => `${p.b * p.q * 10} ÷ ${p.b} = ${B}`, ans: p => W(p.q * 10),
  bugs: [['dropped-zero', p => p.q], ['extra-zero', p => p.q * 100]],
  focus: { 'dropped-zero': p => `${p.b * p.q * 10} is ${p.b * p.q} tens, so the answer is tens too.`, 'extra-zero': p => `${p.b * p.q * 10} is ${p.b * p.q} tens. ${p.b * p.q} tens ÷ ${p.b} = ${p.q} tens.`,
           default: p => `Think ${p.b * p.q} ÷ ${p.b}, then remember they're tens.` },
  well: () => 'You kept track of the tens.', why: p => `${p.b * p.q * 10} ÷ ${p.b} is ${p.b * p.q} tens ÷ ${p.b}, which is ${p.q} tens.` });

export default [divFact, divMissing, divRelated, divTens];
