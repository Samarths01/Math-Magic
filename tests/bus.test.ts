/* Bus and economy checks, ported from prototype/bustest.js. The steps share one child and
   one clock and run in order, like the original script. */
import { describe, expect, it } from 'vitest';
import { DAY, TPL, createServer, fmtR, freshState, type IssuedItem } from '../src/engine';

describe('QE bus and economy', () => {
  let t = Date.UTC(2026, 8, 21, 17);
  const st = freshState('Leo', 3); const srv = createServer(st, () => t);
  const answerOf = (iid: string) => { const it = st.issued.find(i => i.iid === iid)!; const tp = TPL[it.tpl]; return fmtR(tp.ans(it.p), tp.form === 'mixed' ? 'mixed' : null); };
  const next = (sid: string) => { const x = srv.nextItem(sid); if ('done' in x) throw new Error('session done'); return x; };
  const playAll = (sid: string) => { for (;;) { const x = srv.nextItem(sid); if ('done' in x) break; srv.submit(x.iid, answerOf(x.iid), 5000); } srv.endSession(sid); };

  const s1 = srv.startSession('recommended'); const it1 = next(s1.sessionId);

  it('item payload carries no params or answer', () => {
    expect(JSON.stringify(it1)).not.toContain('"p"');
    expect('answer' in it1).toBe(false);
  });

  it('unreadable → hint, no attempt, no event; format example is not the answer', () => {
    const rj = srv.submit(it1.iid, '12a', 4000);
    expect(rj.kind).toBe('format_rejected');
    expect(st.attempts).toHaveLength(0);
    expect(st.events).toHaveLength(0);
    expect(rj.hint).not.toContain(answerOf(it1.iid));
  });

  it('same-key replay returns the original result and mints nothing', () => {
    const r1 = srv.submit(it1.iid, answerOf(it1.iid), 4000); const nEv = st.events.length;
    const r2 = srv.submit(it1.iid, '0', 4000);
    expect(r2).toBe(r1);
    expect(st.events).toHaveLength(nEv);
  });

  it('too-fast answer mints nothing', () => {
    const it2 = next(s1.sessionId); const xp0 = srv.fuel().xp;
    srv.submit(it2.iid, answerOf(it2.iid), 300);
    expect(srv.fuel().xp).toBe(xp0);
    expect(st.attempts.at(-1)!.honest).toBe(false);
  });

  it('a qualifying day lights the flame, then it cools: hot → warm → ember', () => {
    playAll(s1.sessionId);
    expect(srv.fuel().flame).toEqual({ state: 'hot', count: 1 });
    t += DAY; expect(srv.fuel().flame.state).toBe('warm');
    t += DAY; expect(srv.fuel().flame).toEqual({ state: 'ember', count: 1 });
  });

  it('Review-only practice cannot light the flame, mint mastery, or count as evidence', () => {
    const s2 = srv.startSession('review'); playAll(s2.sessionId);
    expect(srv.fuel().flame.state).toBe('ember');
    const startedAt = st.sessions.find(s => s.id === s2.sessionId)!.startedAt;
    const mastery = st.events.filter(e => ['LevelUpSlight', 'MasteryBandTransition', 'BuildPieceUnlock', 'BadgeMilestone'].includes(e.type) && e.at >= startedAt);
    expect(mastery).toEqual([]);
    expect(st.attempts.filter(a => a.sessionId === s2.sessionId).every(a => !a.countsForBand)).toBe(true);
  });

  it('relights after ember: hot, count 2; then two+ missed days → resting', () => {
    const s3 = srv.startSession('recommended'); playAll(s3.sessionId);
    expect(srv.fuel().flame).toEqual({ state: 'hot', count: 2 });
    t += 3 * DAY; expect(srv.fuel().flame).toEqual({ state: 'resting', count: 0 });
  });

  it('the ledger is credit-only and every row points to an event', () => {
    expect(st.ledger.every(l => l.xp > 0)).toBe(true);
    const ids = new Set(st.events.map(e => e.id));
    expect(st.ledger.every(l => ids.has(l.eventId))).toBe(true);
  });

  it('every Got it has a step-2+ Recommended/Challenge success', () => {
    for (const b of st.bandLog.filter(b => b.to === 'Got it')) {
      expect(st.attempts.some(a => a.skill === b.skill && a.correct && a.step >= 2 && a.lane !== 'review' && a.countsForBand)).toBe(true);
    }
  });

  it('right value in the wrong form → Not yet, Lock in shows typed = canonical, effort XP only', () => {
    const s3 = st.sessions.at(-1)!;
    const eqItem: IssuedItem = { iid: 'fm1', key: 'k', skill: 'eq', tpl: 'eq-lowest', ver: 1, step: 1, p: { q: 1, s: 2, g: 2 }, lane: 'recommended', sessionId: s3.id,
                                 issueReason: 'normal', evidenceEligible: true, shownAt: srv.now(), policy: 'rules-v1', formatExample: '2/3', slot: 0 };
    st.issued.push(eqItem);
    const fm = srv.submit('fm1', '2/4', 5000);
    expect(fm.outcome).toBe('form_mismatch');
    expect(fm.correct).toBe(false);
    expect(fm.frame.hideTryNext).toBe(true);
    expect(fm.frame.reason).toEqual({ kind: 'wrong_form', required: 'lowest' });
    expect(fm.frame.beats[2][1]).toBe('2/4 = 1/2');
    expect(st.attempts.at(-1)!.honest).toBe(true);
    expect(fm.rewardLine).toBeNull();
  });
});
