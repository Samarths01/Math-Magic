/* Band rules. "Got it" needs evidence from 2+ sessions (Samarth, 2026-09-26), so one strong
   12-item session can't reach it on its own. */
import { describe, expect, it } from 'vitest';
import { CONFIG, DAY, TPL, bandOf, createServer, fmtR, freshState, simulateSession, type Attempt, type Lane, type State } from '../src/engine';

const mk = (o: Partial<Attempt>): Attempt => ({
  iid: 'x', skill: 'add2', tpl: 'add2-std', ver: 1, step: 2, lane: 'recommended', sessionId: 's1', outcome: 'correct', bug: null, correct: true, typed: '1',
  rtMs: 4000, fastGuess: false, honest: true, countsForBand: true, issueReason: 'normal', at: 0, day: '2026-09-26', policy: 'rules-v1', ...o,
});
const run = (n: number, o: Partial<Attempt> = {}) => Array.from({ length: n }, (_, i) => mk({ iid: `a${i}`, ...o }));

describe('bandOf: Got it needs correct answers from more than one session', () => {
  it('a full window of correct answers from one session is only Getting it', () => {
    expect(bandOf(run(8))).toBe('Getting it');
  });

  it('the same window spread across two sessions is Got it', () => {
    expect(bandOf([...run(4, { sessionId: 's1' }), ...run(4, { sessionId: 's2' })])).toBe('Got it');
  });

  it('only correct answers count toward the session spread', () => {
    const win = [mk({ sessionId: 's2', correct: false, outcome: 'wrong' }), ...run(7, { sessionId: 's1' })];
    expect(win.filter(a => a.correct).length / win.length).toBeGreaterThanOrEqual(CONFIG.GOT_IT);
    expect(bandOf(win)).toBe('Getting it');
  });

  it('the other Got it conditions still apply across sessions', () => {
    const twoSessions = (o: Partial<Attempt>) => [...run(4, { sessionId: 's1', ...o }), ...run(4, { sessionId: 's2', ...o })];
    expect(bandOf(twoSessions({ step: 1 }))).toBe('Getting it');               // needs a step-2+ success
    expect(bandOf(twoSessions({}).slice(1))).toBe('Getting it');               // needs a full window
  });
});

describe('Got it through the server', () => {
  function perfectChild() {
    let t = Date.UTC(2026, 8, 21, 17);
    const st = freshState('Leo', 3); st.child.seed = 42; const srv = createServer(st, () => t);
    const answerOf = (iid: string) => { const it = st.issued.find(i => i.iid === iid)!; const tp = TPL[it.tpl]; return fmtR(tp.ans(it.p), tp.form === 'mixed' ? 'mixed' : null); };
    const session = () => {
      const s = srv.startSession('recommended');
      for (;;) { const x = srv.nextItem(s.sessionId); if ('done' in x) break; srv.submit(x.iid, answerOf(x.iid), 5000); }
      srv.endSession(s.sessionId); t += 3 * 3600e3;
      return s.sessionId;
    };
    return { st, srv, session };
  }

  it('a perfect first session never reaches Got it', () => {
    const { st, srv, session } = perfectChild();
    session();
    expect(st.bandLog.filter(b => b.to === 'Got it')).toEqual([]);
    expect(st.events.filter(e => e.type === 'BadgeMilestone')).toEqual([]);
    const focus = st.sessions[0].focus;
    expect(srv._replay(focus).band).toBe('Getting it');
  });

  it('a second strong session on the same focus reaches Got it', () => {
    const { st, session } = perfectChild();
    session(); const second = session();
    const got = st.bandLog.filter(b => b.to === 'Got it');
    expect(got.length).toBeGreaterThan(0);
    expect(st.attempts.find(a => a.iid === got[0].iid)!.sessionId).toBe(second);
  });
});

/* Invariant over the gates' simulated weeks: at every Got it, the band window held correct
   answers from at least GOT_IT_MIN_SESSIONS sessions. */
function gotItSpreads(st: State): number[] {
  return st.bandLog.filter(b => b.to === 'Got it').map(b => {
    const upTo = st.attempts.findIndex(a => a.iid === b.iid);
    const win = st.attempts.slice(0, upTo + 1).filter(a => a.skill === b.skill && a.countsForBand).slice(-CONFIG.BAND_WINDOW);
    return new Set(win.filter(a => a.correct).map(a => a.sessionId)).size;
  });
}

describe('Got it invariant in simulated weeks', () => {
  const cases: [Lane, number, number][] = [];
  for (const lane of ['recommended', 'challenge'] as Lane[]) for (const perDay of [1, 2]) for (const p of [0.82, 0.95]) cases.push([lane, perDay, p]);
  let reached = 0;
  it.each(cases)('%s ×%i/day, p=%f', (lane, perDay, pBase) => {
    const t0 = Date.UTC(2026, 8, 20, 17); let t = t0;
    const st = freshState('Sim', 3); st.child.seed = 7; const srv = createServer(st, () => t);
    for (let d = 0; d < 7; d++) { for (let k = 0; k < perDay; k++) { simulateSession(srv, { lane, pBase }); t += 3 * 3600e3; } t = t0 + (d + 1) * DAY; }
    const spreads = gotItSpreads(st); reached += spreads.length;
    for (const spread of spreads) expect(spread).toBeGreaterThanOrEqual(CONFIG.GOT_IT_MIN_SESSIONS);
  });
  it('the simulations reach Got it at all (so the invariant is not vacuous)', () => {
    expect(reached).toBeGreaterThan(0);
  });
});
