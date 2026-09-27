import { tpl, W } from '../define';
import { ri, pick } from '../../util/random';
import { colDiff, B } from '../../util/digits';

/* 3 · Subtracting two-digit numbers */
export const sub2Std = tpl<{ a: number; b: number }>({ id: 'sub2-std', skill: 'sub2', name: 'take away',
  gen: {
    1: r => { const a = ri(r, 25, 99), b = ri(r, 11, a - 10); return (b >= 11 && a % 10 >= b % 10) ? { a, b } : null; },
    2: r => { const a = ri(r, 31, 99), b = ri(r, 12, a - 5); return (b >= 12 && a % 10 < b % 10) ? { a, b } : null; },
    3: r => { const a = ri(r, 101, 189), b = ri(r, 21, 99); return (a % 10 < b % 10 && a - b < 100 && a - b > 0) ? { a, b } : null; } },
  stem: p => `${p.a} − ${p.b} = ${B}`, ans: p => W(p.a - p.b),
  bugs: [['smaller-from-larger', p => colDiff(p.a, p.b)], ['added', p => p.a + p.b]],
  focus: { 'smaller-from-larger': p => `You can't take ${p.b % 10} from ${p.a % 10}, so trade a ten for 10 ones: ${p.a % 10 + 10} − ${p.b % 10} = ${p.a % 10 + 10 - p.b % 10}.`,
           added: () => 'This is take-away, so the answer is smaller than the first number.',
           default: () => 'Start with the ones. If the top digit is smaller, trade a ten first.' },
  well: p => (p.a % 10 < p.b % 10) ? 'You traded a ten for 10 ones.' : 'You took away the ones, then the tens.',
  why: p => (p.a % 10 < p.b % 10) ? 'Trading a ten for 10 ones keeps the number the same. It only regroups it.' : null });

export const sub2FromTen = tpl<{ a: number; b: number }>({ id: 'sub2-fromten', skill: 'sub2', name: 'from a round number',
  gen: {
    1: r => ({ a: ri(r, 2, 9) * 10, b: ri(r, 1, 9) }),
    2: r => { const a = ri(r, 3, 9) * 10, b = ri(r, 11, a - 1); return b % 10 ? { a, b } : null; },
    3: r => { const a = pick(r, [100, 100, 200]), b = ri(r, 11, a === 100 ? 89 : 189); return b % 10 ? { a, b } : null; } },
  stem: p => `${p.a} − ${p.b} = ${B}`, ans: p => W(p.a - p.b),
  bugs: [['smaller-from-larger', p => colDiff(p.a, p.b)], ['across-zero', p => p.a >= 100 ? p.a - p.b + 10 : -1], ['added', p => p.a + p.b]],
  focus: { 'smaller-from-larger': p => `There are 0 ones in ${p.a}, so trade a ten: 10 − ${p.b % 10} = ${10 - p.b % 10}.`,
           'across-zero': () => 'Trade 1 hundred for 10 tens, then 1 ten for 10 ones. That leaves 9 tens and 10 ones.',
           added: () => 'This is take-away, so the answer is smaller than the first number.',
           default: p => `Count up from ${p.b} to the next ten, then on to ${p.a}.` },
  well: () => 'You worked across the zero.',
  why: p => `Counting up from ${p.b} to ${p.a} gives the same answer as taking away.` });

export const sub2Chain = tpl<{ a: number; t: number; o: number }>({ id: 'sub2-chain', skill: 'sub2', name: 'tens, then ones',
  gen: {
    1: r => { const a = ri(r, 41, 99), t = ri(r, 1, 3) * 10, o = ri(r, 1, 9); return (a - t >= 10 && (a - t) % 10 >= o) ? { a, t, o } : null; },
    2: r => { const a = ri(r, 41, 99), t = ri(r, 1, 3) * 10, o = ri(r, 2, 9); return (a - t - o >= 1 && (a - t) % 10 < o) ? { a, t, o } : null; },
    3: r => { const a = ri(r, 112, 199), t = ri(r, 2, 6) * 10, o = ri(r, 2, 9); return (a - t - o >= 10 && (a - t) % 10 < o) ? { a, t, o } : null; } },
  stem: p => `${p.a} − ${p.t} − ${p.o} = ${B}`, ans: p => W(p.a - p.t - p.o),
  bugs: [['added-last', p => p.a - p.t + p.o], ['smaller-from-larger', p => colDiff(p.a - p.t, p.o)]],
  focus: { 'added-last': p => `Both numbers are taken away: first ${p.t}, then ${p.o}.`,
           'smaller-from-larger': p => `After taking ${p.t} you have ${p.a - p.t}. Now trade a ten to take away ${p.o}.`,
           default: p => `Take away the tens first: ${p.a} − ${p.t} = ${p.a - p.t}.` },
  well: () => 'You took away the tens, then the ones.',
  why: () => 'Taking away in two small steps is the same as taking away both at once.' });

export const sub2Diff = tpl<{ a: number; b: number; flip: boolean }>({ id: 'sub2-diff', skill: 'sub2', name: 'difference between',
  gen: {
    1: r => { const a = ri(r, 25, 99), b = ri(r, 11, a - 10); return (a % 10 >= b % 10) ? { a, b, flip: r() < 0.5 } : null; },
    2: r => { const a = ri(r, 31, 99), b = ri(r, 12, a - 5); return (a % 10 < b % 10) ? { a, b, flip: r() < 0.5 } : null; },
    3: r => { const a = ri(r, 101, 152), b = ri(r, 24, 99); return (a % 10 < b % 10 && a - b > 0) ? { a, b, flip: r() < 0.5 } : null; } },
  stem: p => `What is the difference between ${p.flip ? p.b : p.a} and ${p.flip ? p.a : p.b}?  ${B}`, ans: p => W(p.a - p.b),
  bugs: [['added', p => p.a + p.b], ['smaller-from-larger', p => colDiff(p.a, p.b)]],
  focus: { added: () => 'The difference is how far apart two numbers are, so subtract the smaller from the larger.',
           'smaller-from-larger': p => `In the ones, ${p.a % 10} is less than ${p.b % 10}, so trade a ten first.`,
           default: p => `Count up from ${p.b} to ${p.a}.` },
  well: () => 'You found how far apart they are.', why: () => 'The difference between two numbers is the larger minus the smaller.',
  lock: (p, a) => `${p.a} − ${p.b} = ${a.n}` });

export default [sub2Std, sub2FromTen, sub2Chain, sub2Diff];
