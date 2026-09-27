/* Math Sprout engine — rules-v1. Everything here plays the "server" role:
   generation, issuance, scoring, learner state, QualifyingEvent bus, ledger.
   The UI talks to it only through createServer(); item payloads never carry answers. */
(function (G) {
'use strict';

const CONFIG = {
  POLICY_VERSION: 'rules-v1',
  SESSION_ITEMS: 12,            // IA §7 directional 8–12
  MIX_SLOTS: [3, 6, 9, 11],     // 1-based slots filled by interleaved skills; the rest are focus
  QPD_K: 5,                     // honest attempts for a QualifyingPracticeDay (≥1 Recommended/Challenge)
  MIN_LATENCY_MS: 1000,         // below this an answer is not an HonestAttempt
  FAST_GUESS_MS: 2000,          // instrument only (ML note)
  RT_CAP_MS: 120000,            // response-time clamp (ML note, 4:44pm)
  NO_REPEAT_DAYS: 7,
  BAND_WINDOW: 8, BAND_MIN: 6, GETTING_IT: 0.6, GOT_IT: 0.85, GOT_IT_RUN: 3,
  STEP_UP_RUN: 3, STEP_DOWN_MISSES: 3, STEP_DOWN_WINDOW: 4,
  REVIEW_PER_WEEK: 2, REVIEW_XP_MULT: 0.4,
  XP: { correct: 10, challenge: 15, effort: 3, tick: 15, band: 30, levelUp: 25 },
  TICK_DELTA: 0.34, TICK_MIN: 6,
  PIECES_PER_GOAL: 5, FLAME_MILESTONES: [3, 7, 14],
  FOCUS_MAX_SESSIONS: 4,        // rotate focus if the band hasn't moved up in this many focus sessions
  POOL_FLOOR_TEMPLATE: 10, POOL_FLOOR_SKILL: 20, POOL_CAP: 80
};

/* ---------- small utilities ---------- */
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; }
function R(n, d = 1) { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d) || 1; return { n: n / g, d: d / g }; }
const eqR = (a, b) => a.n * b.d === b.n * a.d;
function fmtR(r, form) {
  if (r.d === 1) return String(r.n);
  if (form === 'mixed' && r.n > r.d) return Math.floor(r.n / r.d) + ' ' + (r.n % r.d) + '/' + r.d;
  return r.n + '/' + r.d;
}
const digits = n => String(n).split('').map(Number).reverse();          // ones first
const fromDigits = ds => ds.reduceRight((acc, d) => acc * 10 + d, 0);
function colSumNoCarry(...ns) { const L = Math.max(...ns.map(n => String(n).length)); const out = []; for (let i = 0; i < L; i++) out.push(ns.reduce((s, n) => s + (digits(n)[i] || 0), 0) % 10); return fromDigits(out); }
function colSumConcat(a, b) { const L = Math.max(String(a).length, String(b).length); let s = ''; for (let i = L - 1; i >= 0; i--) s += String((digits(a)[i] || 0) + (digits(b)[i] || 0)); return Number(s); }
function colDiff(a, b) { const L = String(a).length; const out = []; for (let i = 0; i < L; i++) out.push(Math.abs((digits(a)[i] || 0) - (digits(b)[i] || 0))); return fromDigits(out); }
function carries(a, b) { let c = 0, n = 0; const L = Math.max(String(a).length, String(b).length); for (let i = 0; i < L; i++) { const s = (digits(a)[i] || 0) + (digits(b)[i] || 0) + c; c = s >= 10 ? 1 : 0; n += c; } return n; }
function borrows(a, b) { let br = 0, n = 0; const L = String(a).length; for (let i = 0; i < L; i++) { const t = (digits(a)[i] || 0) - br - (digits(b)[i] || 0); br = t < 0 ? 1 : 0; n += br; } return n; }
const PLACE = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands'];
const fmtN = n => n >= 1000 ? n.toLocaleString('en-US') : String(n);
const B = '▢';   // blank marker inside stems

/* ---------- concept graph ---------- */
const SKILLS = [
  { id: 'pv',   name: 'Place value',                          short: 'place value',          grade: 2, prereq: [] },
  { id: 'add2', name: 'Adding two-digit numbers',             short: 'adding',               grade: 2, prereq: ['pv'] },
  { id: 'sub2', name: 'Subtracting two-digit numbers',        short: 'subtracting',          grade: 2, prereq: ['pv'] },
  { id: 'as3',  name: 'Adding and subtracting bigger numbers', short: 'bigger numbers',      grade: 3, prereq: ['add2', 'sub2'] },
  { id: 'mul',  name: 'Multiplication facts',                 short: 'times facts',          grade: 3, prereq: ['add2'] },
  { id: 'div',  name: 'Division facts',                       short: 'division facts',       grade: 3, prereq: ['mul'] },
  { id: 'mdm',  name: 'Multiplying by one digit',             short: 'multiplying',          grade: 4, prereq: ['mul'] },
  { id: 'mn',   name: 'Missing numbers',                      short: 'missing numbers',      grade: 3, prereq: ['add2', 'mul'] },
  { id: 'uf',   name: 'Naming and comparing fractions',       short: 'comparing fractions',  grade: 2, prereq: [] },
  { id: 'eq',   name: 'Equivalent fractions',                 short: 'equivalent fractions', grade: 3, prereq: ['uf'] },
  { id: 'af',   name: 'Adding and subtracting fractions',     short: 'adding fractions',     grade: 4, prereq: ['uf', 'eq'] }
];
const SKILL = Object.fromEntries(SKILLS.map(s => [s.id, s]));

/* ---------- templates ----------
   gen[step](r) → params | null.  ans(p) → rational.  stem(p) → string with ▢.
   bugs: [tag, p → value] — known wrong computations.  focus[tag] / focus.default → oneFocus copy.
   well(p) → "Nice move" copy.  why(p) → "Why it works" copy or null (omitted when not real). */
const T = [];
const tpl = o => { T.push(Object.assign({ ver: 1, kind: 'whole', form: 'any', bugs: [], focus: {}, layout: 'row' }, o)); };
const W = n => R(n);

/* 1 · Place value */
tpl({ id: 'pv-digit', skill: 'pv', name: 'value of a digit',
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

tpl({ id: 'pv-expanded', skill: 'pv', name: 'expanded form',
  gen: {
    1: r => { const h = ri(r, 1, 9), t = ri(r, 1, 9), o = ri(r, 1, 9); return { parts: [h * 100, t * 10, o] }; },
    2: r => { const th = ri(r, 1, 9), h = ri(r, 1, 9), t = ri(r, 1, 9), o = ri(r, 1, 9); return { parts: [th * 1000, h * 100, t * 10, o] }; },
    3: r => { const th = ri(r, 1, 9), h = ri(r, 0, 9), t = ri(r, 0, 9), o = ri(r, 1, 9); if (h && t) return null; const parts = [th * 1000, h * 100, t * 10, o].filter(Boolean); if (r() < 0.5) parts.reverse(); return { parts }; } },
  stem: p => `${p.parts.map(fmtN).join(' + ')} = ${B}`,
  ans: p => W(p.parts.reduce((a, b) => a + b, 0)),
  bugs: [['skip-zero', p => Number(p.parts.slice().sort((a, b) => b - a).map(x => String(x)[0]).join(''))],
         ['digit-sum', p => p.parts.reduce((a, x) => a + Number(String(x)[0]), 0)]],
  focus: { 'skip-zero': p => `A place with nothing in it still needs a 0 to hold its spot.`,
           'digit-sum': () => 'Each part keeps its place value. Put the digits into their places instead of adding them.',
           default: () => 'Write the biggest part first, then fill each place to the right.' },
  well: () => 'You put each part in its place.',
  why: () => 'Expanded form shows what each digit is worth. Added together, the parts make the number.' });

tpl({ id: 'pv-compose', skill: 'pv', name: 'build a number',
  gen: {
    1: r => ({ h: ri(r, 1, 9), t: ri(r, 1, 9), o: ri(r, 0, 9) }),
    2: r => ({ th: ri(r, 1, 9), h: ri(r, 0, 9), t: ri(r, 1, 9), o: ri(r, 1, 9) }),
    3: r => ({ h: ri(r, 1, 8), t: ri(r, 10, 19), o: ri(r, 1, 9) }) },
  stem: p => { const u = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`; return [p.th ? u(p.th, 'thousand') : null, p.h ? u(p.h, 'hundred') : (p.th ? '0 hundreds' : null), u(p.t, 'ten'), u(p.o, 'one')].filter(Boolean).join(', ') + ` = ${B}`; },
  ans: p => W((p.th || 0) * 1000 + (p.h || 0) * 100 + p.t * 10 + p.o),
  bugs: [['concatenate', p => Number(`${p.th || ''}${p.th ? (p.h || 0) : (p.h || '')}${p.t}${p.o}`)]],
  focus: { concatenate: p => p.t >= 10 ? `${p.t} tens is ${p.t * 10}. Trade 10 tens for 1 hundred.` : 'Put each count in its own place, using 0 for an empty place.',
           default: p => p.t >= 10 ? `${p.t} tens is ${p.t * 10}. Add that to the hundreds and ones.` : 'Start with the biggest place and write one digit per place.' },
  well: p => p.t >= 10 ? 'You traded 10 tens for a hundred.' : 'You put each count in its place.',
  why: () => '10 of any place make 1 of the next place up.' });

tpl({ id: 'pv-more', skill: 'pv', name: '10 or 100 more',
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

/* 2 · Adding two-digit numbers */
const addFocus = (a, b) => { const o = a % 10 + b % 10; return `${a % 10} + ${b % 10} is ${o}. Write the ${o % 10} and carry 1 ten.`; };
tpl({ id: 'add2-std', skill: 'add2', name: 'two numbers',
  gen: {
    1: r => { const a = ri(r, 10, 88), b = ri(r, 10, 88); return (a % 10 + b % 10 < 10 && a + b < 100) ? { a, b } : null; },
    2: r => { const a = ri(r, 11, 88), b = ri(r, 11, 88); return (a % 10 + b % 10 >= 10 && a + b < 100) ? { a, b } : null; },
    3: r => { const a = ri(r, 25, 99), b = ri(r, 25, 99); return (a % 10 + b % 10 >= 10 && a + b >= 100) ? { a, b } : null; } },
  stem: p => `${p.a} + ${p.b} = ${B}`, ans: p => W(p.a + p.b),
  bugs: [['no-regroup', p => colSumNoCarry(p.a, p.b)], ['both-digits', p => colSumConcat(p.a, p.b)]],
  focus: { 'no-regroup': p => addFocus(p.a, p.b), 'both-digits': p => addFocus(p.a, p.b), default: () => 'Line up tens with tens and ones with ones. Add the ones first.' },
  well: p => (p.a % 10 + p.b % 10 >= 10) ? 'You traded 10 ones for a ten.' : 'You added the ones, then the tens.',
  why: p => (p.a % 10 + p.b % 10 >= 10) ? 'Ten ones make one ten, so the extra ten moves over to the tens.' : 'Adding by place keeps ones with ones and tens with tens.' });

tpl({ id: 'add2-three', skill: 'add2', name: 'three numbers',
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

const nearK = b => 10 - b % 10;
tpl({ id: 'add2-near', skill: 'add2', name: 'near a ten',
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

tpl({ id: 'add2-double', skill: 'add2', name: 'doubles',
  gen: {
    1: r => { const a = ri(r, 11, 44); return a % 10 <= 4 ? { a } : null; },
    2: r => { const a = ri(r, 15, 49); return a % 10 >= 5 ? { a } : null; },
    3: r => ({ a: ri(r, 50, 99) }) },
  stem: p => `${p.a} + ${p.a} = ${B}`, ans: p => W(2 * p.a),
  bugs: [['no-regroup', p => colSumNoCarry(p.a, p.a)], ['both-digits', p => colSumConcat(p.a, p.a)]],
  focus: { 'no-regroup': p => addFocus(p.a, p.a), 'both-digits': p => addFocus(p.a, p.a),
           default: p => `Double the tens (${Math.floor(p.a / 10) * 10} + ${Math.floor(p.a / 10) * 10}), double the ones (${p.a % 10} + ${p.a % 10}), then put them together.` },
  well: () => 'You doubled the tens and the ones.', why: () => 'Doubling means adding a number to itself.' });

/* 3 · Subtracting two-digit numbers */
tpl({ id: 'sub2-std', skill: 'sub2', name: 'take away',
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

tpl({ id: 'sub2-fromten', skill: 'sub2', name: 'from a round number',
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

tpl({ id: 'sub2-chain', skill: 'sub2', name: 'tens, then ones',
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

tpl({ id: 'sub2-diff', skill: 'sub2', name: 'difference between',
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

/* 4 · Adding and subtracting bigger numbers */
tpl({ id: 'as3-add', skill: 'as3', name: 'three-digit adding',
  gen: {
    1: r => { const a = ri(r, 100, 799), b = ri(r, 100, 899 - a + 100); return (carries(a, b) === 0 && a + b <= 999) ? { a, b } : null; },
    2: r => { const a = ri(r, 105, 799), b = ri(r, 105, 799); return (carries(a, b) === 1 && a + b <= 999) ? { a, b } : null; },
    3: r => { const a = ri(r, 118, 699), b = ri(r, 118, 699); return (carries(a, b) === 2 && a + b <= 999) ? { a, b } : null; } },
  stem: p => `${p.a} + ${p.b} = ${B}`, ans: p => W(p.a + p.b), layout: 'column',
  bugs: [['no-regroup', p => colSumNoCarry(p.a, p.b)], ['both-digits', p => colSumConcat(p.a, p.b)]],
  focus: { 'no-regroup': p => { const i = [0, 1, 2].find(k => (digits(p.a)[k] || 0) + (digits(p.b)[k] || 0) >= 10); const s = (digits(p.a)[i] || 0) + (digits(p.b)[i] || 0); return `The ${PLACE[i]} add to ${s}. Keep the ${s % 10} and carry 1 to the ${PLACE[i + 1]}.`; },
           'both-digits': p => { const i = [0, 1, 2].find(k => (digits(p.a)[k] || 0) + (digits(p.b)[k] || 0) >= 10); const s = (digits(p.a)[i] || 0) + (digits(p.b)[i] || 0); return `Only one digit fits in each place. Keep the ${s % 10} in the ${PLACE[i]} and carry the 1.`; },
           default: () => 'Add the ones, then the tens, then the hundreds.' },
  well: p => carries(p.a, p.b) ? 'You carried to the next place.' : 'You added place by place.',
  why: () => 'Each place holds only 0 to 9. Ten of anything moves one place to the left.' });

tpl({ id: 'as3-sub', skill: 'as3', name: 'three-digit take away',
  gen: {
    1: r => { const a = ri(r, 200, 999), b = ri(r, 100, a - 100); return (b >= 100 && borrows(a, b) === 0) ? { a, b } : null; },
    2: r => { const a = ri(r, 211, 989), b = ri(r, 102, a - 50); return (b >= 100 && borrows(a, b) === 1 && digits(a)[1] !== 0) ? { a, b } : null; },
    3: r => { const h = ri(r, 2, 9), o = ri(r, 0, 7), a = h * 100 + o, b = ri(r, 101, a - 20); return (b >= 101 && digits(b)[0] > o && digits(b)[1] > 0) ? { a, b } : null; } },
  stem: p => `${p.a} − ${p.b} = ${B}`, ans: p => W(p.a - p.b), layout: 'column',
  bugs: [['smaller-from-larger', p => colDiff(p.a, p.b)], ['across-zero', p => digits(p.a)[1] === 0 ? p.a - p.b + 100 : -1]],
  focus: { 'across-zero': () => 'There are no tens to trade, so trade 1 hundred for 10 tens first. Then trade 1 ten for 10 ones.',
           'smaller-from-larger': p => { const i = [0, 1, 2].find(k => (digits(p.a)[k] || 0) < (digits(p.b)[k] || 0)); return `In the ${PLACE[i]}, ${digits(p.a)[i]} is less than ${digits(p.b)[i]}, so trade from the next place first.`; },
           default: () => 'Start with the ones. Trade from the next place when the top digit is smaller.' },
  well: p => borrows(p.a, p.b) ? 'You traded from the next place.' : 'You took away place by place.',
  why: p => borrows(p.a, p.b) ? 'Trading 1 of a place for 10 of the place to its right keeps the number the same.' : null });

tpl({ id: 'as3-near', skill: 'as3', name: 'near a hundred',
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

tpl({ id: 'as3-chain', skill: 'as3', name: 'add then take away',
  gen: {
    1: r => { const a = ri(r, 11, 50) * 10, b = ri(r, 1, 30) * 10, c = ri(r, 1, 20) * 10; return ((a % 100 + b % 100) < 100 && (a + b) % 100 >= c % 100 && c < a + b && a + b <= 990) ? { a, b, c } : null; },
    2: r => { const a = ri(r, 11, 50) * 10, b = ri(r, 3, 30) * 10, c = ri(r, 2, 20) * 10; return ((a % 100 + b % 100) >= 100 && c < a + b && a + b <= 990) ? { a, b, c } : null; },
    3: r => { const a = ri(r, 112, 399), b = ri(r, 21, 199), c = ri(r, 12, 149); return (a + b - c >= 10 && a % 10 && b % 10 && c % 10) ? { a, b, c } : null; } },
  stem: p => `${p.a} + ${p.b} − ${p.c} = ${B}`, ans: p => W(p.a + p.b - p.c),
  bugs: [['all-plus', p => p.a + p.b + p.c], ['sign-swap', p => p.a - p.b + p.c]],
  focus: { 'all-plus': p => `Only ${p.b} is added. ${p.c} is taken away.`, 'sign-swap': p => `${p.b} is added and ${p.c} is taken away.`,
           default: p => `Work left to right: ${p.a} + ${p.b} = ${p.a + p.b} first.` },
  well: () => 'You worked left to right.', why: () => 'Going left to right keeps each step small.' });

/* 5 · Multiplication facts */
const SETS = { 1: [2, 5, 10], 2: [3, 4, 6], 3: [7, 8, 9] };
tpl({ id: 'mul-fact', skill: 'mul', name: 'times fact',
  gen: { 1: r => ({ a: ri(r, 1, 12), b: pick(r, SETS[1]), sw: r() < 0.5 }), 2: r => ({ a: ri(r, 2, 12), b: pick(r, SETS[2]), sw: r() < 0.5 }), 3: r => ({ a: ri(r, 3, 12), b: pick(r, SETS[3]), sw: r() < 0.5 }) },
  stem: p => p.sw ? `${p.b} × ${p.a} = ${B}` : `${p.a} × ${p.b} = ${B}`, ans: p => W(p.a * p.b),
  bugs: [['added', p => p.a + p.b], ['off-by-group', p => (p.a - 1) * p.b], ['off-by-group', p => (p.a + 1) * p.b], ['off-by-group', p => p.a * (p.b - 1)], ['off-by-group', p => p.a * (p.b + 1)]],
  focus: { added: p => `Times means groups of. ${p.a} × ${p.b} is ${p.a} groups of ${p.b}.`, 'off-by-group': p => `Count the groups again: ${p.a} groups of ${p.b}.`,
           default: p => `Skip count by ${p.b}, ${p.a} times.` },
  well: () => 'You knew this fact.', why: p => `${p.a} × ${p.b} is ${p.a} groups of ${p.b}. The order can swap and the answer stays the same.` });

tpl({ id: 'mul-factor', skill: 'mul', name: 'missing factor',
  gen: { 1: r => ({ a: ri(r, 2, 12), b: pick(r, SETS[1]), left: r() < 0.5 }), 2: r => ({ a: ri(r, 2, 12), b: pick(r, SETS[2]), left: r() < 0.5 }), 3: r => ({ a: ri(r, 3, 12), b: pick(r, SETS[3]), left: r() < 0.5 }) },
  stem: p => p.left ? `${B} × ${p.b} = ${p.a * p.b}` : `${p.b} × ${B} = ${p.a * p.b}`, ans: p => W(p.a),
  bugs: [['subtracted', p => p.a * p.b - p.b], ['added', p => p.a * p.b + p.b], ['off-by-one', p => p.a - 1], ['off-by-one', p => p.a + 1]],
  focus: { subtracted: p => `Ask: how many groups of ${p.b} make ${p.a * p.b}?`, added: p => `Ask: how many groups of ${p.b} make ${p.a * p.b}?`,
           'off-by-one': p => `Check by multiplying your answer by ${p.b}. It should make ${p.a * p.b}.`, default: p => `Skip count by ${p.b} until you reach ${p.a * p.b}.` },
  well: () => 'You worked backward from the answer.', why: p => `Division undoes times: ${p.a * p.b} ÷ ${p.b} = ${p.a}.` });

tpl({ id: 'mul-skip', skill: 'mul', name: 'skip counting',
  gen: { 1: r => ({ b: pick(r, SETS[1]), k: ri(r, 1, 8) }), 2: r => ({ b: pick(r, SETS[2]), k: ri(r, 1, 8) }), 3: r => ({ b: pick(r, SETS[3]), k: ri(r, 1, 8) }) },
  stem: p => `${p.b * p.k}, ${p.b * (p.k + 1)}, ${p.b * (p.k + 2)}, ${B}`, ans: p => W(p.b * (p.k + 3)),
  bugs: [['counted-by-one', p => p.b * (p.k + 2) + 1], ['off-jump', p => p.b * (p.k + 3) + 1], ['off-jump', p => p.b * (p.k + 3) - 1]],
  focus: { 'counted-by-one': p => `Each jump is ${p.b}. Add ${p.b} to ${p.b * (p.k + 2)}.`, 'off-jump': p => `Each jump is exactly ${p.b}. Add ${p.b} to ${p.b * (p.k + 2)}.`,
           default: p => `Find the jump between numbers (${p.b}) and add it once more.` },
  well: p => `You kept the jumps of ${p.b}.`, why: p => `Counting by ${p.b} lists the ${p.b} times table.` });

tpl({ id: 'mul-double', skill: 'mul', name: 'use a fact you know',
  gen: { 1: r => ({ a: ri(r, 1, 6), b: pick(r, SETS[1]) }), 2: r => ({ a: ri(r, 2, 6), b: pick(r, SETS[2]) }), 3: r => ({ a: ri(r, 2, 6), b: pick(r, SETS[3]) }) },
  stem: p => `${p.a} × ${p.b} = ${p.a * p.b}, so ${2 * p.a} × ${p.b} = ${B}`, ans: p => W(2 * p.a * p.b),
  bugs: [['added-factor', p => p.a * p.b + p.b], ['restated', p => p.a * p.b], ['added-factor', p => p.a * p.b + 2 * p.a]],
  focus: { 'added-factor': p => `${2 * p.a} is double ${p.a}, so double ${p.a * p.b}.`, restated: () => 'The first number doubled, so the answer doubles too.',
           default: p => `Double the answer you know: ${p.a * p.b} + ${p.a * p.b}.` },
  well: () => 'You used a fact you already know.', why: () => 'When one number in a times fact doubles, the answer doubles.' });

/* 6 · Division facts */
tpl({ id: 'div-fact', skill: 'div', name: 'division fact',
  gen: { 1: r => ({ b: pick(r, SETS[1]), q: ri(r, 2, 12) }), 2: r => ({ b: pick(r, SETS[2]), q: ri(r, 2, 12) }), 3: r => ({ b: pick(r, SETS[3]), q: ri(r, 2, 12) }) },
  stem: p => `${p.b * p.q} ÷ ${p.b} = ${B}`, ans: p => W(p.q),
  bugs: [['subtracted', p => p.b * p.q - p.b], ['off-by-one', p => p.q - 1], ['off-by-one', p => p.q + 1], ['multiplied', p => p.b * p.q * p.b]],
  focus: { subtracted: p => `÷ asks how many groups of ${p.b} fit in ${p.b * p.q}.`, multiplied: p => `÷ splits ${p.b * p.q} into groups, so the answer is smaller.`,
           'off-by-one': p => `Check with times: ${p.b} × your answer should make ${p.b * p.q}.`, default: p => `Think: ${p.b} times what makes ${p.b * p.q}?` },
  well: () => 'You knew the times fact behind it.', why: p => `${p.b * p.q} ÷ ${p.b} = ${p.q} because ${p.b} × ${p.q} = ${p.b * p.q}.` });

tpl({ id: 'div-missing', skill: 'div', name: 'missing number in division',
  gen: { 1: r => ({ b: pick(r, SETS[1].concat(SETS[2])), q: ri(r, 2, 10), m: 'divisor' }), 2: r => ({ b: pick(r, SETS[2].concat(SETS[3])), q: ri(r, 2, 10), m: 'divisor' }), 3: r => ({ b: pick(r, [3, 4, 6, 7, 8, 9]), q: ri(r, 2, 10), m: 'dividend' }) },
  stem: p => p.m === 'divisor' ? `${p.b * p.q} ÷ ${B} = ${p.q}` : `${B} ÷ ${p.b} = ${p.q}`, ans: p => W(p.m === 'divisor' ? p.b : p.b * p.q),
  bugs: [['multiplied', p => p.m === 'divisor' ? p.b * p.q * p.q : -1], ['subtracted', p => p.m === 'divisor' ? p.b * p.q - p.q : -1], ['added', p => p.m === 'dividend' ? p.b + p.q : -1]],
  focus: { multiplied: p => `${p.b * p.q} split into groups of what size gives ${p.q} groups?`, subtracted: p => `Think: ${p.q} × what makes ${p.b * p.q}?`,
           added: p => `The missing number is the whole. ${p.q} groups of ${p.b} make it.`,
           default: p => p.m === 'divisor' ? `Think: ${p.q} × what makes ${p.b * p.q}?` : `Multiply to find the whole: ${p.b} × ${p.q}.` },
  well: () => 'You found the missing number.', why: () => 'Times and division undo each other.' });

tpl({ id: 'div-related', skill: 'div', name: 'fact families',
  gen: { 1: r => ({ a: pick(r, SETS[1]), b: ri(r, 2, 10), by: r() < 0.5 ? 'a' : 'b' }), 2: r => ({ a: pick(r, SETS[2]), b: ri(r, 3, 10), by: r() < 0.5 ? 'a' : 'b' }), 3: r => ({ a: pick(r, SETS[3]), b: ri(r, 3, 12), by: r() < 0.5 ? 'a' : 'b' }) },
  stem: p => `${p.a} × ${p.b} = ${p.a * p.b}, so ${p.a * p.b} ÷ ${p.by === 'a' ? p.a : p.b} = ${B}`, ans: p => W(p.by === 'a' ? p.b : p.a),
  bugs: [['restated', p => p.a * p.b], ['gave-divisor', p => p.by === 'a' ? p.a : p.b]],
  focus: { restated: p => `${p.a * p.b} is the total. The answer is the other number in the times fact.`, 'gave-divisor': p => `You're dividing by ${p.by === 'a' ? p.a : p.b}. The answer is the other number.`,
           default: () => 'Look for the other number in the times fact.' },
  well: () => 'You used the times fact.', why: () => 'One times fact gives two division facts.' });

tpl({ id: 'div-tens', skill: 'div', name: 'dividing tens',
  gen: { 1: r => ({ b: pick(r, SETS[1]), q: ri(r, 2, 9) }), 2: r => ({ b: pick(r, SETS[2]), q: ri(r, 2, 9) }), 3: r => ({ b: pick(r, SETS[3]), q: ri(r, 2, 9) }) },
  stem: p => `${p.b * p.q * 10} ÷ ${p.b} = ${B}`, ans: p => W(p.q * 10),
  bugs: [['dropped-zero', p => p.q], ['extra-zero', p => p.q * 100]],
  focus: { 'dropped-zero': p => `${p.b * p.q * 10} is ${p.b * p.q} tens, so the answer is tens too.`, 'extra-zero': p => `${p.b * p.q * 10} is ${p.b * p.q} tens. ${p.b * p.q} tens ÷ ${p.b} = ${p.q} tens.`,
           default: p => `Think ${p.b * p.q} ÷ ${p.b}, then remember they're tens.` },
  well: () => 'You kept track of the tens.', why: p => `${p.b * p.q * 10} ÷ ${p.b} is ${p.b * p.q} tens ÷ ${p.b}, which is ${p.q} tens.` });

/* 7 · Multiplying by one digit */
function mulNoCarryConcat(a, c) { return Number(digits(a).slice().reverse().map(d => String(d * c)).join('')); }
function mulCarryBefore(a, c) { const ds = digits(a); let res = [], carry = 0; for (let i = 0; i < ds.length; i++) { const v = (ds[i] + carry) * c; res.push(v % 10); carry = Math.floor(v / 10); } if (carry) res.push(...digits(carry)); return fromDigits(res); }
const firstCarry = (a, c) => { const ds = digits(a); for (let i = 0; i < ds.length; i++) if (ds[i] * c >= 10) return i; return -1; };
const mdmFocus = p => { const i = firstCarry(p.a, p.c); if (i < 0) return 'Multiply each digit by ' + p.c + '.'; const d = digits(p.a)[i], v = d * p.c; return `${d} × ${p.c} = ${v}. Write the ${v % 10} and carry ${Math.floor(v / 10)} to add after the next place is multiplied.`; };
tpl({ id: 'mdm-std', skill: 'mdm', name: 'two-digit times one digit',
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

tpl({ id: 'mdm-col', skill: 'mdm', name: 'column multiplying', layout: 'column',
  gen: {
    1: r => { const a = ri(r, 11, 44), c = ri(r, 2, 3); return firstCarry(a, c) < 0 ? { a, c } : null; },
    2: r => { const a = ri(r, 13, 39), c = ri(r, 3, 7); return (digits(a)[0] * c >= 10 && a * c < 200) ? { a, c } : null; },
    3: r => { const a = ri(r, 102, 329), c = ri(r, 2, 4); return (firstCarry(a, c) >= 0 && a * c < 1000) ? { a, c } : null; } },
  stem: p => `${p.a} × ${p.c} = ${B}`, ans: p => W(p.a * p.c),
  bugs: [['no-carry', p => mulNoCarryConcat(p.a, p.c)], ['carry-before', p => mulCarryBefore(p.a, p.c)]],
  focus: { 'no-carry': mdmFocus, 'carry-before': () => 'Multiply the next digit first, then add the number you carried.', default: () => 'Start with the ones. Multiply each digit, carrying when you pass 9.' },
  well: p => firstCarry(p.a, p.c) >= 0 ? 'You carried in the right place.' : 'You multiplied each column.',
  why: () => 'Each digit is multiplied by the same number, and the place values carry just like in adding.' });

tpl({ id: 'mdm-tens', skill: 'mdm', name: 'multiples of ten',
  gen: { 1: r => ({ t: ri(r, 2, 5) * 10, c: ri(r, 2, 4) }), 2: r => ({ t: ri(r, 3, 9) * 10, c: ri(r, 5, 9) }), 3: r => ({ t: ri(r, 2, 9) * 100, c: ri(r, 2, 9) }) },
  stem: p => `${p.t} × ${p.c} = ${B}`, ans: p => W(p.t * p.c),
  bugs: [['dropped-zero', p => p.t * p.c / 10], ['extra-zero', p => p.t * p.c * 10]],
  focus: { 'dropped-zero': p => { const u = p.t >= 100 ? 100 : 10, w = u === 100 ? 'hundreds' : 'tens'; return `${p.t} is ${p.t / u} ${w}. ${p.t / u} × ${p.c} = ${p.t / u * p.c}, so it's ${p.t / u * p.c} ${w}.`; },
           'extra-zero': p => { const u = p.t >= 100 ? 100 : 10, w = u === 100 ? 'hundreds' : 'tens'; return `${p.t / u} × ${p.c} = ${p.t / u * p.c}, and those are ${w}.`; },
           default: p => { const u = p.t >= 100 ? 100 : 10; return `Use the fact ${p.t / u} × ${p.c}, then think about the place.`; } },
  well: () => 'You used the basic fact.', why: p => { const u = p.t >= 100 ? 100 : 10; return `${p.t} × ${p.c} is ${p.t / u} × ${p.c} ${u === 100 ? 'hundreds' : 'tens'}.`; } });

tpl({ id: 'mdm-split', skill: 'mdm', name: 'split it up',
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

/* 8 · Missing numbers */
tpl({ id: 'mn-add', skill: 'mn', name: 'missing addend',
  gen: { 1: r => { const a = ri(r, 2, 9), s = ri(r, 11, 18); return s - a >= 2 ? { a, s, left: false } : null; },
         2: r => { const a = ri(r, 12, 58), s = ri(r, 31, 99); return s - a >= 10 ? { a, s, left: false } : null; },
         3: r => { const a = ri(r, 12, 58), s = ri(r, 31, 99); return s - a >= 10 ? { a, s, left: true } : null; } },
  stem: p => p.left ? `${B} + ${p.a} = ${p.s}` : `${p.a} + ${B} = ${p.s}`, ans: p => W(p.s - p.a),
  bugs: [['added-all', p => p.a + p.s], ['smaller-from-larger', p => colDiff(p.s, p.a)]],
  focus: { 'added-all': p => `${p.s} is the total. Take ${p.a} away from ${p.s} to find the missing part.`, 'smaller-from-larger': p => `To find ${p.s} − ${p.a}, trade a ten when the ones are too small.`,
           default: p => `Count up from ${p.a} to ${p.s}.` },
  well: () => 'You found the missing part.', why: () => 'Adding and subtracting undo each other, so subtracting finds a missing part.' });

tpl({ id: 'mn-sub', skill: 'mn', name: 'missing in take away',
  gen: { 1: r => { const a = ri(r, 11, 18), x = ri(r, 2, 9); return a - x >= 2 ? { a, x, m: 'sub' } : null; },
         2: r => { const a = ri(r, 34, 99), x = ri(r, 12, a - 11); return { a, x, m: 'sub' }; },
         3: r => { const b = ri(r, 12, 49), res = ri(r, 12, 49); return { a: b + res, x: b, m: 'start', res }; } },
  stem: p => p.m === 'sub' ? `${p.a} − ${B} = ${p.a - p.x}` : `${B} − ${p.x} = ${p.res}`, ans: p => W(p.m === 'sub' ? p.x : p.a),
  bugs: [['added', p => p.m === 'sub' ? p.a + (p.a - p.x) : -1], ['subtracted-instead', p => p.m === 'start' ? Math.abs(p.res - p.x) : -1]],
  focus: { added: p => `${p.a} take away the missing number leaves ${p.a - p.x}. So the missing number is ${p.a} − ${p.a - p.x}.`,
           'subtracted-instead': p => `The missing number is where it started. Add back what was taken: ${p.res} + ${p.x}.`,
           default: p => p.m === 'sub' ? `Ask: what do I take from ${p.a} to leave ${p.a - p.x}?` : `Add ${p.res} and ${p.x} to find where it started.` },
  well: () => 'You worked out the missing number.', why: () => 'You can check any take-away by adding back.' });

tpl({ id: 'mn-muldiv', skill: 'mn', name: 'missing in times and divide',
  gen: { 1: r => ({ b: pick(r, [2, 3, 4, 5, 10]), q: ri(r, 2, 10), m: 'mul' }), 2: r => ({ b: pick(r, [3, 4, 5, 6, 8]), q: ri(r, 2, 10), m: 'div' }), 3: r => ({ b: pick(r, [3, 4, 6, 7, 8, 9]), q: ri(r, 2, 10), m: 'start' }) },
  stem: p => p.m === 'mul' ? `${p.b} × ${B} = ${p.b * p.q}` : p.m === 'div' ? `${p.b * p.q} ÷ ${B} = ${p.b}` : `${B} ÷ ${p.b} = ${p.q}`,
  ans: p => W(p.m === 'start' ? p.b * p.q : p.q),
  bugs: [['subtracted', p => p.m === 'mul' ? p.b * p.q - p.b : -1], ['multiplied', p => p.m === 'div' ? p.b * p.q * p.b : -1], ['added', p => p.m === 'start' ? p.b + p.q : -1]],
  focus: { subtracted: p => `How many groups of ${p.b} make ${p.b * p.q}?`, multiplied: p => `${p.b * p.q} split into groups of what size gives ${p.b}?`, added: p => `The missing number is the whole: ${p.q} groups of ${p.b}.`,
           default: p => p.m === 'start' ? `Multiply to find the whole: ${p.b} × ${p.q}.` : `Use the times fact that has ${p.b * p.q} in it.` },
  well: () => 'You used the fact family.', why: () => 'Times and division undo each other.' });

tpl({ id: 'mn-balance', skill: 'mn', name: 'balance both sides',
  gen: { 1: r => { const a = ri(r, 2, 9), b = ri(r, 2, 9), c = ri(r, 1, 9); return a + b - c >= 1 ? { L: a + b, ls: `${a} + ${b}`, c, op: '+' } : null; },
         2: r => { const a = ri(r, 12, 45), b = ri(r, 3, 9), c = ri(r, 5, 25); return a + b - c >= 2 ? { L: a + b, ls: `${a} + ${b}`, c, op: '+' } : null; },
         3: r => { const a = ri(r, 3, 8), b = ri(r, 3, 8), c = ri(r, 2, 15); const L = a * b; return L - c >= 2 ? { L, ls: `${a} × ${b}`, c, op: '+' } : null; } },
  stem: p => `${p.ls} = ${B} + ${p.c}`, ans: p => W(p.L - p.c),
  bugs: [['left-total', p => p.L], ['running-total', p => p.L + p.c]],
  focus: { 'left-total': p => `= means both sides are equal. What plus ${p.c} makes ${p.L}?`, 'running-total': p => `Don't add ${p.c}. Find the number that goes with ${p.c} to make ${p.L}.`,
           default: p => `Work out the left side first (${p.L}), then find what goes with ${p.c}.` },
  well: () => 'You balanced both sides.', why: () => 'The equals sign means both sides have the same value.' });

/* 9 · Naming and comparing fractions */
tpl({ id: 'uf-name', skill: 'uf', name: 'name the parts', kind: 'fraction',
  gen: { 1: r => ({ n: 1, d: ri(r, 2, 12) }), 2: r => { const d = ri(r, 3, 12), n = ri(r, 2, d - 1); return { n, d }; }, 3: r => { const d = ri(r, 2, 8), n = ri(r, d + 1, 2 * d - 1); return { n, d }; } },
  stem: p => p.n === 1 ? `A whole is cut into ${p.d} equal parts. Write one part as a fraction.  ${B}` : p.n < p.d ? `A whole is cut into ${p.d} equal parts. Write ${p.n} parts as a fraction.  ${B}` : `Each whole is cut into ${p.d} equal parts. Write ${p.n} parts as a fraction.  ${B}`,
  ans: p => R(p.n, p.d),
  bugs: [['swapped', p => R(p.d, p.n)], ['counted-rest', p => p.n < p.d && p.n > 1 ? R(p.d - p.n, p.d) : { n: -1, d: 1 }]],
  focus: { swapped: p => `The bottom number counts the equal parts in one whole (${p.d}). The top counts the parts you have (${p.n}).`, 'counted-rest': p => `Count the parts you're writing (${p.n}), not the ones left over.`,
           default: () => 'The bottom number is how many equal parts make one whole.' },
  well: () => 'You named the parts.', why: p => `${p.n}/${p.d} means ${p.n} part${p.n > 1 ? 's' : ''}, each 1/${p.d} of a whole.`,
  lock: (p, a) => `${p.n} part${p.n > 1 ? 's' : ''} of size 1/${p.d} = ${p.n}/${p.d}` });

const cmpPick = (x, y, which) => (which === 'larger') === (x.n * y.d > y.n * x.d) ? x : y;
tpl({ id: 'uf-cmp-unit', skill: 'uf', name: 'compare unit fractions', kind: 'fraction',
  gen: { 1: r => { const a = ri(r, 2, 8), b = ri(r, 2, 8); return a !== b ? { x: R(1, a), y: R(1, b), which: 'larger' } : null; },
         2: r => { const a = ri(r, 2, 12), b = ri(r, 2, 12); return a !== b ? { x: R(1, a), y: R(1, b), which: pick(r, ['larger', 'smaller']) } : null; },
         3: r => { const n = ri(r, 2, 5), a = ri(r, n + 1, 12), b = ri(r, n + 1, 12); return (a !== b && gcd(n, a) === 1 && gcd(n, b) === 1) ? { x: { n, d: a }, y: { n, d: b }, which: pick(r, ['larger', 'smaller']) } : null; } },
  stem: p => `Which is ${p.which}: ${fmtR(p.x)} or ${fmtR(p.y)}?  ${B}`, ans: p => cmpPick(p.x, p.y, p.which),
  bugs: [['picked-other', p => { const c = cmpPick(p.x, p.y, p.which); return c === p.x ? p.y : p.x; }]],
  focus: { 'picked-other': p => `More equal parts means each part is smaller. ${p.x.n}/${Math.min(p.x.d, p.y.d)} has fewer, bigger parts.`,
           default: () => 'Compare the size of the parts: fewer parts means bigger parts.' },
  well: () => 'You compared the size of the parts.', why: () => 'With the same top number, fewer parts in a whole means each part is bigger.',
  lock: (p, a) => `${fmtR(a)} is ${p.which}.` });

tpl({ id: 'uf-cmp-same', skill: 'uf', name: 'compare same-size parts', kind: 'fraction',
  gen: { 1: r => { const d = ri(r, 3, 8), a = ri(r, 1, d - 1), b = ri(r, 1, d - 1); return a !== b ? { x: { n: a, d }, y: { n: b, d }, which: 'larger' } : null; },
         2: r => { const d = ri(r, 5, 12), a = ri(r, 1, d - 1), b = ri(r, 1, d - 1); return a !== b ? { x: { n: a, d }, y: { n: b, d }, which: pick(r, ['larger', 'smaller']) } : null; },
         3: r => { const d = pick(r, [4, 6, 8, 10, 12]), n = ri(r, 1, d - 1); return n * 2 !== d ? { x: { n: 1, d: 2 }, y: { n, d }, which: pick(r, ['larger', 'smaller']), half: true } : null; } },
  stem: p => `Which is ${p.which}: ${p.x.n}/${p.x.d} or ${p.y.n}/${p.y.d}?  ${B}`, ans: p => cmpPick(p.x, p.y, p.which),
  bugs: [['picked-other', p => { const c = cmpPick(p.x, p.y, p.which); return c === p.x ? p.y : p.x; }]],
  focus: { 'picked-other': p => p.half ? `Half of ${p.y.d} is ${p.y.d / 2}. Is ${p.y.n} more or less than ${p.y.d / 2}?` : `The parts are the same size, so more parts means more.`,
           default: p => p.half ? `Half of ${p.y.d} is ${p.y.d / 2}. Compare ${p.y.n} with ${p.y.d / 2}.` : 'Same-size parts: compare the top numbers.' },
  well: p => p.half ? 'You compared with one half.' : 'You compared same-size parts.',
  why: p => p.half ? `1/2 is the same as ${p.y.d / 2}/${p.y.d}.` : 'When the bottom numbers match, the parts are the same size.',
  lock: (p, a) => `${a.n}/${a.d === p.x.d && a.n === p.x.n ? p.x.d : p.y.d} is ${p.which}.`.replace(/^(\d+)\/(\d+)/, (m, n, d) => fmtR(R(+n, +d)) === fmtR(a) ? `${n}/${d}` : fmtR(a)) });

tpl({ id: 'uf-of', skill: 'uf', name: 'fraction of a number',
  gen: { 1: r => { const d = ri(r, 2, 5), k = ri(r, 2, 6); return { n: 1, d, N: d * k }; }, 2: r => { const d = ri(r, 3, 10), k = ri(r, 3, 9); return d * k <= 60 ? { n: 1, d, N: d * k } : null; }, 3: r => { const d = ri(r, 3, 8), n = ri(r, 2, d - 1), k = ri(r, 2, 8); return { n, d, N: d * k }; } },
  stem: p => `What is ${p.n}/${p.d} of ${p.N}?  ${B}`, ans: p => W(p.n * p.N / p.d),
  bugs: [['unit-only', p => p.n > 1 ? p.N / p.d : -1], ['multiplied', p => p.N * p.d], ['subtracted', p => p.N - p.d]],
  focus: { 'unit-only': p => `1/${p.d} of ${p.N} is ${p.N / p.d}. You need ${p.n} of those.`, multiplied: p => `Finding 1/${p.d} means splitting ${p.N} into ${p.d} equal groups, so it gets smaller.`,
           subtracted: p => `Split ${p.N} into ${p.d} equal groups instead of taking ${p.d} away.`, default: p => `Split ${p.N} into ${p.d} equal groups.` },
  well: () => 'You split it into equal groups.', why: p => `1/${p.d} of ${p.N} is ${p.N} ÷ ${p.d}.` });

/* 10 · Equivalent fractions — improper · scale · lowest · mixed */
tpl({ id: 'eq-scale', skill: 'eq', name: 'missing part of an equal fraction',
  gen: { 1: r => { const b = ri(r, 2, 8), a = ri(r, 1, b - 1); return gcd(a, b) === 1 ? { a, b, k: 2, top: true } : null; },
         2: r => { const b = ri(r, 2, 8), a = ri(r, 1, b - 1), k = ri(r, 3, 5); return gcd(a, b) === 1 ? { a, b, k, top: true } : null; },
         3: r => { const b = ri(r, 3, 9), a = ri(r, 1, b - 1), k = ri(r, 2, 6); return gcd(a, b) === 1 ? { a, b, k, top: false } : null; } },
  stem: p => p.top ? `${p.a}/${p.b} = ${B}/${p.b * p.k}` : `${p.a}/${p.b} = ${p.a * p.k}/${B}`, ans: p => W(p.top ? p.a * p.k : p.b * p.k),
  bugs: [['added-difference', p => p.top ? p.a + p.b * p.k - p.b : p.b + p.a * p.k - p.a], ['copied', p => p.top ? p.a : p.b]],
  focus: { 'added-difference': p => p.top ? `The bottom went from ${p.b} to ${p.b * p.k}. That's × ${p.k}, so multiply the top by ${p.k} too.` : `The top went from ${p.a} to ${p.a * p.k}. That's × ${p.k}, so multiply the bottom by ${p.k} too.`,
           copied: () => 'Equal fractions change both numbers by the same multiple.',
           default: () => 'Find what one number was multiplied by, and multiply the other by the same.' },
  well: () => 'You scaled the top and bottom the same.', why: () => 'Multiplying the top and bottom by the same number makes an equal fraction.' });

tpl({ id: 'eq-lowest', skill: 'eq', name: 'lowest terms', kind: 'fraction', form: 'lowest',
  gen: { 1: r => { const s = ri(r, 3, 9), q = ri(r, 1, s - 1); return gcd(q, s) === 1 ? { q, s, g: 2 } : null; },
         2: r => { const s = ri(r, 2, 7), q = ri(r, 1, s - 1), g = ri(r, 3, 5); return gcd(q, s) === 1 ? { q, s, g } : null; },
         3: r => { const s = ri(r, 2, 6), q = ri(r, 1, 11), g = pick(r, [4, 6, 8]); return (gcd(q, s) === 1 && q !== s) ? { q, s, g } : null; } },
  stem: p => `Write ${p.q * p.g}/${p.s * p.g} in lowest terms.  ${B}`, ans: p => R(p.q, p.s),
  bugs: [['top-only', p => R(p.q, p.s * p.g)], ['bottom-only', p => R(p.q * p.g, p.s)]],
  focus: { 'top-only': p => `Divide the top and the bottom by the same number, ${p.g}.`, 'bottom-only': p => `Divide the top and the bottom by the same number, ${p.g}.`,
           default: p => `Find the biggest number that divides both ${p.q * p.g} and ${p.s * p.g}.` },
  well: () => 'You found the simplest form.', why: p => `${p.q * p.g}/${p.s * p.g} and ${p.q}/${p.s} are the same amount. ${p.q}/${p.s} uses the fewest pieces.`,
  lock: (p, a) => `${p.q * p.g}/${p.s * p.g} = ${fmtR(a)}` });

tpl({ id: 'eq-improper', skill: 'eq', name: 'mixed to one fraction', kind: 'fraction', form: 'improper',
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

tpl({ id: 'eq-mixed', skill: 'eq', name: 'one fraction to mixed', kind: 'fraction', form: 'mixed',
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

/* 11 · Adding and subtracting fractions */
tpl({ id: 'af-add', skill: 'af', name: 'add fractions', kind: 'fraction',
  gen: { 1: r => { const d = ri(r, 3, 8), a = ri(r, 1, d - 2), b = ri(r, 1, d - 1 - a); return b >= 1 ? { a, b, d } : null; },
         2: r => { const d = ri(r, 6, 12), a = ri(r, 1, d - 1), b = ri(r, 1, d - a); return b >= 1 ? { a, b, d } : null; },
         3: r => { const d = ri(r, 3, 10), a = ri(r, 1, d - 1), b = ri(r, 1, d - 1); return a + b > d ? { a, b, d } : null; } },
  stem: p => `${p.a}/${p.d} + ${p.b}/${p.d} = ${B}`, ans: p => R(p.a + p.b, p.d),
  bugs: [['added-denominators', p => R(p.a + p.b, 2 * p.d)]],
  focus: { 'added-denominators': p => `The parts are ${p.d}ths. Adding them doesn't change the part size, so the bottom stays ${p.d}.`, default: p => `Add the tops. Keep the bottom as ${p.d}.` },
  well: () => 'You kept the same-size parts.', why: p => `${p.a}/${p.d} + ${p.b}/${p.d} is ${p.a} + ${p.b} parts of size 1/${p.d}.` });

tpl({ id: 'af-sub', skill: 'af', name: 'subtract fractions', kind: 'fraction',
  gen: { 1: r => { const d = ri(r, 3, 8), a = ri(r, 2, d - 1), b = ri(r, 1, a - 1); return { a, b, d, w: 0 }; },
         2: r => { const d = ri(r, 6, 12), a = ri(r, 2, d - 1), b = ri(r, 1, a - 1); return { a, b, d, w: 0 }; },
         3: r => { const d = ri(r, 3, 10), w = ri(r, 1, 2), b = ri(r, 1, d - 1); return { a: w * d, b, d, w }; } },
  stem: p => p.w ? `${p.w} − ${p.b}/${p.d} = ${B}` : `${p.a}/${p.d} − ${p.b}/${p.d} = ${B}`, ans: p => R(p.a - p.b, p.d),
  bugs: [['added', p => R(p.a + p.b, p.d)], ['forgot-whole', p => p.w === 2 ? R(p.d - p.b, p.d) : { n: -1, d: 1 }], ['took-from-one', p => p.w ? R(p.b - 1 >= 0 ? p.b - 1 : 0, p.d) : { n: -1, d: 1 }]],
  focus: { added: () => 'This is take-away, so the answer is smaller.', 'forgot-whole': p => `2 is ${2 * p.d}/${p.d}. Take ${p.b}/${p.d} from that.`,
           'took-from-one': p => `${p.w} is ${p.w * p.d}/${p.d}. Take ${p.b}/${p.d} from that.`, default: p => p.w ? `${p.w} is ${p.w * p.d}/${p.d}. Take ${p.b}/${p.d} from that.` : `Take away the tops. Keep the bottom as ${p.d}.` },
  well: p => p.w ? 'You turned the whole into parts.' : 'You took away same-size parts.',
  why: p => p.w ? `One whole is ${p.d}/${p.d}.` : 'The parts are the same size, so only the count of parts changes.' });

tpl({ id: 'af-missing', skill: 'af', name: 'missing part of a sum',
  gen: { 1: r => { const d = ri(r, 4, 9), a = ri(r, 1, d - 2), s = ri(r, a + 1, d - 1); return { a, s, d, m: 'add' }; },
         2: r => { const d = ri(r, 5, 12), s = ri(r, 3, d - 1), a = ri(r, 1, s - 1); return { a, s, d, m: 'sub' }; },
         3: r => { const d = ri(r, 3, 12), a = ri(r, 1, d - 1); return { a, s: d, d, m: 'one' }; } },
  stem: p => p.m === 'add' ? `${p.a}/${p.d} + ${B}/${p.d} = ${p.s}/${p.d}` : p.m === 'sub' ? `${p.s}/${p.d} − ${B}/${p.d} = ${p.a}/${p.d}` : `${p.a}/${p.d} + ${B}/${p.d} = 1`,
  ans: p => W(p.s - p.a),
  bugs: [['added', p => p.a + p.s], ['used-denominator', p => p.m === 'one' ? p.d : -1]],
  focus: { added: p => `The total is ${p.s}/${p.d}. What goes with ${p.a}/${p.d} to make it?`, 'used-denominator': p => `1 whole is ${p.d}/${p.d}. What goes with ${p.a} to make ${p.d}?`,
           default: p => p.m === 'one' ? `1 whole is ${p.d}/${p.d}.` : 'The parts are the same size, so work with the top numbers.' },
  well: () => 'You found the missing part.', why: () => 'With same-size parts, you only need to count parts.' });

tpl({ id: 'af-three', skill: 'af', name: 'three fractions', kind: 'fraction',
  gen: { 1: r => { const d = ri(r, 5, 10), a = ri(r, 1, 3), b = ri(r, 1, 3), c = ri(r, 1, 3); return a + b + c < d ? { a, b, c, d, op: '+' } : null; },
         2: r => { const d = ri(r, 5, 12), a = ri(r, 1, d - 1), b = ri(r, 1, d - 1), c = ri(r, 1, d - 1); return (a + b - c > 0 && a + b - c < d && a + b <= d + 3) ? { a, b, c, d, op: '−' } : null; },
         3: r => { const d = ri(r, 3, 8), a = ri(r, 1, d - 1), b = ri(r, 1, d - 1), c = ri(r, 1, d - 1); return a + b + c > d ? { a, b, c, d, op: '+' } : null; } },
  stem: p => `${p.a}/${p.d} + ${p.b}/${p.d} ${p.op} ${p.c}/${p.d} = ${B}`, ans: p => R(p.op === '+' ? p.a + p.b + p.c : p.a + p.b - p.c, p.d),
  bugs: [['added-denominators', p => R(p.op === '+' ? p.a + p.b + p.c : p.a + p.b - p.c, 3 * p.d)], ['all-plus', p => p.op === '−' ? R(p.a + p.b + p.c, p.d) : { n: -1, d: 1 }]],
  focus: { 'added-denominators': p => `The parts are all ${p.d}ths, so the bottom stays ${p.d}.`, 'all-plus': p => `The last ${p.c}/${p.d} is taken away.`,
           default: p => `Work with the top numbers. The bottom stays ${p.d}.` },
  well: () => 'You kept all the parts the same size.', why: () => 'Same-size parts can be counted together.' });

const TPL = Object.fromEntries(T.map(t => [t.id, t]));
const TPL_BY_SKILL = Object.fromEntries(SKILLS.map(s => [s.id, T.filter(t => t.skill === s.id)]));

/* ---------- pools: deterministic, snapshotted, counted after filters ---------- */
const POOLS = {};
function itemKey(t, step, p) { return `${t.id}@${t.ver}#${step}:${JSON.stringify(p)}`; }
function buildPool(t, step) {
  const r = rng(hashStr(`${t.id}@${t.ver}#${step}`)); const seen = new Set(), out = [];
  for (let i = 0; i < 4000 && out.length < CONFIG.POOL_CAP; i++) {
    const p = t.gen[step](r); if (!p) continue;
    const a = t.ans(p); if (!a || a.n < 0) continue;
    if (t.form === 'mixed' && a.d === 1) continue;          // mixed answers never come out whole
    const k = itemKey(t, step, p); if (seen.has(k)) continue; seen.add(k); out.push({ key: k, p });
  }
  return out;
}
function pool(tid, step) { const k = tid + '#' + step; return POOLS[k] || (POOLS[k] = buildPool(TPL[tid], step)); }

/* bug values for one concrete item; a bug that equals the right value (after canonicalizing) doesn't apply to this item */
function bugsFor(t, p) {
  const a = t.ans(p), out = [];
  for (const [tag, f] of t.bugs) {
    let v = f(p); if (v == null) continue; if (typeof v === 'number') { if (v < 0 || !Number.isFinite(v)) continue; v = R(v); }
    if (v.n < 0 || v.d <= 0) continue; if (eqR(v, a)) continue; out.push({ tag, v });
  }
  return out;
}

/* ---------- answer parsing: one grammar, used for pre-check and authority ---------- */
function parseAnswer(raw, kind) {
  const s = String(raw || '').trim().replace(/,/g, '').replace(/\s+/g, ' ');
  if (!s) return { ok: false, reason: 'empty' };
  if (/^\d+$/.test(s)) return { ok: true, value: R(+s), form: 'whole', parts: { w: +s, n: 0, d: 1 } };
  if (kind === 'whole') return { ok: false, reason: 'not-whole' };
  let m;
  if ((m = s.match(/^(\d+) ?\/ ?(\d+)$/))) { const n = +m[1], d = +m[2]; if (!d) return { ok: false, reason: 'zero-denominator' }; return { ok: true, value: R(n, d), form: n >= d ? 'improper' : 'proper', parts: { w: 0, n, d } }; }
  if ((m = s.match(/^(\d+) (\d+) ?\/ ?(\d+)$/))) { const w = +m[1], n = +m[2], d = +m[3]; if (!d) return { ok: false, reason: 'zero-denominator' }; return { ok: true, value: R(w * d + n, d), form: n >= d || n === 0 ? 'mixed-odd' : 'mixed', parts: { w, n, d } }; }
  return { ok: false, reason: 'unreadable' };
}
function formOk(pa, req) {
  if (req === 'any') return true;
  if (req === 'lowest') { if (pa.form === 'whole') return true; if (pa.form === 'mixed-odd') return false; return gcd(pa.parts.n, pa.parts.d) === 1; }
  if (req === 'improper') return pa.form === 'improper' || pa.form === 'proper';
  if (req === 'mixed') return pa.form === 'mixed';
  return true;
}
function typedText(pa) { const { w, n, d } = pa.parts; if (pa.form === 'whole') return String(w); return (w ? w + ' ' : '') + n + '/' + d; }

/* ---------- time ---------- */
function dayKey(ms) { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function dayDiff(a, b) { const pa = a.split('-').map(Number), pb = b.split('-').map(Number); return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 864e5); }
const DAY = 864e5;

/* ---------- the server ---------- */
function freshState(name, grade) {
  return { v: 1, child: { name: name || 'Leo', grade: grade || 3, seed: hashStr((name || 'Leo') + ':' + Date.now()) }, dayOffset: 0, seq: 0,
           issued: [], attempts: [], rejects: [], events: [], ledger: [], sessions: [], bandLog: [], dev: { alwaysOfferLanes: false, focusOverride: null } };
}

function createServer(state, clock) {
  const S = state;
  const now = () => (clock ? clock() : Date.now()) + S.dayOffset * DAY;
  const nextId = pfx => pfx + '_' + (++S.seq).toString(36);
  const today = () => dayKey(now());

  /* ----- learner state: a pure replay of stored evidence ----- */
  function replaySkill(sid) {
    let step = 1, maxStep = 1, run = 0, recent = []; const win = [], levelUps = [];
    for (const a of S.attempts) {
      if (a.skill !== sid || !a.countsForBand) continue;
      win.push(a); if (win.length > CONFIG.BAND_WINDOW) win.shift();
      if (a.lane === 'review') continue;
      if (a.step >= step) run = a.correct ? run + 1 : 0;
      if (a.step === step) { recent.push(a.correct); if (recent.length > CONFIG.STEP_DOWN_WINDOW) recent.shift(); }
      if (run >= CONFIG.STEP_UP_RUN && step < 3) { step++; run = 0; recent = []; if (step > maxStep) { maxStep = step; levelUps.push({ iid: a.iid, step }); } }
      else if (recent.filter(x => !x).length >= CONFIG.STEP_DOWN_MISSES && step > 1) { step--; run = 0; recent = []; }
    }
    return { step, maxStep, levelUps, win, band: bandOf(win), n: win.length };
  }
  function bandOf(win) {
    const n = win.length; if (n < CONFIG.BAND_MIN) return 'Still learning';
    const acc = win.filter(a => a.correct).length / n;
    const lastRun = win.slice(-CONFIG.GOT_IT_RUN).every(a => a.correct);
    const stretch = win.some(a => a.correct && a.step >= 2 && a.lane !== 'review');
    if (n >= CONFIG.BAND_WINDOW && acc >= CONFIG.GOT_IT && lastRun && stretch) return 'Got it';
    return acc >= CONFIG.GETTING_IT ? 'Getting it' : 'Still learning';
  }
  const RANK = { 'Still learning': 0, 'Getting it': 1, 'Got it': 2 };

  function unlocked(sid) {
    const sk = SKILL[sid];
    if (sk.grade <= S.child.grade) return true;
    if (S.attempts.some(a => a.skill === sid)) return true;
    return sk.prereq.every(p => RANK[replaySkill(p).band] >= 1);
  }
  const unlockedSkills = () => SKILLS.filter(s => unlocked(s.id)).map(s => s.id);

  /* ----- focus: the only skill chooser ----- */
  function chooseFocus() {
    if (S.dev.focusOverride && SKILL[S.dev.focusOverride]) return S.dev.focusOverride;
    const us = unlockedSkills();
    const last = S.sessions.filter(s => s.attempted > 0).slice(-1)[0];
    if (last && us.includes(last.focus)) {
      const cur = replaySkill(last.focus);
      const streak = []; for (let i = S.sessions.length - 1; i >= 0 && S.sessions[i].focus === last.focus; i--) if (S.sessions[i].attempted > 0) streak.push(S.sessions[i]);
      const moved = streak.length && RANK[cur.band] > RANK[streak[streak.length - 1].bandAtStart];
      if (cur.band !== 'Got it' && (streak.length < CONFIG.FOCUS_MAX_SESSIONS || moved)) return last.focus;
    }
    const recentFocus = S.sessions.slice(-3).map(s => s.focus);
    const scored = us.map((sid, i) => ({ sid, i, r: RANK[replaySkill(sid).band], recent: recentFocus.includes(sid) ? 1 : 0, prereqOk: SKILL[sid].prereq.every(p => !us.includes(p) || RANK[replaySkill(p).band] >= 1) ? 0 : 1 }));
    scored.sort((a, b) => a.r - b.r || a.prereqOk - b.prereqOk || a.recent - b.recent || a.i - b.i);
    return scored[0].sid;
  }
  function mixSkillsFor(focus, count) {
    const us = unlockedSkills().filter(s => s !== focus);
    const lastSeen = sid => { let t = -1; for (const it of S.issued) if (it.skill === sid && it.shownAt > t) t = it.shownAt; return t; };
    us.sort((a, b) => lastSeen(a) - lastSeen(b) || SKILLS.findIndex(s => s.id === a) - SKILLS.findIndex(s => s.id === b));
    const out = []; for (let i = 0; i < count; i++) if (us.length) out.push(us[i % us.length]);
    return out;
  }

  /* ----- lanes ----- */
  function reviewUsedThisWeek() { const t = now(); return S.sessions.filter(s => s.lane === 'review' && t - s.startedAt < 7 * DAY).length; }
  function laneOffer(focus) {
    if (S.dev.alwaysOfferLanes) return true;
    const b = replaySkill(focus).band; const last = S.sessions.slice(-1)[0];
    return b !== 'Still learning' || !!(last && last.leveledUp);
  }

  /* ----- issuance: one path ----- */
  function stepFor(sid, lane) { const st = replaySkill(sid).step; return lane === 'challenge' ? Math.min(3, st + 1) : lane === 'review' ? Math.max(1, st - 1) : st; }
  function freshIn(tid, step, t) {
    const cutoff = t - CONFIG.NO_REPEAT_DAYS * DAY;
    const recentKeys = new Set(S.issued.filter(i => i.shownAt >= cutoff).map(i => i.key));
    return pool(tid, step).filter(x => !recentKeys.has(x.key));
  }
  function lastShownTemplate(sid) { let t = -1; for (const it of S.issued) if (it.tpl === sid && it.shownAt > t) t = it.shownAt; return t; }
  function issueAt(sid, step, lane, session, reason) {
    const t = now(); const lastTpl = session.lastTpl;
    const tpls = TPL_BY_SKILL[sid].slice().sort((a, b) => lastShownTemplate(a.id) - lastShownTemplate(b.id) || (hashStr(S.child.seed + a.id) - hashStr(S.child.seed + b.id)));
    const candidates = tpls.filter(x => x.id !== lastTpl);
    for (const tp of candidates) {
      const fresh = freshIn(tp.id, step, t); if (!fresh.length) continue;
      const r = rng(hashStr(S.child.seed + ':' + S.issued.length)); const choice = fresh[Math.floor(r() * fresh.length)];
      return makeItem(tp, step, choice, lane, session, reason);
    }
    return null;
  }
  function makeItem(tp, step, choice, lane, session, reason, evidenceEligible = true) {
    const a = tp.ans(choice.p);
    const ex = tp.kind === 'whole' ? [3, 7, 12, 5].find(x => !eqR(R(x), a)) : ['1/2', '2/3', '3/4'].find(x => { const q = parseAnswer(x, 'fraction'); return !eqR(q.value, a); });
    const item = { iid: nextId('it'), key: choice.key, skill: tp.skill, tpl: tp.id, ver: tp.ver, step, p: choice.p, lane, sessionId: session.id,
                   issueReason: reason, evidenceEligible, shownAt: now(), policy: CONFIG.POLICY_VERSION, formatExample: ex, slot: session.cursor };
    S.issued.push(item); session.lastTpl = tp.id; return item;
  }
  function issue(session, slotSkill, lane) {
    const step = stepFor(slotSkill, lane);
    let it = issueAt(slotSkill, step, lane, session, 'normal');
    if (it) return it;
    // template_switch: only the just-shown template has fresh items → move on to the next skill
    const onlyLast = session.lastTpl && TPL[session.lastTpl].skill === slotSkill && freshIn(session.lastTpl, step, now()).length > 0;
    const order = SKILLS.map(s => s.id), start = order.indexOf(slotSkill);
    const us = unlockedSkills();
    for (let k = 1; k < order.length; k++) {
      const sid = order[(start + k) % order.length]; if (!us.includes(sid)) continue;
      it = issueAt(sid, stepFor(sid, lane), lane, session, onlyLast ? 'template_switch' : 'exhausted_switch'); if (it) return it;
    }
    // last resort: repeat the item seen longest ago at this step; never evidence
    const cands = S.issued.filter(i => i.skill === slotSkill && i.step === step && i.tpl !== session.lastTpl).sort((a, b) => a.shownAt - b.shownAt);
    const old = cands[0] || S.issued.filter(i => i.skill === slotSkill && i.step === step)[0];
    return makeItem(TPL[old.tpl], step, { key: old.key, p: old.p }, lane, session, 'exhausted_repeat', false);
  }

  /* ----- QualifyingEvent bus + append-only ledger ----- */
  function emit(type, data, xp) {
    const ev = Object.assign({ id: nextId('qe'), type, at: now(), day: today(), policy: CONFIG.POLICY_VERSION }, data);
    S.events.push(ev); if (xp > 0) S.ledger.push({ eventId: ev.id, xp }); return ev;
  }
  const xpTotal = () => S.ledger.reduce((s, l) => s + l.xp, 0);

  function qpdDays() { return [...new Set(S.events.filter(e => e.type === 'QualifyingPracticeDay').map(e => e.day))].sort(); }
  function flame() {
    const days = qpdDays(); if (!days.length) return { state: 'none', count: 0 };
    const gap = dayDiff(days[days.length - 1], today());
    let count = 1; for (let i = days.length - 1; i > 0; i--) { if (dayDiff(days[i - 1], days[i]) <= 2) count++; else break; }
    const state = gap <= 0 ? 'hot' : gap === 1 ? 'warm' : gap === 2 ? 'ember' : 'resting';
    return { state, count: state === 'resting' ? 0 : count };
  }
  function pieces() {
    const n = S.events.filter(e => e.type === 'BuildPieceUnlock').length, per = CONFIG.PIECES_PER_GOAL;
    const goal = Math.floor(n / per) + 1, have = n % per;
    return { total: n, have, per, goal, justCompleted: n > 0 && have === 0 };
  }
  function unlockPiece(reason, ref) { const before = pieces(); const ev = emit('BuildPieceUnlock', { reason, ref }, 0); const after = pieces(); return { ev, n: before.total + 1, completedGoal: after.justCompleted ? before.goal : null }; }

  /* ----- views ----- */
  function fuel() { const f = flame(), pc = pieces(); return { flame: f, xp: xpTotal(), pieces: { have: pc.justCompleted ? pc.per : pc.have, per: pc.per, goal: pc.justCompleted ? pc.goal - 1 : pc.goal } }; }
  function clientView(sid) { const st = replaySkill(sid); return { bandLabel: st.band, showConceptChip: st.n >= CONFIG.BAND_MIN }; }
  function publicItem(it, session) {
    const tp = TPL[it.tpl];
    return { iid: it.iid, skillId: it.skill, skillName: SKILL[it.skill].name, step: it.step, lane: it.lane, stem: tp.stem(it.p), layout: tp.layout,
             answerKind: tp.kind, formatExample: it.formatExample, index: session.cursor, total: session.plan.length };
  }

  function homeView() {
    const focus = chooseFocus(); const cv = clientView(focus);
    const open = S.sessions.find(s => !s.endedAt && s.cursor < s.plan.length && s.cursor > 0);
    return { name: S.child.name, focus: { id: focus, name: SKILL[focus].name, bandLabel: cv.bandLabel }, fuel: fuel(), laneOffer: laneOffer(focus),
             reviewLeft: Math.max(0, CONFIG.REVIEW_PER_WEEK - reviewUsedThisWeek()), resumable: !!open, stepLabel: stepLabel(replaySkill(focus).step) };
  }
  function badgesView() {
    const got = new Set(S.events.filter(e => e.type === 'BadgeMilestone').map(e => e.skill));
    return { skills: SKILLS.map(s => { const st = replaySkill(s.id); return { id: s.id, name: s.name, bandLabel: st.n ? st.band : null, badge: got.has(s.id), open: unlocked(s.id) }; }),
             pieces: pieces(), fuel: fuel() };
  }

  /* ----- sessions ----- */
  function startSession(lane) {
    lane = lane || 'recommended';
    if (lane === 'review' && reviewUsedThisWeek() >= CONFIG.REVIEW_PER_WEEK) lane = 'recommended';
    // an abandoned session simply ends; nothing is minted for it
    S.sessions.filter(s => !s.endedAt).forEach(s => { s.endedAt = now(); s.abandoned = true; });
    const focus = chooseFocus(); const mixCount = CONFIG.MIX_SLOTS.filter(x => x <= CONFIG.SESSION_ITEMS).length;
    const mix = mixSkillsFor(focus, mixCount); let mi = 0;
    const plan = []; for (let i = 1; i <= CONFIG.SESSION_ITEMS; i++) plan.push(CONFIG.MIX_SLOTS.includes(i) && mix.length ? mix[mi++ % mix.length] : focus);
    const st = replaySkill(focus);
    const session = { id: nextId('ss'), focus, lane, plan, cursor: 0, startedAt: now(), endedAt: null, lastTpl: null, attempted: 0, bandAtStart: st.band, stepAtStart: st.step, xpAtStart: xpTotal(), piecesAtStart: pieces().total, leveledUp: false, currentIid: null };
    S.sessions.push(session);
    return { sessionId: session.id, focus: SKILL[focus].name, lane, total: plan.length };
  }
  const getSession = id => S.sessions.find(s => s.id === id);

  function nextItem(sessionId) {
    const s = getSession(sessionId); if (!s || s.endedAt) return { done: true };
    if (s.currentIid) { const it = S.issued.find(i => i.iid === s.currentIid); if (it && !S.attempts.some(a => a.iid === it.iid)) return publicItem(it, s); }
    if (s.cursor >= s.plan.length) return { done: true };
    const slotSkill = s.plan[s.cursor]; const lane = slotSkill === s.focus ? s.lane : (s.lane === 'review' ? 'review' : 'recommended');
    const it = issue(s, slotSkill, lane); s.cursor++; s.currentIid = it.iid;
    return publicItem(it, s);
  }

  function submit(iid, raw, latencyMs) {
    const prior = S.attempts.find(a => a.iid === iid); if (prior) return prior.response;     // same-key replay: original result, no new mint
    const it = S.issued.find(i => i.iid === iid); if (!it) return { error: 'unknown-item' };
    const s = getSession(it.sessionId); const tp = TPL[it.tpl];
    const pa = parseAnswer(raw, tp.kind);
    if (!pa.ok) {                                                                           // a format reject is not an attempt
      S.rejects.push({ iid, tpl: it.tpl, ver: it.ver, kind: tp.kind, reason: pa.reason, at: now() });
      return { kind: 'format_rejected', hint: tp.kind === 'whole' ? `Use numbers only, like ${it.formatExample}.` : `Write it as a fraction, like ${it.formatExample}.` };
    }
    const ans = tp.ans(it.p); const rt = Math.max(0, Math.min(CONFIG.RT_CAP_MS, Math.round(latencyMs || 0)));
    let outcome, bug = null;
    if (eqR(pa.value, ans)) outcome = formOk(pa, tp.form) ? 'correct' : 'form_mismatch';
    else { outcome = 'wrong'; const m = bugsFor(tp, it.p).find(b => eqR(b.v, pa.value)); bug = m ? m.tag : null; }
    const correct = outcome === 'correct';

    // integrity: too fast, or the same wrong answer typed into three different items in a row
    const lastTwo = S.attempts.slice(-2);
    const spam = !correct && lastTwo.length === 2 && lastTwo.every(a => !a.correct && a.typed === typedText(pa));
    const honest = rt >= CONFIG.MIN_LATENCY_MS && !spam;
    const countsForBand = honest && it.evidenceEligible && it.lane !== 'review';

    const before = replaySkill(it.skill);
    const att = { iid, skill: it.skill, tpl: it.tpl, ver: it.ver, step: it.step, lane: it.lane, sessionId: it.sessionId, outcome, bug, correct, typed: typedText(pa),
                  rtMs: rt, fastGuess: rt < CONFIG.FAST_GUESS_MS, honest, countsForBand, issueReason: it.issueReason, at: now(), day: today(), policy: CONFIG.POLICY_VERSION };
    S.attempts.push(att); if (s) { s.attempted++; s.currentIid = null; }
    const after = replaySkill(it.skill);

    // ----- mints: only through the bus -----
    const minted = []; let xpNow = 0; let tier = 'none'; let flameLit = false, piece = null, levelUp = null, badge = null, bandUp = null;
    if (honest) {
      const base = correct ? (it.lane === 'challenge' ? CONFIG.XP.challenge : CONFIG.XP.correct) : CONFIG.XP.effort;
      const xp = it.lane === 'review' ? Math.max(1, Math.round(base * CONFIG.REVIEW_XP_MULT)) : base;
      minted.push(emit('HonestAttempt', { iid, skill: it.skill, lane: it.lane, correct }, xp)); xpNow += xp;
      // QualifyingPracticeDay: K honest attempts today, at least one from Recommended or Challenge
      const todays = S.attempts.filter(a => a.honest && a.day === att.day);
      if (!S.events.some(e => e.type === 'QualifyingPracticeDay' && e.day === att.day) && todays.length >= CONFIG.QPD_K && todays.some(a => a.lane !== 'review')) {
        minted.push(emit('QualifyingPracticeDay', { lanes: todays.map(a => a.lane) }, 0)); flameLit = true;
        const f = flame(); if (CONFIG.FLAME_MILESTONES.includes(f.count)) { const u = unlockPiece('flame-' + f.count, att.day); minted.push(u.ev); piece = u; }
      }
    }
    if (countsForBand) {
      if (after.levelUps.length > before.levelUps.length) {
        const lu = after.levelUps[after.levelUps.length - 1];
        minted.push(emit('LevelUpSlight', { skill: it.skill, toStep: lu.step }, CONFIG.XP.levelUp)); xpNow += CONFIG.XP.levelUp; levelUp = { skill: SKILL[it.skill].name, step: lu.step, stepLabel: stepLabel(lu.step) };
        if (s) s.leveledUp = true;
      }
      if (RANK[after.band] > RANK[before.band] && !S.bandLog.some(b => b.skill === it.skill && b.to === after.band)) {
        S.bandLog.push({ skill: it.skill, from: before.band, to: after.band, at: now(), policy: CONFIG.POLICY_VERSION, iid });
        minted.push(emit('MasteryBandTransition', { skill: it.skill, from: before.band, to: after.band }, CONFIG.XP.band)); xpNow += CONFIG.XP.band; bandUp = after.band;
        const u = unlockPiece('band-' + after.band, it.skill); minted.push(u.ev); piece = u;
        if (after.band === 'Got it') { minted.push(emit('BadgeMilestone', { skill: it.skill }, 0)); badge = SKILL[it.skill].name; }
      }
    }
    if (bandUp || levelUp) tier = 'full'; else if (xpNow > 0) tier = 'quietXp';

    // ----- feedback frame, assembled from template metadata only -----
    const canon = fmtR(ans, tp.form === 'mixed' ? 'mixed' : null);
    const lock = lockLine(tp, it.p, ans, ans.d === 1 ? fmtN(ans.n) : canon);
    let frame;
    if (correct) frame = { verdict: 'Correct', beats: [ ['Nice move', tp.well(it.p)], ['Why it works', tp.why ? tp.why(it.p) : null], ['Answer', lock] ].filter(b => b[1]), next: 'Next one' };
    else if (outcome === 'form_mismatch') {
      const req = { lowest: `This one asks for lowest terms, so it's ${canon}.`, improper: `This one asks for one fraction with no whole number in front, so it's ${canon}.`, mixed: `This one asks for the whole number first, then the fraction, so it's ${canon}.` }[tp.form];
      frame = { verdict: 'Not yet', reason: { kind: 'wrong_form', required: tp.form }, beats: [ ['What you tried', `You wrote ${att.typed}. That's the right amount!`], ['One focus', req], ['Lock in', `${att.typed} = ${canon}`] ], next: 'Next', hideTryNext: true };
    } else {
      const f = (bug && tp.focus[bug]) || tp.focus.default;
      frame = { verdict: 'Not yet', beats: [ ['What you tried', `You wrote ${att.typed}.`], ['One focus', f ? f(it.p) : null], ['Lock in', lock] ].filter(b => b[1]), next: 'Try another' };
    }
    const rewardLine = [];
    if (correct && xpNow > 0) rewardLine.push(`+${xpNow} XP`);
    if (correct && flameLit) rewardLine.push('Flame lit');
    if (correct && piece) rewardLine.push(piece.completedGoal ? `Warrior ${piece.completedGoal} complete` : `Piece ${pieces().have}/${CONFIG.PIECES_PER_GOAL}`);
    if (correct && badge) rewardLine.push(`Badge: ${badge}`);

    const response = { kind: 'scored', correct, outcome, frame, clientView: Object.assign(clientView(it.skill), { celebrationTier: tier }), skillName: SKILL[it.skill].name,
                       rewardLine: (correct && rewardLine.length) ? rewardLine : null, levelUp, fuel: fuel(), mintedIds: minted.map(m => m.id), bandUp };
    att.response = response;
    return response;
  }

  function endSession(sessionId) {
    const s = getSession(sessionId); if (!s) return null;
    if (!s.endedAt) {
      s.endedAt = now();
      // ConceptProgressTick: late-third accuracy beats early-third on the focus skill
      const fa = S.attempts.filter(a => a.sessionId === s.id && a.skill === s.focus && a.countsForBand);
      if (fa.length >= CONFIG.TICK_MIN) {
        const k = Math.floor(fa.length / 3), acc = xs => xs.filter(a => a.correct).length / xs.length;
        if (acc(fa.slice(-k)) - acc(fa.slice(0, k)) >= CONFIG.TICK_DELTA) { emit('ConceptProgressTick', { skill: s.focus, sessionId: s.id }, CONFIG.XP.tick); s.tick = true; }
      }
    }
    const atts = S.attempts.filter(a => a.sessionId === s.id && a.issueReason !== 'exhausted_repeat');
    const ms = atts.reduce((m, a) => m + Math.min(a.rtMs, CONFIG.RT_CAP_MS), 0);
    return { fuel: fuel(), xpGained: xpTotal() - s.xpAtStart, piecesGained: pieces().total - s.piecesAtStart, tick: !!s.tick, focus: SKILL[s.focus].name,
             minutes: Math.floor(ms / 60000), questions: new Set(atts.map(a => a.iid)).size, completed: s.cursor >= s.plan.length && !s.currentIid };
  }

  /* ----- behind the glass ----- */
  function inspect() {
    return {
      clock: { today: today(), dayOffset: S.dayOffset },
      skills: SKILLS.map(s => { const st = replaySkill(s.id); const fresh = TPL_BY_SKILL[s.id].reduce((n, t) => n + freshIn(t.id, st.step, now()).length, 0);
        return { id: s.id, name: s.name, open: unlocked(s.id), band: st.band, step: st.step, evidence: st.n, fresh, pool: TPL_BY_SKILL[s.id].reduce((n, t) => n + pool(t.id, st.step).length, 0) }; }),
      events: S.events.slice(-14).reverse(), issued: S.issued.slice(-10).reverse().map(i => ({ skill: i.skill, tpl: i.tpl, step: i.step, lane: i.lane, reason: i.issueReason, evidence: i.evidenceEligible })),
      totals: { attempts: S.attempts.length, honest: S.attempts.filter(a => a.honest).length, rejects: S.rejects.length, fastGuess: S.attempts.filter(a => a.fastGuess).length, xp: xpTotal(), qpd: qpdDays().length },
      focus: chooseFocus(), config: CONFIG
    };
  }

  return { homeView, badgesView, startSession, nextItem, submit, endSession, inspect, fuel, now, _replay: replaySkill, _state: S };
}
function lockLine(tp, p, ans, canon) {
  if (tp.lock) return tp.lock(p, ans);
  const st = tp.stem(p);
  if (/\?\s+▢$/.test(st)) return st.replace(/\?\s+▢$/, '').replace(/^What is /, '') + ' = ' + canon;   // prose question → equation
  return st.replace('▢', canon);
}
function stepLabel(n) { return ['', 'Easy', 'Medium', 'Hard'][n]; }

/* ---------- simulated learner (used by the sample-week loader and the headless gates) ---------- */
function simulateSession(server, opts) {
  const o = Object.assign({ lane: 'recommended', pBase: 0.82, pStep: 0.12, rt: 5000 }, opts || {});
  const S = server._state; const r = rng(hashStr('sim' + S.seq));
  const ss = server.startSession(o.lane); let n = 0;
  for (;;) {
    const it = server.nextItem(ss.sessionId); if (it.done) break;
    const item = S.issued.find(i => i.iid === it.iid); const tp = TPL[item.tpl]; const ans = tp.ans(item.p);
    const right = r() < o.pBase - o.pStep * (item.step - 1);
    let typed;
    if (right) typed = fmtR(ans, tp.form === 'mixed' ? 'mixed' : null);
    else { const b = bugsFor(tp, item.p)[0]; const v = b ? b.v : R(ans.n + ans.d, ans.d); typed = tp.kind === 'whole' ? String(Math.max(0, Math.round(v.n / v.d))) : fmtR(v); }
    server.submit(it.iid, typed, o.rt + Math.floor(r() * 4000)); n++;
  }
  return server.endSession(ss.sessionId);
}

G.MathSprout = { CONFIG, SKILLS, SKILL, TEMPLATES: T, TPL, TPL_BY_SKILL, pool, bugsFor, parseAnswer, formOk, fmtR, R, eqR, createServer, freshState, simulateSession, stepLabel, dayKey, DAY };
})(typeof window !== 'undefined' ? window : globalThis);
