import { tpl, W, SETS } from '../define';
import { ri, pick } from '../../util/random';
import { B } from '../../util/digits';

/* 5 · Multiplication facts */
export const mulFact = tpl<{ a: number; b: number; sw: boolean }>({ id: 'mul-fact', skill: 'mul', name: 'times fact',
  gen: { 1: r => ({ a: ri(r, 1, 12), b: pick(r, SETS[1]), sw: r() < 0.5 }), 2: r => ({ a: ri(r, 2, 12), b: pick(r, SETS[2]), sw: r() < 0.5 }), 3: r => ({ a: ri(r, 3, 12), b: pick(r, SETS[3]), sw: r() < 0.5 }) },
  stem: p => p.sw ? `${p.b} × ${p.a} = ${B}` : `${p.a} × ${p.b} = ${B}`, ans: p => W(p.a * p.b),
  bugs: [['added', p => p.a + p.b], ['off-by-group', p => (p.a - 1) * p.b], ['off-by-group', p => (p.a + 1) * p.b], ['off-by-group', p => p.a * (p.b - 1)], ['off-by-group', p => p.a * (p.b + 1)]],
  focus: { added: p => `Times means groups of. ${p.a} × ${p.b} is ${p.a} groups of ${p.b}.`, 'off-by-group': p => `Count the groups again: ${p.a} groups of ${p.b}.`,
           default: p => `Skip count by ${p.b}, ${p.a} times.` },
  well: () => 'You knew this fact.', why: p => `${p.a} × ${p.b} is ${p.a} groups of ${p.b}. The order can swap and the answer stays the same.` });

export const mulFactor = tpl<{ a: number; b: number; left: boolean }>({ id: 'mul-factor', skill: 'mul', name: 'missing factor',
  gen: { 1: r => ({ a: ri(r, 2, 12), b: pick(r, SETS[1]), left: r() < 0.5 }), 2: r => ({ a: ri(r, 2, 12), b: pick(r, SETS[2]), left: r() < 0.5 }), 3: r => ({ a: ri(r, 3, 12), b: pick(r, SETS[3]), left: r() < 0.5 }) },
  stem: p => p.left ? `${B} × ${p.b} = ${p.a * p.b}` : `${p.b} × ${B} = ${p.a * p.b}`, ans: p => W(p.a),
  bugs: [['subtracted', p => p.a * p.b - p.b], ['added', p => p.a * p.b + p.b], ['off-by-one', p => p.a - 1], ['off-by-one', p => p.a + 1]],
  focus: { subtracted: p => `Ask: how many groups of ${p.b} make ${p.a * p.b}?`, added: p => `Ask: how many groups of ${p.b} make ${p.a * p.b}?`,
           'off-by-one': p => `Check by multiplying your answer by ${p.b}. It should make ${p.a * p.b}.`, default: p => `Skip count by ${p.b} until you reach ${p.a * p.b}.` },
  well: () => 'You worked backward from the answer.', why: p => `Division undoes times: ${p.a * p.b} ÷ ${p.b} = ${p.a}.` });

export const mulSkip = tpl<{ b: number; k: number }>({ id: 'mul-skip', skill: 'mul', name: 'skip counting',
  gen: { 1: r => ({ b: pick(r, SETS[1]), k: ri(r, 1, 8) }), 2: r => ({ b: pick(r, SETS[2]), k: ri(r, 1, 8) }), 3: r => ({ b: pick(r, SETS[3]), k: ri(r, 1, 8) }) },
  stem: p => `${p.b * p.k}, ${p.b * (p.k + 1)}, ${p.b * (p.k + 2)}, ${B}`, ans: p => W(p.b * (p.k + 3)),
  bugs: [['counted-by-one', p => p.b * (p.k + 2) + 1], ['off-jump', p => p.b * (p.k + 3) + 1], ['off-jump', p => p.b * (p.k + 3) - 1]],
  focus: { 'counted-by-one': p => `Each jump is ${p.b}. Add ${p.b} to ${p.b * (p.k + 2)}.`, 'off-jump': p => `Each jump is exactly ${p.b}. Add ${p.b} to ${p.b * (p.k + 2)}.`,
           default: p => `Find the jump between numbers (${p.b}) and add it once more.` },
  well: p => `You kept the jumps of ${p.b}.`, why: p => `Counting by ${p.b} lists the ${p.b} times table.` });

export const mulDouble = tpl<{ a: number; b: number }>({ id: 'mul-double', skill: 'mul', name: 'use a fact you know',
  gen: { 1: r => ({ a: ri(r, 1, 6), b: pick(r, SETS[1]) }), 2: r => ({ a: ri(r, 2, 6), b: pick(r, SETS[2]) }), 3: r => ({ a: ri(r, 2, 6), b: pick(r, SETS[3]) }) },
  stem: p => `${p.a} × ${p.b} = ${p.a * p.b}, so ${2 * p.a} × ${p.b} = ${B}`, ans: p => W(2 * p.a * p.b),
  bugs: [['added-factor', p => p.a * p.b + p.b], ['restated', p => p.a * p.b], ['added-factor', p => p.a * p.b + 2 * p.a]],
  focus: { 'added-factor': p => `${2 * p.a} is double ${p.a}, so double ${p.a * p.b}.`, restated: () => 'The first number doubled, so the answer doubles too.',
           default: p => `Double the answer you know: ${p.a * p.b} + ${p.a * p.b}.` },
  well: () => 'You used a fact you already know.', why: () => 'When one number in a times fact doubles, the answer doubles.' });

export default [mulFact, mulFactor, mulSkip, mulDouble];
