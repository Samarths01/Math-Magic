import { tpl, W } from '../define';
import { ri, pick } from '../../util/random';
import { colSumNoCarry, colSumConcat, B } from '../../util/digits';

/* 2 · Adding two-digit numbers */
const addFocus = (a: number, b: number) => { const o = a % 10 + b % 10; return `${a % 10} + ${b % 10} is ${o}. Write the ${o % 10} and carry 1 ten.`; };

export const add2Std = tpl<{ a: number; b: number }>({ id: 'add2-std', skill: 'add2', name: 'two numbers',
  gen: {
    1: r => { const a = ri(r, 10, 88), b = ri(r, 10, 88); return (a % 10 + b % 10 < 10 && a + b < 100) ? { a, b } : null; },
    2: r => { const a = ri(r, 11, 88), b = ri(r, 11, 88); return (a % 10 + b % 10 >= 10 && a + b < 100) ? { a, b } : null; },
    3: r => { const a = ri(r, 25, 99), b = ri(r, 25, 99); return (a % 10 + b % 10 >= 10 && a + b >= 100) ? { a, b } : null; } },
  stem: p => `${p.a} + ${p.b} = ${B}`, ans: p => W(p.a + p.b),
  bugs: [['no-regroup', p => colSumNoCarry(p.a, p.b)], ['both-digits', p => colSumConcat(p.a, p.b)]],
  focus: { 'no-regroup': p => addFocus(p.a, p.b), 'both-digits': p => addFocus(p.a, p.b), default: () => 'Line up tens with tens and ones with ones. Add the ones first.' },
  well: p => (p.a % 10 + p.b % 10 >= 10) ? 'You traded 10 ones for a ten.' : 'You added the ones, then the tens.',
  why: p => (p.a % 10 + p.b % 10 >= 10) ? 'Ten ones make one ten, so the extra ten moves over to the tens.' : 'Adding by place keeps ones with ones and tens with tens.' });

export const add2Three = tpl<{ a: number; b: number; c: number }>({ id: 'add2-three', skill: 'add2', name: 'three numbers',
  gen: {
    1: r => { const a = ri(r, 10, 40), b = ri(r, 10, 40), c = ri(r, 10, 40); const o = a % 10 + b % 10 + c % 10; return (o < 10 && a + b + c < 100) ? { a, b, c } : null; },
    2: r => { const a = ri(r, 10, 40), b = ri(r, 10, 40), c = ri(r, 10, 30); const o = a % 10 + b % 10 + c % 10; return (o >= 10 && o < 20 && a + b + c < 100) ? { a, b, c } : null; },
    3: r => { const a = ri(r, 15, 59), b = ri(r, 15, 59), c = ri(r, 15, 49); const o = a % 10 + b % 10 + c % 10; return (o >= 10 && a + b + c >= 100) ? { a, b, c } : null; } },
  stem: p => `${p.a} + ${p.b} + ${p.c} = ${B}`, ans: p => W(p.a + p.b + p.c),
  bugs: [['no-regroup', p => colSumNoCarry(p.a, p.b, p.c)], ['dropped-addend', p => p.a + p.b], ['dropped-addend', p => p.b + p.c]],
  focus: { 'no-regroup': p => { const o = p.a % 10 + p.b % 10 + p.c % 10; return `The ones make ${o}. Keep ${o % 10} and carry ${Math.floor(o / 10)} to the tens.`; },
           'dropped-addend': () => 'Check that all three numbers got added.', default: () => 'Add two numbers first, then add the third.' },
  well: () => 'You kept track of all three numbers.',
  why: () => 'You can add in any order. Pairs that make a ten are easiest to start with.' });

const nearK = (b: number) => 10 - b % 10;
export const add2Near = tpl<{ a: number; b: number }>({ id: 'add2-near', skill: 'add2', name: 'near a ten',
  gen: {
    1: r => { const a = ri(r, 1, 7) * 10, b = pick(r, [19, 29, 39, 49, 18, 28, 38, 48]); return a + b < 100 ? { a, b } : null; },
    2: r => { const a = ri(r, 12, 79), b = pick(r, [19, 29, 39, 49, 59, 18, 28, 38, 48]); return (a % 10 && a + b < 100) ? { a, b } : null; },
    3: r => { const a = ri(r, 42, 98), b = pick(r, [29, 39, 49, 59, 69, 38, 48, 58, 68]); return (a % 10 && a + b >= 100) ? { a, b } : null; } },
  stem: p => `${p.a} + ${p.b} = ${B}`, ans: p => W(p.a + p.b),
  bugs: [['comp-slip', p => p.a + p.b + 2 * nearK(p.b)], ['no-regroup', p => colSumNoCarry(p.a, p.b)]],
  focus: { 'comp-slip': p => `${p.b} is ${p.b + nearK(p.b)} take away ${nearK(p.b)}. Add ${p.b + nearK(p.b)}, then take ${nearK(p.b)} back.`,
           'no-regroup': p => addFocus(p.a, p.b),
           default: p => `${p.b} is close to ${p.b + nearK(p.b)}. Add ${p.b + nearK(p.b)}, then take ${nearK(p.b)} back.` },
  well: p => `You used ${p.b + nearK(p.b)} as a friendly ten.`,
  why: p => `${p.b} is ${nearK(p.b)} less than ${p.b + nearK(p.b)}, so adding ${p.b + nearK(p.b)} and taking back ${nearK(p.b)} gives the same total.` });

export const add2Double = tpl<{ a: number }>({ id: 'add2-double', skill: 'add2', name: 'doubles',
  gen: {
    1: r => { const a = ri(r, 11, 44); return a % 10 <= 4 ? { a } : null; },
    2: r => { const a = ri(r, 15, 49); return a % 10 >= 5 ? { a } : null; },
    3: r => ({ a: ri(r, 50, 99) }) },
  stem: p => `${p.a} + ${p.a} = ${B}`, ans: p => W(2 * p.a),
  bugs: [['no-regroup', p => colSumNoCarry(p.a, p.a)], ['both-digits', p => colSumConcat(p.a, p.a)]],
  focus: { 'no-regroup': p => addFocus(p.a, p.a), 'both-digits': p => addFocus(p.a, p.a),
           default: p => `Double the tens (${Math.floor(p.a / 10) * 10} + ${Math.floor(p.a / 10) * 10}), double the ones (${p.a % 10} + ${p.a % 10}), then put them together.` },
  well: () => 'You doubled the tens and the ones.', why: () => 'Doubling means adding a number to itself.' });

export default [add2Std, add2Three, add2Near, add2Double];
