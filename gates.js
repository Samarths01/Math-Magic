require('./engine.js'); const M = globalThis.MathSprout;
let fail = 0; const bad = m => { fail++; console.log('FAIL', m); };
// 1. Pool floors (counted after engine filters)
const skillTot = {};
for (const t of M.TEMPLATES) for (const s of [1,2,3]) {
  const n = M.pool(t.id, s).length; skillTot[t.skill+s] = (skillTot[t.skill+s]||0) + n;
  if (n < M.CONFIG.POOL_FLOOR_TEMPLATE) bad(`pool ${t.id} step ${s} = ${n}`);
  for (const x of M.pool(t.id, s)) {
    const a = t.ans(x.p); if (!a || !Number.isFinite(a.n) || a.n < 0 || !Number.isInteger(a.n)) bad(`bad answer ${x.key}`);
    if (t.kind === 'whole' && a.d !== 1) bad(`non-whole answer ${x.key}`);
    const stem = t.stem(x.p); if (!stem.includes('▢')) bad(`no blank ${x.key}`);
    if (/undefined|NaN/.test(stem)) bad(`stem ${x.key} ${stem}`);
    for (const b of M.bugsFor(t, x.p)) if (M.eqR(b.v, a)) bad(`bug collides ${x.key}`);
    for (const f of [t.well, t.why].filter(Boolean)) { const s2 = f(x.p); if (s2 && /undefined|NaN/.test(s2)) bad(`copy ${x.key} ${s2}`); }
    for (const k of ['default', ...M.bugsFor(t, x.p).map(b => b.tag)]) { if (!t.focus[k]) { if (k !== 'default') bad(`no focus copy ${t.id} ${k}`); continue; } const s2 = t.focus[k](x.p); if (/undefined|NaN/.test(s2)) bad(`focus ${x.key} ${k} ${s2}`); }
  }
}
for (const [k, n] of Object.entries(skillTot)) if (n < M.CONFIG.POOL_FLOOR_SKILL) bad(`skill pool ${k} = ${n}`);
const minSkill = Object.entries(skillTot).sort((a,b)=>a[1]-b[1]).slice(0,6);
console.log('thinnest skill-step pools:', minSkill.map(([k,n])=>k+'='+n).join(' '));
// templates per skill
for (const s of M.SKILLS) if (M.TPL_BY_SKILL[s.id].length < 3) bad('templates ' + s.id);

// 2. Parser rulings from the spec
const P = (raw, kind, form) => { const p = M.parseAnswer(raw, kind); return p.ok ? M.formOk(p, form) : 'unreadable'; };
const eq = (a, b, m) => { if (a !== b) bad(`${m}: got ${a}, want ${b}`); };
eq(P('1 1/2','fraction','lowest'), true, 'lowest accepts 1 1/2');
eq(P('3/2','fraction','lowest'), true, 'lowest accepts 3/2');
eq(P('1 2/4','fraction','lowest'), false, 'lowest: 1 2/4 is form_mismatch');
eq(P('3/1','fraction','lowest'), true, 'lowest: 3/1 correct');
eq(P('1','fraction','lowest'), true, 'lowest: 1 correct');
eq(P('1 1/2','fraction','improper'), false, 'improper rejects mixed');
eq(P('7/2','fraction','mixed'), false, 'mixed rejects improper');
eq(P('12a','whole','any'), 'unreadable', '12a unreadable');
eq(P('1/2','whole','any'), 'unreadable', 'fraction on whole item unreadable');
eq(P('3/0','fraction','any'), 'unreadable', 'zero denominator unreadable');
eq(M.pool('eq-lowest',1).every(x => x.p.q < x.p.s), true, 'lowest step1 proper only');
eq(M.pool('eq-improper',1).every(x => x.p.w <= 3), true, 'improper step1 whole part <= 3');
eq(M.pool('eq-mixed',1).concat(M.pool('eq-mixed',2),M.pool('eq-mixed',3)).every(x => M.TPL['eq-mixed'].ans(x.p).d !== 1), true, 'mixed never whole');

// 3. 7-day simulations: 1 and 2 sessions/day, each lane, zero exact repeats; switch rate
function sim(perDay, lane, grade, pBase) {
  let t0 = Date.UTC(2026, 8, 20, 17); let t = t0; const st = M.freshState('Sim', grade); const srv = M.createServer(st, () => t);
  for (let d = 0; d < 7; d++) { for (let k = 0; k < perDay; k++) { M.simulateSession(srv, { lane, pBase }); t += 3 * 3600e3; } t = t0 + (d + 1) * M.DAY; }
  const seen = {}; let repeats = 0; for (const i of st.issued) { if (seen[i.key] && i.shownAt - seen[i.key] < 7 * M.DAY) repeats++; seen[i.key] = i.shownAt; }
  const bySkill = {}; for (const i of st.issued) { const b = bySkill[i.skill] || (bySkill[i.skill] = { n: 0, sw: 0 }); b.n++; if (i.issueReason !== 'normal') b.sw++; }
  let bb2b = 0; const bySess = {}; for (const i of st.issued) (bySess[i.sessionId] = bySess[i.sessionId] || []).push(i.tpl);
  for (const arr of Object.values(bySess)) for (let j = 1; j < arr.length; j++) if (arr[j] === arr[j-1]) bb2b++;
  const worstSw = Math.max(...Object.values(bySkill).map(b => b.sw / b.n));
  const reasons = st.issued.reduce((m, i) => (m[i.issueReason] = (m[i.issueReason]||0)+1, m), {});
  return { items: st.issued.length, repeats, bb2b, worstSw: +(worstSw*100).toFixed(1), reasons, xp: srv.fuel().xp, flame: srv.fuel().flame, pieces: srv.fuel().pieces, bands: M.SKILLS.map(s=>srv._replay(s.id)).map(x=>x.band[0]+x.step).join(' ') };
}
for (const lane of ['recommended','challenge','review']) for (const perDay of [1,2]) for (const [grade,p] of [[3,0.82],[2,0.45]]) {
  const r = sim(perDay, lane, grade, p);
  const tag = `${lane} ×${perDay}/day g${grade} p${p}`;
  console.log(tag.padEnd(28), JSON.stringify(r));
  if (r.repeats) bad(`${tag}: ${r.repeats} repeats`);
  if (r.bb2b) bad(`${tag}: ${r.bb2b} back-to-back templates`);
}
console.log(fail ? `\n${fail} FAILURES` : '\nall gates pass');
