/* Parity: the TypeScript port must behave exactly like the prototype (build step 1 is a
   no-behavior-change port). Each scenario runs against both engines with the same seed and
   clock, and the full stored state and every returned payload must match.
   When a later PR changes behavior on purpose, retire the affected scenario here. */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import * as TS from '../src/engine';

const require = createRequire(import.meta.url);
require('../prototype/engine.js');
const JS = (globalThis as any).MathSprout;

type Api = typeof TS;
const engines: [string, Api][] = [['prototype', JS], ['port', TS]];
const SEED = 20260926;
const T0 = Date.UTC(2026, 8, 20, 17);

function setup(E: Api, grade = 3) {
  const clock = { t: T0 };
  const st = E.freshState('Sim', grade); st.child.seed = SEED;
  const srv = E.createServer(st, () => clock.t);
  return { st, srv, clock };
}
const answerOf = (E: Api, st: TS.State, iid: string) => {
  const it = st.issued.find(i => i.iid === iid)!; const tp = E.TPL[it.tpl];
  return E.fmtR(tp.ans(it.p), tp.form === 'mixed' ? 'mixed' : null);
};

/** Runs a scenario on both engines and returns [prototype, port] transcripts. */
function both(scenario: (E: Api) => unknown) {
  return engines.map(([, E]) => JSON.parse(JSON.stringify(scenario(E))));
}

describe('content parity', () => {
  it('every pool item renders the same stem, answer, bugs and copy', () => {
    const dump = (E: Api) => E.TEMPLATES.map(t => ({
      id: t.id, ver: t.ver, kind: t.kind, form: t.form, layout: t.layout,
      steps: ([1, 2, 3] as const).map(s => E.pool(t.id, s).map(x => ({
        key: x.key, stem: t.stem(x.p), ans: t.ans(x.p), bugs: E.bugsFor(t, x.p),
        well: t.well(x.p), why: t.why ? t.why(x.p) : null, lock: t.lock ? t.lock(x.p, t.ans(x.p)) : null,
        focus: Object.fromEntries(Object.entries(t.focus).map(([k, f]) => [k, f!(x.p)])),
      }))),
    }));
    const [a, b] = both(dump);
    expect(b).toEqual(a);
  });

  it('config, skills and template order match', () => {
    const [a, b] = both(E => ({ config: E.CONFIG, skills: E.SKILLS, order: E.TEMPLATES.map(t => t.id) }));
    expect(b).toEqual(a);
  });

  it('the parser agrees on a spread of inputs', () => {
    const inputs = ['', ' ', '12', ' 1,200 ', '12a', '1/2', '3/0', '4/4', '7/2', '1 1/2', '1 2/4', '2 0/3', '2 5/3', '1  / 2', '0', '007', '-3', '1.5', '½'];
    const [a, b] = both(E => inputs.flatMap(s => (['whole', 'fraction'] as const).map(k => {
      const p = E.parseAnswer(s, k);
      return { s, k, p, forms: p.ok ? (['any', 'lowest', 'improper', 'mixed'] as const).map(f => E.formOk(p, f)) : null };
    })));
    expect(b).toEqual(a);
  });
});

describe('behavior parity', () => {
  /* The gates' simulated weeks, plus a stuck learner that exhausts pools. */
  const weeks: [TS.Lane, number, number, number][] = [];
  for (const lane of ['recommended', 'challenge', 'review'] as TS.Lane[]) for (const perDay of [1, 2]) for (const [g, p] of [[3, 0.82], [2, 0.45]]) weeks.push([lane, perDay, g, p]);
  it.each(weeks)('simulated week: %s ×%i/day, grade %i, p=%f', (lane, perDay, grade, pBase) => {
    const [a, b] = both(E => {
      const { st, srv, clock } = setup(E, grade); const out: unknown[] = [];
      for (let d = 0; d < 7; d++) {
        for (let k = 0; k < perDay; k++) { out.push(E.simulateSession(srv, { lane, pBase })); clock.t += 3 * 3600e3; }
        clock.t = T0 + (d + 1) * E.DAY;
        out.push(srv.homeView(), srv.badgesView(), srv.inspect());
      }
      return { st, out };
    });
    expect(b).toEqual(a);
  });

  it('stuck learner on one skill, 4 sessions a day for 7 days (pool exhaustion paths)', () => {
    const [a, b] = both(E => {
      const { st, srv, clock } = setup(E, 3); st.dev.focusOverride = 'eq'; const out: unknown[] = [];
      for (let d = 0; d < 7; d++) {
        for (let k = 0; k < 4; k++) { out.push(E.simulateSession(srv, { pBase: 0.3, pStep: 0 })); clock.t += 2 * 3600e3; }
        clock.t = T0 + (d + 1) * E.DAY;
      }
      out.push(srv.inspect());
      return { st, out, reasons: st.issued.map(i => i.issueReason) };
    });
    expect(b).toEqual(a);
    // make sure the scenario actually reached the fallbacks it is meant to cover
    expect(new Set(b.reasons)).toContain('exhausted_switch');
  });

  it('scripted edge cases: rejects, spam, fast answers, wrong forms, replays, abandons, lanes', () => {
    const [a, b] = both(E => {
      const { st, srv, clock } = setup(E, 4); const out: unknown[] = [];
      const log = (x: unknown) => { out.push(x); return x as any; };
      st.dev.alwaysOfferLanes = true;
      log(srv.homeView());
      const s1 = log(srv.startSession('challenge'));
      let n = 0;
      for (;;) {
        const x = log(srv.nextItem(s1.sessionId)); if (x.done) break; n++;
        log(srv.nextItem(s1.sessionId));                           // re-ask before answering → same item
        log(srv.submit(x.iid, 'abc', 3000));                       // unreadable
        log(srv.submit(x.iid, '', 3000));                          // empty
        log(srv.submit(x.iid, '1/0', 3000));                       // zero denominator / not whole
        if (n % 4 === 0) log(srv.submit(x.iid, '999', 3000));      // same wrong answer…
        else if (n % 4 === 1) log(srv.submit(x.iid, answerOf(E, st, x.iid), 400));   // too fast
        else if (n % 4 === 2) log(srv.submit(x.iid, '7/3', 3000)); // wrong, maybe a fraction
        else log(srv.submit(x.iid, answerOf(E, st, x.iid), 250000)); // slow, clamped
        log(srv.submit(x.iid, '0', 3000));                         // replay
      }
      log(srv.endSession(s1.sessionId)); log(srv.endSession(s1.sessionId));
      // spam: the same wrong answer into three items in a row
      const s2 = log(srv.startSession('recommended'));
      for (let i = 0; i < 5; i++) { const x = log(srv.nextItem(s2.sessionId)); log(srv.submit(x.iid, '999', 4000)); }
      // abandon mid-session by starting another
      const s3 = log(srv.startSession('review'));
      const x3 = log(srv.nextItem(s3.sessionId)); log(srv.submit(x3.iid, answerOf(E, st, x3.iid), 4000));
      log(srv.startSession('review')); log(srv.startSession('review'));   // third review this week → recommended
      log(srv.nextItem(s3.sessionId));                                     // abandoned → done
      log(srv.submit('nope', '1', 4000));                                  // unknown item
      // every form rule on real fraction items: right value typed in each form
      st.dev.focusOverride = 'eq';
      for (let k = 0; k < 3; k++) {
        const s = log(srv.startSession('recommended'));
        for (;;) {
          const x = log(srv.nextItem(s.sessionId)); if (x.done) break;
          const it = st.issued.find(i => i.iid === x.iid)!; const v = E.TPL[it.tpl].ans(it.p);
          const forms = [E.fmtR(v), E.fmtR(v, 'mixed'), `${v.n * 2}/${v.d * 2}`, `0 ${v.n}/${v.d}`];
          const r = log(srv.submit(x.iid, forms[(it.step + k + st.attempts.length) % forms.length], 4000));
          if (r.kind === 'format_rejected') log(srv.submit(x.iid, E.fmtR(v), 4000));   // whole-number items reject fractions
        }
        log(srv.endSession(s.sessionId));
        clock.t += E.DAY;
      }
      st.dayOffset = 3; log(srv.homeView()); log(srv.badgesView()); log(srv.inspect());
      return { st, out };
    });
    expect(b).toEqual(a);
  });

  it('the bus test script produces the same state', () => {
    const [a, b] = both(E => {
      const { st, srv, clock } = setup(E, 3); const out: unknown[] = [];
      const play = (sid: string) => { for (;;) { const x = srv.nextItem(sid) as any; if (x.done) break; out.push(srv.submit(x.iid, answerOf(E, st, x.iid), 5000)); } out.push(srv.endSession(sid)); };
      play(srv.startSession('recommended').sessionId);
      clock.t += 2 * E.DAY; play(srv.startSession('review').sessionId);
      play(srv.startSession('recommended').sessionId);
      clock.t += 3 * E.DAY; out.push(srv.fuel());
      return { st, out };
    });
    expect(b).toEqual(a);
  });
});
