require('./engine.js'); const M = globalThis.MathSprout; let fail=0; const ok=(c,m)=>{ if(!c){fail++;console.log('FAIL',m);} else console.log('ok  ',m); };
let t = Date.UTC(2026,8,21,17); const st = M.freshState('Leo',3); const srv = M.createServer(st, ()=>t);
const answerOf = iid => { const it = st.issued.find(i=>i.iid===iid); const tp=M.TPL[it.tpl]; return M.fmtR(tp.ans(it.p), tp.form==='mixed'?'mixed':null); };
// item payload never carries the answer
const s1 = srv.startSession('recommended'); const it = srv.nextItem(s1.sessionId);
ok(!JSON.stringify(it).includes('"p"') && !('answer' in it), 'item payload carries no params or answer');
// unreadable is not an attempt
const rj = srv.submit(it.iid, '12a', 4000); ok(rj.kind==='format_rejected' && st.attempts.length===0 && st.events.length===0, 'unreadable → hint, no attempt, no event');
ok(!rj.hint.includes(answerOf(it.iid)) , 'format example is not the answer');
// idempotent replay
const r1 = srv.submit(it.iid, answerOf(it.iid), 4000); const nEv = st.events.length; const r2 = srv.submit(it.iid, '0', 4000);
ok(r1===r2 && st.events.length===nEv, 'same-key replay returns original result, no new mint');
// too fast = not honest, no XP
const it2 = srv.nextItem(s1.sessionId); const xp0 = srv.fuel().xp; srv.submit(it2.iid, answerOf(it2.iid), 300);
ok(srv.fuel().xp===xp0 && !st.attempts.slice(-1)[0].honest, 'too-fast answer mints nothing');
// finish session honestly → QPD on day 1
for(;;){ const x = srv.nextItem(s1.sessionId); if(x.done) break; srv.submit(x.iid, answerOf(x.iid), 5000); }
srv.endSession(s1.sessionId);
ok(srv.fuel().flame.state==='hot' && srv.fuel().flame.count===1, 'QPD lights the flame: hot, 1');
t += M.DAY; ok(srv.fuel().flame.state==='warm', 'next day: warm');
t += M.DAY; ok(srv.fuel().flame.state==='ember' && srv.fuel().flame.count===1, 'one missed day: ember, count holds');
// Review-only day cannot light the flame
const s2 = srv.startSession('review'); for(;;){ const x = srv.nextItem(s2.sessionId); if(x.done) break; srv.submit(x.iid, answerOf(x.iid), 5000); } srv.endSession(s2.sessionId);
ok(srv.fuel().flame.state==='ember', 'Review-only practice does not light the flame');
const revEv = st.events.filter(e=>['LevelUpSlight','MasteryBandTransition','BuildPieceUnlock','BadgeMilestone'].includes(e.type) && e.at >= st.sessions.find(s=>s.id===s2.sessionId).startedAt);
ok(revEv.length===0, 'Review mints no level-up, band, badge or piece');
ok(st.attempts.filter(a=>a.sessionId===s2.sessionId).every(a=>!a.countsForBand), 'Review attempts are not band evidence');
// Recommended same day relights to hot with count 2
const s3 = srv.startSession('recommended'); for(;;){ const x = srv.nextItem(s3.sessionId); if(x.done) break; srv.submit(x.iid, answerOf(x.iid), 5000); } srv.endSession(s3.sessionId);
ok(srv.fuel().flame.state==='hot' && srv.fuel().flame.count===2, 'relight after ember: hot, count 2');
t += 3*M.DAY; ok(srv.fuel().flame.state==='resting' && srv.fuel().flame.count===0, 'two+ missed days: resting');
// XP never decreases across all of that
let prev=0, mono=true; let run=0; for (const l of st.ledger){ run+=l.xp; if(run<prev) mono=false; prev=run; } ok(mono && st.ledger.every(l=>l.xp>0), 'ledger is credit-only');
// band evidence: Got it needs step ≥2 success from Rec/Challenge
const gotit = st.bandLog.filter(b=>b.to==='Got it'); ok(gotit.every(b => st.attempts.some(a=>a.skill===b.skill && a.correct && a.step>=2 && a.lane!=='review' && a.countsForBand)), 'every Got it has a step-2+ Rec/Challenge success');
// form mismatch
const eqItem = { iid:'fm1', key:'k', skill:'eq', tpl:'eq-lowest', ver:1, step:1, p:{q:1,s:2,g:2}, lane:'recommended', sessionId:s3.sessionId, issueReason:'normal', evidenceEligible:true, shownAt:srv.now(), formatExample:'2/3' };
st.issued.push(eqItem); const fm = srv.submit('fm1','2/4',5000);
ok(fm.outcome==='form_mismatch' && !fm.correct && fm.frame.hideTryNext && fm.frame.beats[2][1]==='2/4 = 1/2', 'right value wrong form → Not yet, Lock in shows typed = canonical');
ok(st.attempts.slice(-1)[0].honest && !fm.rewardLine, 'wrong form earns effort XP only, no reward line');
console.log(fail?`${fail} FAIL`:'bus tests pass');
