import { tpl, W } from '../define';
import { ri, pick } from '../../util/random';
import { digits, fmtN, PLACE, B } from '../../util/digits';

/* 1 · Place value */
export const pvDigit = tpl<{ n: number; pos: number }>({ id: 'pv-digit', skill: 'pv', name: 'value of a digit',
  gen: {
    1: r => { const n = ri(r, 102, 987), ds = digits(n); if (new Set(ds).size < 3 || ds.includes(0)) return null; return { n, pos: ri(r, 1, 2) }; },
    2: r => { const n = ri(r, 1023, 9876), ds = digits(n); if (new Set(ds).size < 4 || ds.includes(0)) return null; return { n, pos: ri(r, 1, 3) }; },
    3: r => { const n = ri(r, 10234, 98765), ds = digits(n); if (new Set(ds).size < 5 || ds.includes(0)) return null; return { n, pos: ri(r, 2, 4) }; } },
  stem: p => `What is the value of the ${digits(p.n)[p.pos]} in ${fmtN(p.n)}?  ${B}`,
  ans: p => W(digits(p.n)[p.pos] * 10 ** p.pos),
  bugs: [['digit-not-value', p => digits(p.n)[p.pos]], ['wrong-place', p => digits(p.n)[p.pos] * 10 ** (p.pos - 1)], ['wrong-place', p => digits(p.n)[p.pos] * 10 ** (p.pos + 1)]],
  focus: { 'digit-not-value': p => `The ${digits(p.n)[p.pos]} sits in the ${PLACE[p.pos]} place, so it stands for ${digits(p.n)[p.pos]} ${PLACE[p.pos]}.`,
           'wrong-place': p => `Count places from the right: ones, tens, hundreds. The ${digits(p.n)[p.pos]} is in the ${PLACE[p.pos]}.`,
           default: p => `Find the ${digits(p.n)[p.pos]}'s place by counting from the right: ones, tens, hundreds.` },
  well: p => `You read the ${digits(p.n)[p.pos]} as ${digits(p.n)[p.pos]} ${PLACE[p.pos]}.`,
  why: () => 'Each place is worth 10 times the place to its right.',
  lock: (p, a) => `The ${digits(p.n)[p.pos]} in ${fmtN(p.n)} is worth ${fmtN(a.n)}.` });

export const pvExpanded = tpl<{ parts: number[] }>({ id: 'pv-expanded', skill: 'pv', name: 'expanded form',
  gen: {
    1: r => { const h = ri(r, 1, 9), t = ri(r, 1, 9), o = ri(r, 1, 9); return { parts: [h * 100, t * 10, o] }; },
    2: r => { const th = ri(r, 1, 9), h = ri(r, 1, 9), t = ri(r, 1, 9), o = ri(r, 1, 9); return { parts: [th * 1000, h * 100, t * 10, o] }; },
    3: r => { const th = ri(r, 1, 9), h = ri(r, 0, 9), t = ri(r, 0, 9), o = ri(r, 1, 9); if (h && t) return null; const parts = [th * 1000, h * 100, t * 10, o].filter(Boolean); if (r() < 0.5) parts.reverse(); return { parts }; } },
  stem: p => `${p.parts.map(fmtN).join(' + ')} = ${B}`,
  ans: p => W(p.parts.reduce((a, b) => a + b, 0)),
  bugs: [['skip-zero', p => Number(p.parts.slice().sort((a, b) => b - a).map(x => String(x)[0]).join(''))],
         ['digit-sum', p => p.parts.reduce((a, x) => a + Number(String(x)[0]), 0)]],
  focus: { 'skip-zero': () => `A place with nothing in it still needs a 0 to hold its spot.`,
           'digit-sum': () => 'Each part keeps its place value. Put the digits into their places instead of adding them.',
           default: () => 'Write the biggest part first, then fill each place to the right.' },
  well: () => 'You put each part in its place.',
  why: () => 'Expanded form shows what each digit is worth. Added together, the parts make the number.' });

export const pvCompose = tpl<{ th?: number; h: number; t: number; o: number }>({ id: 'pv-compose', skill: 'pv', name: 'build a number',
  gen: {
    1: r => ({ h: ri(r, 1, 9), t: ri(r, 1, 9), o: ri(r, 0, 9) }),
    2: r => ({ th: ri(r, 1, 9), h: ri(r, 0, 9), t: ri(r, 1, 9), o: ri(r, 1, 9) }),
    3: r => ({ h: ri(r, 1, 8), t: ri(r, 10, 19), o: ri(r, 1, 9) }) },
  stem: p => { const u = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`; return [p.th ? u(p.th, 'thousand') : null, p.h ? u(p.h, 'hundred') : (p.th ? '0 hundreds' : null), u(p.t, 'ten'), u(p.o, 'one')].filter(Boolean).join(', ') + ` = ${B}`; },
  ans: p => W((p.th || 0) * 1000 + (p.h || 0) * 100 + p.t * 10 + p.o),
  bugs: [['concatenate', p => Number(`${p.th || ''}${p.th ? (p.h || 0) : (p.h || '')}${p.t}${p.o}`)]],
  focus: { concatenate: p => p.t >= 10 ? `${p.t} tens is ${p.t * 10}. Trade 10 tens for 1 hundred.` : 'Put each count in its own place, using 0 for an empty place.',
           default: p => p.t >= 10 ? `${p.t} tens is ${p.t * 10}. Add that to the hundreds and ones.` : 'Start with the biggest place and write one digit per place.' },
  well: p => p.t >= 10 ? 'You traded 10 tens for a hundred.' : 'You put each count in its place.',
  why: () => '10 of any place make 1 of the next place up.' });

export const pvMore = tpl<{ n: number; d: number }>({ id: 'pv-more', skill: 'pv', name: '10 or 100 more',
  gen: {
    1: r => { const n = ri(r, 110, 979), d = pick(r, [10, -10]); const m = n + d; if (Math.floor(m / 100) !== Math.floor(n / 100)) return null; return { n, d }; },
    2: r => { const n = ri(r, 1100, 8899), d = pick(r, [100, -100]); if (Math.floor((n + d) / 1000) !== Math.floor(n / 1000)) return null; return { n, d }; },
    3: r => { const d = pick(r, [10, -10, 100, -100]); const n = ri(r, 1000, 9899); if (Math.floor((n + d) / (Math.abs(d) * 10)) === Math.floor(n / (Math.abs(d) * 10))) return null; return { n, d }; } },
  stem: p => `What is ${Math.abs(p.d)} ${p.d > 0 ? 'more' : 'less'} than ${fmtN(p.n)}?  ${B}`,
  ans: p => W(p.n + p.d),
  bugs: [['wrong-place', p => p.n + Math.sign(p.d)], ['wrong-place', p => p.n + p.d * 10], ['wrong-direction', p => p.n - p.d]],
  focus: { 'wrong-place': p => `${Math.abs(p.d)} ${p.d > 0 ? 'more' : 'less'} changes the ${Math.abs(p.d) === 10 ? 'tens' : 'hundreds'} digit by 1.`,
           'wrong-direction': p => p.d > 0 ? 'More means the number gets bigger.' : 'Less means the number gets smaller.',
           default: p => `Only the ${Math.abs(p.d) === 10 ? 'tens' : 'hundreds'} place moves, unless it rolls past 9.` },
  well: p => `You changed the ${Math.abs(p.d) === 10 ? 'tens' : 'hundreds'} place.`,
  why: p => `${p.d > 0 ? 'Adding' : 'Taking away'} ${Math.abs(p.d)} changes the ${Math.abs(p.d) === 10 ? 'tens' : 'hundreds'} place by 1. If that place ${p.d > 0 ? 'is 9' : 'is 0'}, it rolls over into the next place.` });

export default [pvDigit, pvExpanded, pvCompose, pvMore];
