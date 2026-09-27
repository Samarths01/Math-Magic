/* Deploy gates, ported from prototype/gates.js. */
import { describe, expect, it } from 'vitest';
import { CONFIG, DAY, SKILLS, TEMPLATES, TPL, TPL_BY_SKILL, bugsFor, createServer, eqR, formOk, freshState, parseAnswer, pool, simulateSession, type AnswerForm, type AnswerKind, type Lane, type Step } from '../src/engine';

const STEPS: Step[] = [1, 2, 3];
const BAD_COPY = /undefined|NaN/;

describe('pools and content', () => {
  it('every template-step pool meets the floor, and every item is well formed', () => {
    const bad: string[] = [];
    for (const t of TEMPLATES) for (const s of STEPS) {
      const items = pool(t.id, s);
      if (items.length < CONFIG.POOL_FLOOR_TEMPLATE) bad.push(`pool ${t.id} step ${s} = ${items.length}`);
      for (const x of items) {
        const a = t.ans(x.p);
        if (!a || !Number.isFinite(a.n) || a.n < 0 || !Number.isInteger(a.n)) bad.push(`bad answer ${x.key}`);
        if (t.kind === 'whole' && a.d !== 1) bad.push(`non-whole answer ${x.key}`);
        const stem = t.stem(x.p);
        if (!stem.includes('▢')) bad.push(`no blank ${x.key}`);
        if (BAD_COPY.test(stem)) bad.push(`stem ${x.key} ${stem}`);
        for (const b of bugsFor(t, x.p)) if (eqR(b.v, a)) bad.push(`bug collides ${x.key}`);
        for (const f of [t.well, t.why]) { const s2 = f?.(x.p); if (s2 && BAD_COPY.test(s2)) bad.push(`copy ${x.key} ${s2}`); }
        for (const k of ['default', ...bugsFor(t, x.p).map(b => b.tag)]) {
          const f = t.focus[k];
          if (!f) { if (k !== 'default') bad.push(`no focus copy ${t.id} ${k}`); continue; }
          const s2 = f(x.p); if (BAD_COPY.test(s2)) bad.push(`focus ${x.key} ${k} ${s2}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('every skill-step pool meets the floor', () => {
    const skillTot: Record<string, number> = {};
    for (const t of TEMPLATES) for (const s of STEPS) skillTot[t.skill + s] = (skillTot[t.skill + s] || 0) + pool(t.id, s).length;
    const under = Object.entries(skillTot).filter(([, n]) => n < CONFIG.POOL_FLOOR_SKILL);
    expect(under).toEqual([]);
  });

  it('every skill has at least 3 templates', () => {
    for (const s of SKILLS) expect(TPL_BY_SKILL[s.id].length, s.id).toBeGreaterThanOrEqual(3);
  });
});

describe('parser rulings (ML note)', () => {
  const P = (raw: string, kind: AnswerKind, form: AnswerForm) => { const p = parseAnswer(raw, kind); return p.ok ? formOk(p, form) : 'unreadable'; };
  it.each([
    ['1 1/2', 'fraction', 'lowest', true, 'lowest accepts 1 1/2'],
    ['3/2', 'fraction', 'lowest', true, 'lowest accepts 3/2'],
    ['1 2/4', 'fraction', 'lowest', false, 'lowest: 1 2/4 is form_mismatch'],
    ['3/1', 'fraction', 'lowest', true, 'lowest: 3/1 correct'],
    ['1', 'fraction', 'lowest', true, 'lowest: 1 correct'],
    ['1 1/2', 'fraction', 'improper', false, 'improper rejects mixed'],
    ['7/2', 'fraction', 'mixed', false, 'mixed rejects improper'],
    ['12a', 'whole', 'any', 'unreadable', '12a unreadable'],
    ['1/2', 'whole', 'any', 'unreadable', 'fraction on whole item unreadable'],
    ['3/0', 'fraction', 'any', 'unreadable', 'zero denominator unreadable'],
  ] as const)('%s (%s, %s) → %s', (raw, kind, form, want, _why) => {
    expect(P(raw, kind, form)).toBe(want);
  });

  it('eq pools respect their step rules', () => {
    expect(pool('eq-lowest', 1).every(x => x.p.q < x.p.s)).toBe(true);
    expect(pool('eq-improper', 1).every(x => x.p.w <= 3)).toBe(true);
    const mixed = [...pool('eq-mixed', 1), ...pool('eq-mixed', 2), ...pool('eq-mixed', 3)];
    expect(mixed.every(x => TPL['eq-mixed'].ans(x.p).d !== 1)).toBe(true);
  });
});

/* 7-day simulations at 1 and 2 sessions a day in every lane: zero exact repeats within
   7 days (§5 invariant 6) and never the same template back to back in a session. */
function sim(perDay: number, lane: Lane, grade: number, pBase: number) {
  const t0 = Date.UTC(2026, 8, 20, 17); let t = t0;
  const st = freshState('Sim', grade); const srv = createServer(st, () => t);
  for (let d = 0; d < 7; d++) { for (let k = 0; k < perDay; k++) { simulateSession(srv, { lane, pBase }); t += 3 * 3600e3; } t = t0 + (d + 1) * DAY; }
  const seen: Record<string, number> = {}; let repeats = 0;
  for (const i of st.issued) { if (seen[i.key] && i.shownAt - seen[i.key] < 7 * DAY) repeats++; seen[i.key] = i.shownAt; }
  let bb2b = 0; const bySess: Record<string, string[]> = {};
  for (const i of st.issued) (bySess[i.sessionId] = bySess[i.sessionId] || []).push(i.tpl);
  for (const arr of Object.values(bySess)) for (let j = 1; j < arr.length; j++) if (arr[j] === arr[j - 1]) bb2b++;
  return { items: st.issued.length, repeats, bb2b };
}

describe('7-day simulations', () => {
  const cases: [Lane, number, number, number][] = [];
  for (const lane of ['recommended', 'challenge', 'review'] as Lane[]) for (const perDay of [1, 2]) for (const [grade, p] of [[3, 0.82], [2, 0.45]]) cases.push([lane, perDay, grade, p]);
  it.each(cases)('%s ×%i/day, grade %i, p=%f', (lane, perDay, grade, p) => {
    const r = sim(perDay, lane, grade, p);
    expect(r.items).toBe(84 * perDay);
    expect(r.repeats).toBe(0);
    expect(r.bb2b).toBe(0);
  });
});
