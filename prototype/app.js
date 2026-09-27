(function () {
'use strict';
const M = window.MathSprout;
const KEY = 'math-sprout-prototype-v1';
const $app = document.getElementById('app'), $glass = document.getElementById('glass');

/* ---------- persistence (this browser only) ---------- */
function load() { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function save() { try { if (state) localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage blocked: the session still works in memory */ } }

function makeSample() {
  const st = M.freshState('Leo', 3); st.sample = true;
  const srv = M.createServer(st);
  // six days back; practice every day except four days ago, so today opens on a warm flame that survived an ember
  for (let d = -6; d <= -1; d++) {
    st.dayOffset = d; if (d === -4) continue;
    M.simulateSession(srv, { pBase: 0.84 });
    if (d === -2) M.simulateSession(srv, { pBase: 0.84, lane: 'challenge' });
  }
  st.dayOffset = 0; return st;
}

let state = load() || makeSample();
let server = M.createServer(state);
const ui = { screen: 'home', sessionId: null, item: null, typed: '', sel: false, hint: '', fb: null, shownAt: 0, lane: 'recommended', end: null, pulse: false, minted: false, setupGrade: 3,
             mint: null, xpFrom: null, armSlot: 'helmet', tryOn: null, confirm: null, armPower: false };

/* Lively mode (dogfood switch): in-run rewards. Everything it shows comes from events the server
   already minted for this answer, so it stays inside "celebrate only QualifyingEvents". */
const LIVELY_KEY = 'math-sprout-lively';
let lively = (() => { try { return localStorage.getItem(LIVELY_KEY) === '1'; } catch (e) { return false; } })();
function setLively(on) { lively = on; try { localStorage.setItem(LIVELY_KEY, on ? '1' : '0'); } catch (e) { /* per-tab only */ } }

/* ---------- icons ---------- */
const I = {
  flame: c => `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="${c}" d="M12.6 2.2c.4 3-1.3 4.6-2.8 6.2C8.2 10 6.5 11.8 6.5 14.8A5.6 5.6 0 0 0 12 20.5a5.6 5.6 0 0 0 5.5-5.7c0-2.2-1-3.9-2-5.1-.2 1.4-.9 2.5-2 3 .5-3.7-.4-7.6-.9-10.5Z"/><path fill="#fff" fill-opacity=".45" d="M12 20.5a3 3 0 0 1-3-3c0-1.8 1.4-2.8 2.4-4 .2 1.3 1.1 2 1.9 2.3.1-.7.5-1.3.9-1.7.5.8.8 1.7.8 2.6a3 3 0 0 1-3 3.8Z"/></svg>`,
  star: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#E8B923" d="m12 2.8 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.7l-5.4 2.9 1.1-6.1-4.5-4.3 6.1-.8Z"/></svg>`,
  piece: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#7C5CBF" d="M12 2.5 19.5 5v6.2c0 4.7-3.2 8.6-7.5 10.3-4.3-1.7-7.5-5.6-7.5-10.3V5Z"/><path fill="#fff" fill-opacity=".5" d="M12 5.2 16.8 7v4.3c0 3.1-2 5.8-4.8 7.1Z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" d="m5 12.5 4.5 4.5L19 7.5"/></svg>`,
  dot: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="currentColor"/></svg>`,
  x: `<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke="#3F4A5E" stroke-width="3" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>`,
  token: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#7C5CBF" d="M12 2.5 20.2 7.2v9.6L12 21.5l-8.2-4.7V7.2Z"/><path fill="#fff" fill-opacity=".85" d="M9 8.2h6.2l-1.4 2.4h-2.3v1.5h2v2.2h-2v2.6H9Z"/></svg>`,
  up: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M4 17 10 11l4 4 6-7M15 8h5v5"/></svg>`,
  medal: on => `<svg class="medal" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="${on ? '#1F2A44' : 'none'}" stroke="${on ? '#1F2A44' : '#C7CFDB'}" stroke-width="2" ${on ? '' : 'stroke-dasharray="3 3"'}/>${on ? '<path d="m8 12.3 2.8 2.8L16.3 9.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' : ''}</svg>`
};
const HEAT = { hot: '#E4572E', warm: '#F29E4C', ember: '#B5651D', resting: '#9AA0A6', none: '#9AA0A6' };

/* the companion (see warrior.js); it wears whatever the child has chosen in the Armory */
const sprout = (have, cls, fresh, look) => Warrior.sprout(have, cls, fresh, look || Armory.look(state));
const PIECE_NAMES = ['Boots', 'Shield', 'Cape', 'Helmet', 'Sword'];

/* ---------- small renderers ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function fuelHTML(f, slim, pulse, xpShown) {
  const fl = f.flame; const label = fl.state === 'none' ? 'Start your flame' : fl.state === 'resting' ? 'Flame resting' : `${fl.count}-day flame`;
  return `<div class="fuel ${slim ? 'slim' : ''} ${pulse ? 'pulse' : ''}" aria-label="Flame, XP and warrior pieces">
    <span class="f flame-${fl.state}">${I.flame(HEAT[fl.state])}${label}</span><span class="sep"></span>
    <span class="f xp">${I.star}<span class="num">${xpShown == null ? f.xp : xpShown}</span> XP</span><span class="sep"></span>
    <span class="f pc">${I.piece}${f.pieces.have}/${f.pieces.per}</span></div>`;
}
function diffHTML(step) { return `<span class="diff"><span class="bars">${[1, 2, 3].map(i => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</span>${M.stepLabel(step)}</span>`; }
function bandHTML(label) { const n = { 'Still learning': 1, 'Getting it': 2, 'Got it': 3 }[label] || 1; return `<span class="band"><span class="dots">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>${esc(label)}</span>`; }

function blankHTML(inFrac) {
  const done = ui.fb ? (ui.fb.correct ? 'done-c' : 'done-n') : '';
  const cls = ['blank', !ui.typed && !ui.fb ? 'empty' : '', ui.sel ? 'sel' : '', done].join(' ');
  return `<span class="${cls}" aria-label="your answer">${esc(ui.typed)}</span>`;
}
function inlineMath(text) {
  let out = '', last = 0; const re = /(\d+ )?(\d+|▢)\/(\d+|▢)|▢/g; let m;
  while ((m = re.exec(text))) {
    out += esc(text.slice(last, m.index)); last = re.lastIndex;
    if (m[0] === '▢') { out += blankHTML(false); continue; }
    const part = v => v === '▢' ? blankHTML(true) : esc(v);
    out += (m[1] ? `<span class="whole">${esc(m[1].trim())}</span>` : '') + `<span class="frac"><span>${part(m[2])}</span><span>${part(m[3])}</span></span>`;
  }
  return out + esc(text.slice(last));
}
function stemHTML(item) {
  const s = item.stem;
  if (item.layout === 'column') {
    const m = s.match(/^(\S+) ([+−×]) (\S+) = ▢$/);
    if (m) return `<div class="stem" aria-label="${esc(s.replace('▢', 'blank'))}"><span class="col"><span></span><span>${m[1]}</span><span class="op">${m[2]}</span><span>${m[3]}</span><span class="rule"></span><span class="res">${blankHTML()}</span></span></div>`;
  }
  if (/[a-z]{3,}/i.test(s.replace(/▢/g, ''))) {
    const i = s.lastIndexOf('▢'); const head = s.slice(0, i).trim();
    return `<div class="stem prose">${inlineMath(head)}<div class="blank-row">${blankHTML()}</div></div>`;
  }
  return `<div class="stem">${inlineMath(s)}</div>`;
}

/* ---------- screens ---------- */
function screenSetup() {
  return `<section class="screen setup">
    <span class="eyebrow">Math Sprout</span>
    <h1>Who's practicing?</h1>
    <div class="field"><label for="setup-name">First name</label><input id="setup-name" autocomplete="off" maxlength="20" value="Leo"></div>
    <div class="field"><label id="grade-lbl">Grade in school</label>
      <div class="seg" role="group" aria-labelledby="grade-lbl">${[2, 3, 4].map(g => `<button data-act="grade" data-g="${g}" aria-pressed="${ui.setupGrade === g}">${g}</button>`).join('')}</div></div>
    <p class="note">Grade only picks where practice starts. Math Sprout moves up or down from there, skill by skill.</p>
    <div style="margin-top:auto"><button class="btn" data-act="setup-go">Start</button></div>
  </section>`;
}
function screenHome() {
  const h = server.homeView(); const p = ui.pulse; ui.pulse = false;
  return `<section class="screen home">
    <div class="hi">Hi, ${esc(h.name)}</div>
    <span class="eyebrow">Today's focus</span>
    <h1 class="focus-name">${esc(h.focus.name)}</h1>
    ${bandHTML(h.focus.bandLabel)}
    <div class="cta">
      <button class="btn" data-act="start">Start practice</button>
      ${fuelHTML(h.fuel, false, p)}
    </div>
    <button class="link badges-link" data-act="badges">Badges ›</button>
  </section>`;
}
function screenLanes() {
  const h = server.homeView(); const L = ui.lane;
  const opt = (id, t, d, extra, dis) => `<button class="lane-opt" role="radio" aria-checked="${L === id}" data-act="lane" data-lane="${id}" ${dis ? 'disabled' : ''}><span class="radio"></span><span><span class="t">${t}</span><br><span class="d">${d}</span></span>${extra || ''}</button>`;
  return `<section class="screen">
    <button class="link" data-act="home">‹ Back</button>
    <span class="eyebrow">${esc(h.focus.name)}</span>
    <h2 style="font-size:28px">Ready for this set?</h2>
    <div class="lanes" role="radiogroup" aria-label="Choose how hard">
      ${opt('recommended', 'Recommended', `Picked for you · ${h.stepLabel}`)}
      ${opt('challenge', 'Challenge', 'One step harder. Worth more XP.')}
      ${opt('review', 'Review', 'Easier practice to build confidence.', `<span class="left">${h.reviewLeft} left this week</span>`, h.reviewLeft === 0)}
    </div>
    <div style="margin-top:auto"><button class="btn" data-act="go">Start</button></div>
  </section>`;
}
function screenPractice() {
  const it = ui.item, f = server.fuel();
  const segs = Array.from({ length: it.total }, (_, i) => `<i class="${i < it.index - 1 ? 'done' : i === it.index - 1 ? 'now' : ''}"></i>`).join('');
  const path = lively ? flamePath(it) : null;
  const laneTag = it.lane === 'challenge' ? '<span class="lane">Challenge</span>' : it.lane === 'review' ? '<span class="lane">Review</span>' : '';
  const frac = it.answerKind === 'fraction';
  const pad = `<div class="pad" role="group" aria-label="Number pad">
      ${['7', '8', '9'].map(k => `<button data-act="key" data-k="${k}">${k}</button>`).join('')}<button class="k-sm" data-act="key" data-k="back" aria-label="Delete">⌫</button>
      ${['4', '5', '6'].map(k => `<button data-act="key" data-k="${k}">${k}</button>`).join('')}${frac ? '<button data-act="key" data-k="/" aria-label="fraction bar">/</button>' : '<span class="spacer"></span>'}
      ${['1', '2', '3'].map(k => `<button data-act="key" data-k="${k}">${k}</button>`).join('')}${frac ? '<button class="k-sm" data-act="key" data-k=" " aria-label="space, for mixed numbers">space</button>' : '<span class="spacer"></span>'}
      <button class="zero" data-act="key" data-k="0">0</button><button class="check" data-act="check" ${ui.typed ? '' : 'disabled'}>Check</button>
    </div>`;
  return `<section class="screen practice">
    <div class="bar"><button class="x" data-act="quit" aria-label="End practice">${I.x}</button><div class="progress ${path ? 'path' : ''}" aria-label="Question ${it.index} of ${it.total}">${path ? path.segs : segs}</div>${path ? `<p class="path-note ${path.lit ? 'lit' : ''}">${path.note}</p>` : ''}${fuelHTML(f, true, lively ? false : ui.minted, lively ? ui.xpFrom : null)}</div>
    <div class="qhead"><span class="concept">${esc(it.skillName)}</span><span class="chips">${laneTag}${diffHTML(it.step)}</span></div>
    <div class="stage">${stemHTML(it)}<p class="hint" aria-live="polite">${esc(ui.hint)}</p>${lively ? buddyHTML(f.pieces.have) : ''}</div>
    ${ui.fb ? (lively ? feedbackLivelyHTML(ui.fb) : feedbackHTML(ui.fb)) : pad}
  </section>`;
}
function feedbackHTML(r) {
  const c = r.correct; const fr = r.frame; const cv = r.clientView;
  const chip = cv.showConceptChip ? `${esc(cv.bandLabel)} · ${esc(r.skillName)}` : `Still learning · ${esc(r.skillName)}`;
  const reward = r.rewardLine ? `<div class="reward">${r.rewardLine.map(x => /XP/.test(x) ? `<span class="rx">${I.star}${esc(x)}</span>` : /Flame/.test(x) ? `<span class="rf">${I.flame('#E4572E')}${esc(x)}</span>` : /Piece|Warrior/.test(x) ? `<span class="rp">${I.piece}${esc(x)}</span>` : `<span class="rb">${esc(x)}</span>`).join('')}</div>` : '';
  return `<div class="fb" role="status">
    <div class="verdict ${c ? 'c' : 'n'}"><span class="mark">${c ? I.check : I.dot}</span>${esc(fr.verdict)}</div>
    <dl class="beats">${fr.beats.map(([k, v]) => `<div class="beat ${/Answer|Lock in/.test(k) ? 'lock' : ''}"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <span class="chip ${cv.celebrationTier === 'full' ? 'full' : ''}">${chip}</span>
    ${reward}
    <button class="btn" data-act="next">${esc(fr.next)}${fr.hideTryNext ? '' : ' →'}</button>
  </div>`;
}
/* ---------- lively mode ---------- */
/* What this answer minted, read from the bus. The hosted API would return these event types and the
   XP delta with the scored response; the prototype reads them from the local event log. */
function mintedInfo(r) {
  const evs = (r.mintedIds || []).map(id => state.events.find(e => e.id === id)).filter(Boolean);
  const xp = evs.reduce((n, e) => { const l = state.ledger.find(x => x.eventId === e.id); return n + (l ? l.xp : 0); }, 0);
  const has = t => evs.some(e => e.type === t);
  return { xp, honest: has('HonestAttempt'), qpd: has('QualifyingPracticeDay'), piece: has('BuildPieceUnlock'), level: has('LevelUpSlight'), band: has('MasteryBandTransition'), badge: has('BadgeMilestone') };
}

/* The progress bar as a path toward today's flame: honest answers fill a segment, and a flame
   marks where today's qualifying day lands (QPD_K honest answers, at least one not Review).
   The hosted API would send this as a derived count (flame today: have / need). */
function flamePath(it) {
  const K = M.CONFIG.QPD_K, day = M.dayKey(server.now());
  const mine = state.attempts.filter(a => a.sessionId === ui.sessionId);
  const today = state.attempts.filter(a => a.honest && a.day === day);
  const litEv = state.events.find(e => e.type === 'QualifyingPracticeDay' && e.day === day);
  // the qualifying day is minted right after the HonestAttempt that earned it
  const litBy = litEv ? state.events[state.events.indexOf(litEv) - 1] : null;
  const litHere = litBy && litBy.type === 'HonestAttempt' ? mine.findIndex(a => a.iid === litBy.iid) : -1;
  const canLight = it.lane !== 'review' || today.some(a => a.lane !== 'review');
  const need = K - today.length;                                   // honest answers still needed today
  let flag = -1;
  if (litHere >= 0) flag = litHere;
  else if (!litEv && canLight && need > 0) flag = mine.length + need - 1;
  const segs = Array.from({ length: it.total }, (_, i) => {
    const a = mine[i]; const cls = a ? (a.honest ? 'done' : 'done soft') : i === it.index - 1 ? 'now' : '';
    const mark = i === flag ? `<b class="${litHere >= 0 ? 'on' : ''}">${I.flame(litHere >= 0 ? '#E4572E' : '#C7CFDB')}</b>` : '';
    return `<i class="${cls} ${mark ? 'flag' : ''}">${mark}</i>`;
  }).join('');
  let note = '', lit = false;
  if (litEv) { note = "Today's flame is lit"; lit = true; }
  else if (!canLight) note = 'Review keeps your flame warm. Recommended or Challenge lights it.';
  else if (flag >= it.total) note = `${need} more today to light your flame`;
  else note = `${need} more to light today's flame`;
  return { segs, note, lit };
}

/* The Sprout warrior rides along and reacts only to what was minted for this answer. */
function buddyHTML(have) {
  const m = ui.fb && ui.mint;
  let react = !m || !m.honest ? '' : (m.piece || m.level || m.band) ? 'power' : ui.fb.correct ? 'cheer' : 'nod';
  let fresh = react === 'power' && m.piece ? have - 1 : -1, shown = have;
  if (ui.preview) { react = 'power'; shown = Math.min(5, have + 1); fresh = shown - 1; }   // dev preview: nothing is minted
  // a power-up takes centre stage for a moment, then the warrior returns to its corner
  if (react === 'power') {
    const sparks = '<i class="spark s1"></i><i class="spark s2"></i><i class="spark s3"></i><i class="spark s4"></i><i class="spark s5"></i>';
    return `<div class="power-stage" aria-hidden="true"><div class="power-hero">${sparks}${sprout(shown, 'hero-svg', fresh)}</div>${ui.preview ? '<span class="preview-tag">Preview · nothing minted</span>' : ''}</div>
      <div class="buddy returning" aria-hidden="true">${sprout(shown, 'buddy-svg')}</div>`;
  }
  return `<div class="buddy ${react}" aria-hidden="true">${sprout(shown, 'buddy-svg')}</div>`;
}

function feedbackLivelyHTML(r) {
  const c = r.correct, fr = r.frame, cv = r.clientView, m = ui.mint || {};
  const well = c ? fr.beats.find(b => b[0] === 'Nice move') : null;
  const rest = c ? fr.beats.filter(b => b !== well) : fr.beats;
  const beatsHTML = bs => `<dl class="beats">${bs.map(([k, v]) => `<div class="beat ${/Answer|Lock in/.test(k) ? 'lock' : ''}"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
  const body = c
    ? `${well ? `<p class="well">${esc(well[1])}</p>` : ''}${rest.length ? `<details class="more"><summary>${rest.some(b => b[0] === 'Why it works') ? 'Why it works' : 'Show the answer'}</summary>${beatsHTML(rest)}</details>` : ''}`
    : beatsHTML(rest);
  // the level chip only when the level actually moved up; a drop is never shown as a loss
  const chip = r.bandUp ? `<span class="chip full">New level: ${esc(cv.bandLabel)} · ${esc(r.skillName)}</span>` : '';
  const challenge = ui.item.lane === 'challenge';
  const pop = c && m.xp > 0 ? `<span class="xp-pop ${challenge ? 'big' : ''}">${I.star}+${m.xp} XP${challenge ? ' · Challenge' : ''}</span>` : '';
  const f = r.fuel; const pcIdx = Math.max(0, f.pieces.have - 1);
  const moments = [
    m.qpd ? `<div class="moment flame-m">${I.flame('#E4572E')}<span>Today's flame is lit${f.flame.count > 1 ? ` · ${f.flame.count}-day flame` : ''} · +${Armory.ARMORY.TOKENS_PER_QPD} forge token</span></div>` : '',
    m.piece ? `<div class="moment piece-m">${I.piece}<span>${f.pieces.have === f.pieces.per ? `Sprout warrior ${f.pieces.goal} is complete · +${Armory.ARMORY.TOKENS_PER_PIECE + Armory.ARMORY.TOKENS_PER_WARRIOR} forge tokens` : `New piece: ${PIECE_NAMES[pcIdx]} · +${Armory.ARMORY.TOKENS_PER_PIECE} forge token`}</span></div>` : '',
    m.badge ? `<div class="moment badge-m">${I.medal(true)}<span>New badge: ${esc(r.skillName)}</span></div>` : '',
  ].join('');
  return `<div class="fb lively-fb" role="status">
    <div class="vrow"><div class="verdict ${c ? 'c' : 'n'}"><span class="mark">${c ? I.check : I.dot}</span>${esc(fr.verdict)}</div>${pop}</div>
    ${body}${chip}${moments}
    <button class="btn" data-act="next">${esc(fr.next)}${fr.hideTryNext ? '' : ' →'}</button>
  </div>`;
}

/* After a scored answer renders: fly the XP pill into the counter, count up, burst the flame. */
function playRewards() {
  if (!lively || !ui.fb || ui.screen !== 'practice') return;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const xpChip = $app.querySelector('.bar .fuel .xp'), num = xpChip && xpChip.querySelector('.num');
  const flameChip = $app.querySelector('.bar .fuel .f[class*="flame-"]');
  const to = server.fuel().xp, from = ui.xpFrom;
  const bump = el => { if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
  const land = () => {
    ui.xpFrom = null; if (!num || !num.isConnected) return;
    if (reduce || from == null) { num.textContent = to; return; }
    const t0 = performance.now(), dur = 520;
    const step = t => { const k = Math.min(1, (t - t0) / dur); num.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1 && num.isConnected) requestAnimationFrame(step); };
    requestAnimationFrame(step); bump(xpChip);
  };
  const pop = $app.querySelector('.fb .xp-pop');
  if (from != null && pop && num && !reduce && pop.animate) {
    setTimeout(() => {
      if (!pop.isConnected) return land();
      const a = pop.getBoundingClientRect(), b = num.getBoundingClientRect(), host = $app.getBoundingClientRect();
      const ghost = pop.cloneNode(true); ghost.classList.add('ghost');
      Object.assign(ghost.style, { left: (a.left - host.left) + 'px', top: (a.top - host.top) + 'px' });
      $app.appendChild(ghost);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
      ghost.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(.45)`, opacity: .2 }], { duration: 620, easing: 'cubic-bezier(.5,0,.3,1)' })
        .onfinish = () => { ghost.remove(); land(); };
    }, 420);
  } else land();
  if (ui.mint && ui.mint.qpd && flameChip) setTimeout(() => bump(flameChip), reduce ? 0 : 700);
}

function screenLevelUp() {
  const lu = ui.fb.levelUp; const pc = server.fuel().pieces.have;
  return `<section class="screen center levelup ${lively ? 'lively-lu' : ''}">
    ${sprout(pc)}
    <span class="eyebrow">Level up</span>
    <h2>${esc(lu.skill)}</h2>
    <div class="step-jump">${diffHTML(lu.step - 1)} → ${diffHTML(lu.step)}</div>
    <p>Same skill, a little harder. You just showed you're ready.</p>
    <button class="btn" data-act="after-levelup">Let's go</button>
  </section>`;
}
function screenEnd() {
  const e = ui.end, f = e.fuel;
  const fl = f.flame; const flameLabel = fl.state === 'none' ? 'Flame not lit yet' : fl.state === 'resting' ? 'Flame resting' : `${fl.count}-day flame`;
  return `<section class="screen end">
    <span class="eyebrow">${esc(e.focus)}</span>
    <h2>Nice practice today</h2>
    ${e.tick ? `<div class="tick">${I.up}<span>You got stronger at ${esc(e.focus.toLowerCase())} as you went.</span></div>` : ''}
    <div class="rchips">
      <span class="rchip" style="color:var(--${fl.state === 'none' || fl.state === 'resting' ? 'rest' : fl.state}-t)">${I.flame(HEAT[fl.state])}${flameLabel}</span>
      <span class="rchip" style="color:var(--gold-t)">${I.star}+${e.xpGained} XP today</span>
      <span class="rchip" style="color:var(--violet-t)">${I.piece}Piece ${f.pieces.have} of ${f.pieces.per}</span>
    </div>
    <p class="facts">${e.minutes >= 1 ? `${e.minutes} minute${e.minutes === 1 ? '' : 's'} · ` : ''}${e.questions} question${e.questions === 1 ? '' : 's'}</p>
    <div style="margin-top:auto"><button class="btn" data-act="home">Back home</button></div>
  </section>`;
}
function screenBadges() {
  const b = server.badgesView(); const pc = b.pieces; const tok = Armory.tokens(state).available; const have = pc.justCompleted ? pc.per : pc.have; const goal = pc.justCompleted ? pc.goal - 1 : pc.goal;
  return `<section class="screen">
    <button class="link" data-act="home">‹ Home</button>
    <h2 style="font-size:26px">Badges</h2>
    <div class="goal">${sprout(have)}<div><h3>Sprout warrior ${goal}</h3><p>${have} of ${pc.per} pieces. Pieces come from leveling up, new bands and long flames.</p>
      <ul class="pieces">${PIECE_NAMES.map((n, i) => `<li class="${i < have ? 'got' : ''}">${n}</li>`).join('')}</ul></div></div>
    <button class="armory-entry" data-act="armory"><span class="ae-t">Armory</span><span class="ae-n">${I.token}${tok} forge token${tok === 1 ? '' : 's'}</span><span class="ae-go">›</span></button>
    <span class="eyebrow">Skills</span>
    <ul class="skills">${b.skills.map(s => `<li class="${s.open ? '' : 'locked'}">${I.medal(s.badge)}<span class="nm">${esc(s.name)}</span><span class="bl">${s.bandLabel ? esc(s.bandLabel) : s.open ? 'Not started' : 'Opens later'}</span></li>`).join('')}</ul>
  </section>`;
}

function screenArmory() {
  const v = Armory.view(state), base = Armory.look(state), slot = ui.armSlot, t = v.tokens;
  const tryItem = ui.tryOn ? Armory.ITEM[ui.tryOn] : null;
  const preview = tryItem ? { ...base, [tryItem.slot]: tryItem } : base;
  const power = ui.armPower; ui.armPower = false;
  const RAR = { common: 'Common', rare: 'Rare', legendary: 'Legendary' };
  const starter = { id: '', slot, name: `Sprout ${Armory.SLOT_NAMES[slot].toLowerCase()}`, rarity: 'starter', owned: true, wearing: !base[slot], cost: 0 };
  const items = [starter, ...v.items.filter(x => x.slot === slot)];
  const card = x => {
    const lookWith = { ...base, [slot]: x.id ? Armory.ITEM[x.id] : undefined };
    let act;
    if (x.wearing) act = `<span class="wearing">${I.check}Wearing</span>`;
    else if (x.owned) act = `<button class="abtn" data-act="wear" data-slot="${slot}" data-id="${x.id}">Wear</button>`;
    else if (ui.confirm === x.id) act = `<div class="confirm"><span>Use ${x.cost} forge token${x.cost === 1 ? '' : 's'}?</span><button class="abtn go" data-act="claim-yes" data-id="${x.id}">Claim</button><button class="abtn ghost" data-act="claim-no">Not now</button></div>`;
    else if (x.needsWarrior) act = `<span class="locked">Finish a warrior to unlock</span>`;
    else if (x.affordable) act = `<button class="abtn go" data-act="claim-ask" data-id="${x.id}">${I.token}Claim · ${x.cost}</button>`;
    else act = `<div class="save"><div class="savebar"><i style="width:${Math.round(100 * x.saved / x.cost)}%"></i></div><span>${x.saved} of ${x.cost} tokens saved</span></div>`;
    return `<li class="aitem r-${x.rarity} ${x.wearing ? 'is-wearing' : ''} ${ui.tryOn === x.id && x.id ? 'is-trying' : ''}">
      <button class="alook" data-act="tryon" data-id="${x.id}" aria-label="Try on ${esc(x.name)}">${sprout(5, 'mini', -1, lookWith)}</button>
      <div class="ainfo"><div class="aname">${esc(x.name)}</div>${x.rarity === 'starter' ? '<span class="rar r-starter">Starter</span>' : `<span class="rar r-${x.rarity}">${RAR[x.rarity]}</span>`}<div class="aact">${act}</div></div>
    </li>`;
  };
  return `<section class="screen armory">
    <button class="link" data-act="badges">‹ Badges</button>
    <div class="arm-top">
      <div class="arm-hero ${power ? 'power' : ''}">${power ? '<i class="spark s1"></i><i class="spark s2"></i><i class="spark s3"></i><i class="spark s4"></i><i class="spark s5"></i>' : ''}${sprout(5, 'arm-svg', -1, preview)}</div>
      <div><h2>Armory</h2>
        <div class="tokens">${I.token}<b>${t.available}</b> forge token${t.available === 1 ? '' : 's'}</div>
        <p class="note">Flame day: +${Armory.ARMORY.TOKENS_PER_QPD}. New piece: +${Armory.ARMORY.TOKENS_PER_PIECE}. Finished warrior: +${Armory.ARMORY.TOKENS_PER_WARRIOR}. Save up for rarer gear.</p>
        ${tryItem && !Armory.view(state).items.find(i => i.id === tryItem.id).owned ? `<p class="tryon">Trying on: <b>${esc(tryItem.name)}</b></p>` : ''}
      </div>
    </div>
    <div class="slots" role="tablist">${Armory.SLOTS.map(sl => `<button role="tab" aria-selected="${sl === slot}" data-act="arm-slot" data-slot="${sl}">${Armory.SLOT_NAMES[sl]}</button>`).join('')}</div>
    <ul class="aitems">${items.map(card).join('')}</ul>
  </section>`;
}

function render() {
  const S = { setup: screenSetup, home: screenHome, lanes: screenLanes, practice: screenPractice, levelup: screenLevelUp, end: screenEnd, badges: screenBadges, armory: screenArmory }[ui.screen];
  document.body.classList.toggle('lively', lively);
  $app.innerHTML = S();
  renderGlass(); save();
}

/* ---------- practice flow ---------- */
function begin(lane) { const s = server.startSession(lane); ui.sessionId = s.sessionId; ui.minted = false; nextItem(); }
function nextItem() {
  const it = server.nextItem(ui.sessionId);
  if (it.done) return finish();
  Object.assign(ui, { screen: 'practice', item: it, typed: '', sel: false, hint: '', fb: null, shownAt: performance.now(), mint: null, xpFrom: null });
  render();
}
function finish() { ui.end = server.endSession(ui.sessionId); ui.screen = 'end'; ui.pulse = ui.minted || ui.end.xpGained > 0; render(); }
function press(k) {
  if (ui.fb) return; const frac = ui.item.answerKind === 'fraction'; let t = ui.sel ? '' : ui.typed; ui.sel = false; ui.hint = '';
  if (k === 'back') t = t.slice(0, -1);
  else if (/^\d$/.test(k)) { if (t.length < 9) t += k; }
  else if (k === '/' && frac) { if (t && !t.includes('/') && !t.endsWith(' ')) t += '/'; }
  else if (k === ' ' && frac) { if (t && !t.includes(' ') && !t.includes('/')) t += ' '; }
  ui.typed = t; render();
}
function check() {
  if (ui.fb || !ui.typed) return;
  const xpBefore = server.fuel().xp;
  const r = server.submit(ui.item.iid, ui.typed, performance.now() - ui.shownAt);
  if (r.kind === 'format_rejected') { ui.hint = r.hint; ui.sel = true; render(); return; }
  ui.fb = r; if (r.mintedIds && r.mintedIds.length) ui.minted = true;
  ui.mint = mintedInfo(r); ui.xpFrom = r.correct && ui.mint.xp > 0 ? xpBefore : null;
  render(); playRewards();
  const b = $app.querySelector('.fb .btn'); if (b) b.focus({ preventScroll: true });
}
function next() { if (ui.fb && ui.fb.levelUp) { ui.screen = 'levelup'; render(); return; } nextItem(); }

/* ---------- events ---------- */
$app.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const a = el.dataset.act;
  if (a === 'grade') { ui.setupGrade = +el.dataset.g; render(); }
  else if (a === 'setup-go') { const n = (document.getElementById('setup-name').value || 'Leo').trim().slice(0, 20) || 'Leo'; state = M.freshState(n, ui.setupGrade); server = M.createServer(state); ui.screen = 'home'; render(); }
  else if (a === 'start') { const h = server.homeView(); if (h.laneOffer) { ui.lane = 'recommended'; ui.screen = 'lanes'; render(); } else begin('recommended'); }
  else if (a === 'lane') { ui.lane = el.dataset.lane; render(); }
  else if (a === 'go') begin(ui.lane);
  else if (a === 'key') press(el.dataset.k);
  else if (a === 'check') check();
  else if (a === 'next') next();
  else if (a === 'after-levelup') nextItem();
  else if (a === 'quit') { const hadAny = state.attempts.some(x => x.sessionId === ui.sessionId); if (hadAny) finish(); else { server.endSession(ui.sessionId); ui.screen = 'home'; render(); } }
  else if (a === 'home') { ui.screen = 'home'; render(); }
  else if (a === 'badges') { ui.screen = 'badges'; render(); }
  else if (a === 'armory') { Object.assign(ui, { screen: 'armory', tryOn: null, confirm: null }); render(); }
  else if (a === 'arm-slot') { Object.assign(ui, { armSlot: el.dataset.slot, tryOn: null, confirm: null }); render(); }
  else if (a === 'tryon') { ui.tryOn = el.dataset.id || null; ui.confirm = null; render(); }
  else if (a === 'claim-ask') { ui.confirm = el.dataset.id; ui.tryOn = el.dataset.id; render(); }
  else if (a === 'claim-no') { ui.confirm = null; render(); }
  else if (a === 'claim-yes') { const r = Armory.claim(state, el.dataset.id, server.now()); Object.assign(ui, { confirm: null, tryOn: null, armPower: !!r.ok }); render(); }
  else if (a === 'wear') { Armory.wear(state, el.dataset.slot, el.dataset.id || null); ui.tryOn = null; render(); }
});
document.addEventListener('keydown', e => {
  if (ui.screen !== 'practice' || e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
  if (ui.fb) { if (e.key === 'Enter' && document.activeElement && !document.activeElement.closest('.fb')) { e.preventDefault(); next(); } return; }
  if (/^\d$/.test(e.key) || e.key === '/') { e.preventDefault(); press(e.key); }
  else if (e.key === ' ') { e.preventDefault(); press(' '); }
  else if (e.key === 'Backspace') { e.preventDefault(); press('back'); }
  else if (e.key === 'Enter') { e.preventDefault(); check(); }
});

/* ---------- behind the glass ---------- */
function renderGlass() {
  if (ui.screen === 'setup') { $glass.innerHTML = `<header><h2>Behind the glass</h2><p>Set up a child to start. The engine starts empty.</p></header>`; return; }
  const d = server.inspect(); const t = new Date(server.now());
  const when = t.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const off = d.clock.dayOffset;
  $glass.innerHTML = `
  <header><h2>Behind the glass</h2><p>What the engine sees. The child never sees this panel. It stands in for the server, the event log and the dogfood readout.</p></header>
  ${state.sample ? `<div class="sample">Sample data: ${esc(state.child.name)} has five simulated days of practice, with one missed day. Start fresh to begin with an empty child.</div>` : ''}
  <div class="gcard"><h3>Clock</h3>
    <div>Today is <b>${when}</b>${off ? ` (${off > 0 ? '+' : ''}${off} day${Math.abs(off) === 1 ? '' : 's'} from real time)` : ''}. The flame reads only qualifying days.</div>
    <div class="grow"><button class="gbtn" data-g="day1">Next day</button><button class="gbtn" data-g="day2">Skip 2 days</button><button class="gbtn" data-g="day0">Back to real today</button></div></div>
  <div class="gcard"><h3>Controls</h3>
    <label class="gtoggle"><input type="checkbox" id="g-lively" ${lively ? 'checked' : ''}> <b>Lively mode</b>: rewards during the run (dogfood test)</label>
    ${lively ? `<div class="grow"><button class="gbtn" data-g="preview-power" ${ui.screen === 'practice' ? '' : 'disabled'}>Preview warrior power-up</button><span class="gnote">${ui.screen === 'practice' ? 'Plays it now. Nothing is minted.' : 'Start a session first.'}</span></div>` : ''}
    <label class="gtoggle"><input type="checkbox" id="g-lanes" ${state.dev.alwaysOfferLanes ? 'checked' : ''}> Offer the lane choice before every session</label>
    <div class="grow"><label for="g-focus">Focus</label><select class="gsel" id="g-focus"><option value="">Auto (next up: ${esc(M.SKILL[d.focus].name)})</option>${M.SKILLS.map(s => `<option value="${s.id}" ${state.dev.focusOverride === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
    <div class="grow"><span class="glabel">Armory</span><button class="gbtn" data-g="arm-token">+1 forge token</button><button class="gbtn" data-g="arm-warrior">+1 finished warrior</button><button class="gbtn warn" data-g="arm-reset">Reset armory</button><span class="gnote">${(() => { const t = Armory.tokens(state); return `${t.available} available · ${t.earned} earned · ${t.spent} spent`; })()}</span></div>
    <div class="grow"><button class="gbtn" data-g="sim">Simulate a session</button><button class="gbtn" data-g="sample">Load sample week</button><button class="gbtn warn" data-g="fresh">Start fresh</button></div></div>
  <div class="gcard"><h3>Totals</h3><div class="stats">
    ${[['attempts', d.totals.attempts], ['honest', d.totals.honest], ['XP (ledger sum)', d.totals.xp], ['qualifying days', d.totals.qpd], ['format rejects', d.totals.rejects], ['fast guesses <2s', d.totals.fastGuess]].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('')}</div></div>
  <div class="gcard"><h3>Learner state · ${esc(d.config.POLICY_VERSION)}</h3><div class="tbl-wrap"><table class="tbl">
    <tr><th>skill</th><th>band</th><th>step</th><th>evid.</th><th>fresh / pool</th></tr>
    ${d.skills.map(s => `<tr class="${s.open ? '' : 'dim'}"><td>${s.id}${s.id === d.focus ? ' ◆' : ''}</td><td>${s.open ? s.band : 'locked'}</td><td>${s.step}</td><td>${s.evidence}</td><td>${s.fresh} / ${s.pool}</td></tr>`).join('')}</table></div>
    <p class="note" style="font-size:12.5px">◆ = focus. Evidence is the band window (last ${d.config.BAND_WINDOW} Recommended/Challenge attempts). Fresh = unseen in 7 days at the current step.</p></div>
  <div class="gcard"><h3>QualifyingEvent bus (newest first)</h3><div class="tbl-wrap"><table class="tbl">
    <tr><th>day</th><th>event</th><th>skill</th><th>xp</th></tr>
    ${d.events.length ? d.events.map(e => { const l = state.ledger.find(x => x.eventId === e.id); return `<tr><td>${e.day.slice(5)}</td><td><span class="tag qe-${e.type}">${e.type}</span></td><td>${e.skill || (e.reason || '')}</td><td>${l ? '+' + l.xp : ''}</td></tr>`; }).join('') : '<tr><td colspan="4" class="w">Nothing minted yet.</td></tr>'}</table></div></div>
  <div class="gcard"><h3>Issuance log (newest first)</h3><div class="tbl-wrap"><table class="tbl">
    <tr><th>template</th><th>step</th><th>lane</th><th>issue_reason</th><th>evid.</th></tr>
    ${d.issued.map(i => `<tr><td>${i.tpl}</td><td>${i.step}</td><td>${i.lane.slice(0, 4)}</td><td>${i.reason}</td><td>${i.evidence ? 'yes' : 'no'}</td></tr>`).join('')}</table></div></div>
  <div class="gcard"><details class="cfg"><summary>Config stubs</summary><div class="tbl-wrap"><table class="tbl" style="margin-top:8px">
    ${Object.entries(d.config).filter(([k]) => !/POOL_CAP/.test(k)).map(([k, v]) => `<tr><td>${k}</td><td class="w">${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</td></tr>`).join('')}</table></div></details></div>`;
}
$glass.addEventListener('click', e => {
  const b = e.target.closest('[data-g]'); if (!b) return; const g = b.dataset.g;
  if (g === 'preview-power') {
    if (ui.screen !== 'practice') return;
    // bring the warrior on screen first, then play (on phone width the panel sits below the app)
    const b = $app.querySelector('.buddy'); if (b) b.scrollIntoView({ block: 'center' });
    ui.preview = true; render(); ui.preview = false;
    return;
  }
  if (g === 'arm-token' || g === 'arm-warrior' || g === 'arm-reset') {
    Armory.tokens(state);   // makes sure the armory fields exist
    if (g === 'arm-token') state.dev.armory.bonusTokens++;
    else if (g === 'arm-warrior') state.dev.armory.bonusWarriors++;
    else { state.armory = { claims: [], wearing: {} }; state.dev.armory = { bonusTokens: 0, bonusWarriors: 0 }; }
    render(); return;
  }
  if (g === 'day1' || g === 'day2') { state.dayOffset += g === 'day1' ? 1 : 2; if (ui.screen === 'practice' || ui.screen === 'levelup') { server.endSession(ui.sessionId); } ui.screen = 'home'; }
  else if (g === 'day0') { state.dayOffset = 0; ui.screen = 'home'; }
  else if (g === 'sim') { M.simulateSession(server, { pBase: 0.82 }); ui.screen = 'home'; ui.pulse = true; }
  else if (g === 'sample') { state = makeSample(); server = M.createServer(state); ui.screen = 'home'; }
  else if (g === 'fresh') { try { localStorage.removeItem(KEY); } catch (err) {} ui.setupGrade = 3; ui.screen = 'setup'; }
  render();
});
$glass.addEventListener('change', e => {
  if (e.target.id === 'g-lively') { setLively(e.target.checked); render(); return; }
  if (e.target.id === 'g-lanes') state.dev.alwaysOfferLanes = e.target.checked;
  if (e.target.id === 'g-focus') state.dev.focusOverride = e.target.value || null;
  if (ui.screen === 'home' || ui.screen === 'badges') render(); else { renderGlass(); save(); }
});

render();
})();
