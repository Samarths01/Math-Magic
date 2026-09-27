import { tpl, W } from '../define';
import { ri } from '../../util/random';
import { digits, fromDigits, B } from '../../util/digits';

/* 7 · Multiplying by one digit */
function mulNoCarryConcat(a: number, c: number): number { return Number(digits(a).slice().reverse().map(d => String(d * c)).join('')); }
function mulCarryBefore(a: number, c: number): number {
  const ds = digits(a); const res: number[] = []; let carry = 0;
  for (let i = 0; i < ds.length; i++) { const v = (ds[i] + carry) * c; res.push(v % 10); carry = Math.floor(v / 10); }
  if (carry) res.push(...digits(carry));
  return fromDigits(res);
}
const firstCarry = (a: number, c: number) => { const ds = digits(a); for (let i = 0; i < ds.length; i++) if (ds[i] * c >= 10) return i; return -1; };
type AC = { a: number; c: number };
const mdmFocus = (p: AC) => { const i = firstCarry(p.a, p.c); if (i < 0) return 'Multiply each digit by ' + p.c + '.'; const d = digits(p.a)[i], v = d * p.c; return `${d} × ${p.c} = ${v}. Write the ${v % 10} and carry ${Math.floor(v / 10)} to add after the next place is multiplied.`; };

export const mdmStd = tpl<AC>({ id: 'mdm-std', skill: 'mdm', name: 'two-digit times one digit',
  gen: {
    1: r => { const a = ri(r, 11, 49), c = ri(r, 2, 4); return firstCarry(a, c) < 0 && a * c < 100 ? { a, c } : null; },
    2: r => { const a = ri(r, 12, 49), c = ri(r, 2, 6); return (digits(a)[0] * c >= 10 && a * c < 100) ? { a, c } : null; },
    3: r => { const a = ri(r, 23, 99), c = ri(r, 3, 9); return (digits(a)[0] * c >= 10 && a * c >= 100) ? { a, c } : null; } },
  stem: p => `${p.a} × ${p.c} = ${B}`, ans: p => W(p.a * p.c),
  bugs: [['no-carry', p => mulNoCarryConcat(p.a, p.c)], ['carry-before', p => mulCarryBefore(p.a, p.c)], ['tens-only', p => Math.floor(p.a / 10) * 10 * p.c + p.a % 10]],
  focus: { 'no-carry': mdmFocus, 'carry-before': p => `Multiply the tens first (${Math.floor(p.a / 10)} × ${p.c} = ${Math.floor(p.a / 10) * p.c}), then add the ${Math.floor((p.a % 10) * p.c / 10)} you carried.`,
           'tens-only': p => `Multiply the ones too: ${p.a % 10} × ${p.c}.`, default: () => 'Multiply the ones, then the tens, then add.' },
  well: p => firstCarry(p.a, p.c) >= 0 ? 'You carried after multiplying.' : 'You multiplied each place.',
  why: p => `${p.a} × ${p.c} is ${Math.floor(p.a / 10) * 10} × ${p.c} plus ${p.a % 10} × ${p.c}.` });

export const mdmCol = tpl<AC>({ id: 'mdm-col', skill: 'mdm', name: 'column multiplying', layout: 'column',
  gen: {
    1: r => { const a = ri(r, 11, 44), c = ri(r, 2, 3); return firstCarry(a, c) < 0 ? { a, c } : null; },
    2: r => { const a = ri(r, 13, 39), c = ri(r, 3, 7); return (digits(a)[0] * c >= 10 && a * c < 200) ? { a, c } : null; },
    3: r => { const a = ri(r, 102, 329), c = ri(r, 2, 4); return (firstCarry(a, c) >= 0 && a * c < 1000) ? { a, c } : null; } },
  stem: p => `${p.a} × ${p.c} = ${B}`, ans: p => W(p.a * p.c),
  bugs: [['no-carry', p => mulNoCarryConcat(p.a, p.c)], ['carry-before', p => mulCarryBefore(p.a, p.c)]],
  focus: { 'no-carry': mdmFocus, 'carry-before': () => 'Multiply the next digit first, then add the number you carried.', default: () => 'Start with the ones. Multiply each digit, carrying when you pass 9.' },
  well: p => firstCarry(p.a, p.c) >= 0 ? 'You carried in the right place.' : 'You multiplied each column.',
  why: () => 'Each digit is multiplied by the same number, and the place values carry just like in adding.' });

export const mdmTens = tpl<{ t: number; c: number }>({ id: 'mdm-tens', skill: 'mdm', name: 'multiples of ten',
  gen: { 1: r => ({ t: ri(r, 2, 5) * 10, c: ri(r, 2, 4) }), 2: r => ({ t: ri(r, 3, 9) * 10, c: ri(r, 5, 9) }), 3: r => ({ t: ri(r, 2, 9) * 100, c: ri(r, 2, 9) }) },
  stem: p => `${p.t} × ${p.c} = ${B}`, ans: p => W(p.t * p.c),
  bugs: [['dropped-zero', p => p.t * p.c / 10], ['extra-zero', p => p.t * p.c * 10]],
  focus: { 'dropped-zero': p => { const u = p.t >= 100 ? 100 : 10, w = u === 100 ? 'hundreds' : 'tens'; return `${p.t} is ${p.t / u} ${w}. ${p.t / u} × ${p.c} = ${p.t / u * p.c}, so it's ${p.t / u * p.c} ${w}.`; },
           'extra-zero': p => { const u = p.t >= 100 ? 100 : 10, w = u === 100 ? 'hundreds' : 'tens'; return `${p.t / u} × ${p.c} = ${p.t / u * p.c}, and those are ${w}.`; },
           default: p => { const u = p.t >= 100 ? 100 : 10; return `Use the fact ${p.t / u} × ${p.c}, then think about the place.`; } },
  well: () => 'You used the basic fact.', why: p => { const u = p.t >= 100 ? 100 : 10; return `${p.t} × ${p.c} is ${p.t / u} × ${p.c} ${u === 100 ? 'hundreds' : 'tens'}.`; } });

export const mdmSplit = tpl<AC>({ id: 'mdm-split', skill: 'mdm', name: 'split it up',
  gen: {
    1: r => { const a = ri(r, 11, 34), c = ri(r, 2, 3); return a % 10 && firstCarry(a, c) < 0 ? { a, c } : null; },
    2: r => { const a = ri(r, 13, 29), c = ri(r, 3, 6); return a % 10 && a * c < 100 ? { a, c } : null; },
    3: r => { const a = ri(r, 24, 89), c = ri(r, 4, 9); return a % 10 && a * c >= 100 ? { a, c } : null; } },
  stem: p => { const t = Math.floor(p.a / 10) * 10, o = p.a % 10; return `${p.c} × ${t} = ${p.c * t} and ${p.c} × ${o} = ${p.c * o}, so ${p.c} × ${p.a} = ${B}`; },
  ans: p => W(p.a * p.c),
  bugs: [['one-part', p => p.c * Math.floor(p.a / 10) * 10], ['one-part', p => p.c * (p.a % 10)]],
  focus: { 'one-part': p => `Add both parts: ${p.c * Math.floor(p.a / 10) * 10} + ${p.c * (p.a % 10)}.`, default: p => `Add the two parts you were given: ${p.c * Math.floor(p.a / 10) * 10} + ${p.c * (p.a % 10)}.` },
  well: () => 'You split the number and added the parts.',
  why: p => `${p.a} is ${Math.floor(p.a / 10) * 10} + ${p.a % 10}, so ${p.c} × ${p.a} is ${p.c} × ${Math.floor(p.a / 10) * 10} plus ${p.c} × ${p.a % 10}.` });

export default [mdmStd, mdmCol, mdmTens, mdmSplit];
