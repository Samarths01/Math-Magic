import { tpl, W } from '../define';
import { ri, pick } from '../../util/random';
import { digits, colSumNoCarry, colSumConcat, colDiff, carries, borrows, PLACE, B } from '../../util/digits';

/* 4 · Adding and subtracting bigger numbers */
export const as3Add = tpl<{ a: number; b: number }>({ id: 'as3-add', skill: 'as3', name: 'three-digit adding',
  gen: {
    1: r => { const a = ri(r, 100, 799), b = ri(r, 100, 899 - a + 100); return (carries(a, b) === 0 && a + b <= 999) ? { a, b } : null; },
    2: r => { const a = ri(r, 105, 799), b = ri(r, 105, 799); return (carries(a, b) === 1 && a + b <= 999) ? { a, b } : null; },
    3: r => { const a = ri(r, 118, 699), b = ri(r, 118, 699); return (carries(a, b) === 2 && a + b <= 999) ? { a, b } : null; } },
  stem: p => `${p.a} + ${p.b} = ${B}`, ans: p => W(p.a + p.b), layout: 'column',
  bugs: [['no-regroup', p => colSumNoCarry(p.a, p.b)], ['both-digits', p => colSumConcat(p.a, p.b)]],
  focus: { 'no-regroup': p => { const i = [0, 1, 2].find(k => (digits(p.a)[k] || 0) + (digits(p.b)[k] || 0) >= 10)!; const s = (digits(p.a)[i] || 0) + (digits(p.b)[i] || 0); return `The ${PLACE[i]} add to ${s}. Keep the ${s % 10} and carry 1 to the ${PLACE[i + 1]}.`; },
           'both-digits': p => { const i = [0, 1, 2].find(k => (digits(p.a)[k] || 0) + (digits(p.b)[k] || 0) >= 10)!; const s = (digits(p.a)[i] || 0) + (digits(p.b)[i] || 0); return `Only one digit fits in each place. Keep the ${s % 10} in the ${PLACE[i]} and carry the 1.`; },
           default: () => 'Add the ones, then the tens, then the hundreds.' },
  well: p => carries(p.a, p.b) ? 'You carried to the next place.' : 'You added place by place.',
  why: () => 'Each place holds only 0 to 9. Ten of anything moves one place to the left.' });

export const as3Sub = tpl<{ a: number; b: number }>({ id: 'as3-sub', skill: 'as3', name: 'three-digit take away',
  gen: {
    1: r => { const a = ri(r, 200, 999), b = ri(r, 100, a - 100); return (b >= 100 && borrows(a, b) === 0) ? { a, b } : null; },
    2: r => { const a = ri(r, 211, 989), b = ri(r, 102, a - 50); return (b >= 100 && borrows(a, b) === 1 && digits(a)[1] !== 0) ? { a, b } : null; },
    3: r => { const h = ri(r, 2, 9), o = ri(r, 0, 7), a = h * 100 + o, b = ri(r, 101, a - 20); return (b >= 101 && digits(b)[0] > o && digits(b)[1] > 0) ? { a, b } : null; } },
  stem: p => `${p.a} − ${p.b} = ${B}`, ans: p => W(p.a - p.b), layout: 'column',
  bugs: [['smaller-from-larger', p => colDiff(p.a, p.b)], ['across-zero', p => digits(p.a)[1] === 0 ? p.a - p.b + 100 : -1]],
  focus: { 'across-zero': () => 'There are no tens to trade, so trade 1 hundred for 10 tens first. Then trade 1 ten for 10 ones.',
           'smaller-from-larger': p => { const i = [0, 1, 2].find(k => (digits(p.a)[k] || 0) < (digits(p.b)[k] || 0))!; return `In the ${PLACE[i]}, ${digits(p.a)[i]} is less than ${digits(p.b)[i]}, so trade from the next place first.`; },
           default: () => 'Start with the ones. Trade from the next place when the top digit is smaller.' },
  well: p => borrows(p.a, p.b) ? 'You traded from the next place.' : 'You took away place by place.',
  why: p => borrows(p.a, p.b) ? 'Trading 1 of a place for 10 of the place to its right keeps the number the same.' : null });

export const as3Near = tpl<{ a: number; b: number; plus: boolean }>({ id: 'as3-near', skill: 'as3', name: 'near a hundred',
  gen: {
    1: r => { const b = pick(r, [100, 200]), plus = r() < 0.5, a = ri(r, 120, 780); const res = plus ? a + b : a - b; return (res >= 100 && res <= 999) ? { a, b, plus } : null; },
    2: r => { const b = pick(r, [99, 199]), plus = r() < 0.5, a = ri(r, 211, 788); const res = plus ? a + b : a - b; return (res >= 100 && res <= 999 && a % 10) ? { a, b, plus } : null; },
    3: r => { const b = pick(r, [98, 198, 298, 299]), plus = r() < 0.5, a = ri(r, 312, 689); const res = plus ? a + b : a - b; return (res >= 100 && res <= 999 && a % 10) ? { a, b, plus } : null; } },
  stem: p => `${p.a} ${p.plus ? '+' : '−'} ${p.b} = ${B}`, ans: p => W(p.plus ? p.a + p.b : p.a - p.b),
  bugs: [['comp-slip', p => { const k = (100 - p.b % 100) % 100; return k ? (p.plus ? p.a + p.b + 2 * k : p.a - p.b - 2 * k) : -1; }]],
  focus: { 'comp-slip': p => { const k = 100 - p.b % 100, rb = p.b + k; return p.plus ? `${p.b} is ${rb} take away ${k}. Add ${rb}, then take ${k} back.` : `Taking away ${p.b} is taking away ${rb} and giving ${k} back.`; },
           default: p => p.b % 100 === 0 ? 'Only the hundreds digit changes.' : `Round ${p.b} to ${p.b + 100 - p.b % 100}, then fix the difference.` },
  well: p => p.b % 100 ? `You used ${p.b + 100 - p.b % 100} as a round number.` : 'You changed only the hundreds.',
  why: p => p.b % 100 ? 'A round hundred is easy to add or take away. Then you fix the small difference.' : null });

export const as3Chain = tpl<{ a: number; b: number; c: number }>({ id: 'as3-chain', skill: 'as3', name: 'add then take away',
  gen: {
    1: r => { const a = ri(r, 11, 50) * 10, b = ri(r, 1, 30) * 10, c = ri(r, 1, 20) * 10; return ((a % 100 + b % 100) < 100 && (a + b) % 100 >= c % 100 && c < a + b && a + b <= 990) ? { a, b, c } : null; },
    2: r => { const a = ri(r, 11, 50) * 10, b = ri(r, 3, 30) * 10, c = ri(r, 2, 20) * 10; return ((a % 100 + b % 100) >= 100 && c < a + b && a + b <= 990) ? { a, b, c } : null; },
    3: r => { const a = ri(r, 112, 399), b = ri(r, 21, 199), c = ri(r, 12, 149); return (a + b - c >= 10 && a % 10 && b % 10 && c % 10) ? { a, b, c } : null; } },
  stem: p => `${p.a} + ${p.b} − ${p.c} = ${B}`, ans: p => W(p.a + p.b - p.c),
  bugs: [['all-plus', p => p.a + p.b + p.c], ['sign-swap', p => p.a - p.b + p.c]],
  focus: { 'all-plus': p => `Only ${p.b} is added. ${p.c} is taken away.`, 'sign-swap': p => `${p.b} is added and ${p.c} is taken away.`,
           default: p => `Work left to right: ${p.a} + ${p.b} = ${p.a + p.b} first.` },
  well: () => 'You worked left to right.', why: () => 'Going left to right keeps each step small.' });

export default [as3Add, as3Sub, as3Near, as3Chain];
