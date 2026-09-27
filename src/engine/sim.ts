import { TPL } from './content';
import { bugsFor } from './pools';
import type { Server } from './server';
import type { Lane } from './state';
import { hashStr, rng } from './util/random';
import { R, fmtR } from './util/rational';

/* Simulated learner, used by the deploy gates and the dev panel's sample week. It peeks at
   server state to know the answer, so it must never be reachable from a client route. */
export interface SimOptions { lane?: Lane; pBase?: number; pStep?: number; rt?: number }

export function simulateSession(server: Server, opts?: SimOptions) {
  const o = Object.assign({ lane: 'recommended' as Lane, pBase: 0.82, pStep: 0.12, rt: 5000 }, opts || {});
  const S = server._state; const r = rng(hashStr('sim' + S.seq));
  const ss = server.startSession(o.lane);
  for (;;) {
    const it = server.nextItem(ss.sessionId); if ('done' in it) break;
    const item = S.issued.find(i => i.iid === it.iid)!; const tp = TPL[item.tpl]; const ans = tp.ans(item.p);
    const right = r() < o.pBase - o.pStep * (item.step - 1);
    let typed: string;
    if (right) typed = fmtR(ans, tp.form === 'mixed' ? 'mixed' : null);
    else { const b = bugsFor(tp, item.p)[0]; const v = b ? b.v : R(ans.n + ans.d, ans.d); typed = tp.kind === 'whole' ? String(Math.max(0, Math.round(v.n / v.d))) : fmtR(v); }
    server.submit(it.iid, typed, o.rt + Math.floor(r() * 4000));
  }
  return server.endSession(ss.sessionId);
}
