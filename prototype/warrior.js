/* The Sprout warrior: a full-body chibi knight, drawn as SVG. Shared by the app and design showcases.
   have  = pieces earned on the current warrior (0-5). Unearned slots are dashed outlines.
   look  = slot → armory item (or nothing for the starter Sprout gear, which is violet).
   fresh = piece index to flash (the one just earned), or -1.
   Gear is most of the silhouette on purpose: higher tiers change shape (crown, kite shield, long
   cape, bigger blade, wings), not just colour. Nothing here is green, because green means Correct. */
(function (G) {
'use strict';
const INK = '#1F2A44', GHOST = '#C7CFDB';
const MAT = { sprout: ['#7C5CBF', '#5E3FA3'], bronze: ['#C58A4B', '#7A4E26'], silver: ['#C3CBD8', '#5E6A80'], gold: ['#E8B923', '#8A6500'], night: ['#2B3A67', '#141C33'], royal: ['#5E3FA3', '#3E2775'] };
const SLOT_OF = ['boots', 'shield', 'cape', 'helmet', 'sword'];           // piece index → armory slot
const starPts = (cx, cy, r) => Array.from({ length: 10 }, (_, k) => { const a = Math.PI / 5 * k - Math.PI / 2, rr = k % 2 ? r * .45 : r; return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`; }).join(' ');
const RANK = { common: 0, rare: 1, legendary: 2 };

/* Each slot draws itself for a tier: 'ghost' (not earned), 'starter', or the item's rarity. */
const fillOf = (m, ghost) => ghost ? `fill="none" stroke="${GHOST}" stroke-dasharray="4 4"` : `fill="${m[0]}" stroke="${m[1]}"`;

function cape(tier, m, ghost, deco) {
  const long = tier === 'legendary', mid = tier === 'rare';
  const x0 = long ? 16 : mid ? 22 : 28, y = long ? 142 : mid ? 137 : 130;
  let s = `<path d="M40 74 L${x0} ${y} Q60 ${y + 8} ${120 - x0} ${y} L80 74 Z" ${fillOf(m, ghost)} stroke-width="2.2" stroke-linejoin="round"/>`;
  if (!ghost && deco === 'stars') s += `<polygon points="${starPts(27, 124, 4.5)}" fill="#E8B923"/><polygon points="${starPts(93, 124, 4.5)}" fill="#E8B923"/><polygon points="${starPts(89, 136, 3.2)}" fill="#E8B923"/>`;
  if (!ghost && deco === 'trim') s += `<path d="M${x0 + 2} ${y - 4} Q60 ${y + 5} ${118 - x0} ${y - 4}" fill="none" stroke="#E8B923" stroke-width="3.5" stroke-linecap="round"/>`;
  return s;
}
function boots(tier, m, ghost, deco) {
  let s = `<rect x="43" y="114" width="14" height="26" rx="3.5" ${fillOf(m, ghost)} stroke-width="2"/><rect x="63" y="114" width="14" height="26" rx="3.5" ${fillOf(m, ghost)} stroke-width="2"/>`;
  if (!ghost && deco === 'wings') s += `<path d="M43 124 C33 116 29 126 38 132 Z M77 124 C87 116 91 126 82 132 Z" fill="#fff" stroke="#5E6A80" stroke-width="1.8" stroke-linejoin="round"/>`;
  return s;
}
function shield(tier, m, ghost, deco) {
  if (ghost) return `<circle cx="27" cy="100" r="13" fill="none" stroke="${GHOST}" stroke-width="2" stroke-dasharray="4 4"/><circle cx="28" cy="106" r="6" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
  if (tier === 'legendary') return `<path d="M10 83 H44 V102 Q44 121 27 131 Q10 121 10 102 Z" fill="${m[0]}" stroke="${m[1]}" stroke-width="2.4" stroke-linejoin="round"/>` +
    (deco === 'sun' ? `<circle cx="27" cy="102" r="6.5" fill="#fff" stroke="${m[1]}" stroke-width="1.6"/><path d="M27 89v4M27 111v4M14 102h4M36 102h4M18 93l3 3M33 108l3 3M36 93l-3 3M21 108l-3 3" stroke="${m[1]}" stroke-width="2" stroke-linecap="round"/>` : '');
  const r = tier === 'rare' ? 16 : tier === 'common' ? 14.5 : 13;
  let s = `<circle cx="27" cy="100" r="${r}" fill="${m[0]}" stroke="${m[1]}" stroke-width="2.4"/><circle cx="27" cy="100" r="${r - 5}" fill="none" stroke="${m[1]}" stroke-width="1.4" opacity=".6"/>`;
  if (deco === 'star') s += `<polygon points="${starPts(27, 100, 8.5)}" fill="#fff" stroke="${m[1]}" stroke-width="1.4" stroke-linejoin="round"/>`;
  return s;
}
function sword(tier, m, ghost, deco) {
  const bw = tier === 'legendary' ? 10 : tier === 'rare' ? 7 : 6, top = tier === 'legendary' ? 20 : tier === 'rare' ? 36 : tier === 'common' ? 46 : 54;
  const blade = tier === 'legendary' ? ['#FFF4C4', m[1]] : tier === 'rare' ? ['#E6EBF2', m[1]] : [m[0], m[1]];
  const guard = tier === 'legendary' ? 28 : 20;
  let s = `<path d="M${92 - bw / 2} 98 V${top + 7} L92 ${top} L${92 + bw / 2} ${top + 7} V98 Z" ${ghost ? `fill="none" stroke="${GHOST}" stroke-dasharray="4 4"` : `fill="${blade[0]}" stroke="${blade[1]}"`} stroke-width="1.8" stroke-linejoin="round"/>`;
  if (!ghost) s += `<rect x="${92 - guard / 2}" y="96" width="${guard}" height="5" rx="2" fill="${m[1]}"/><rect x="89.5" y="101" width="5" height="11" fill="${INK}"/>` + (deco === 'gem' ? `<circle cx="92" cy="98.5" r="3.2" fill="#9B7FD9" stroke="#fff" stroke-width="1"/>` : '');
  return s + `<circle cx="92" cy="106" r="6" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
}
function helmet(tier, m, ghost, deco) {
  const dome = `<path d="M35 55 C35 22 85 22 85 55 C80 44 40 44 35 55 Z" ${fillOf(m, ghost)} stroke-width="2.4" stroke-linejoin="round"/>`;
  if (ghost) return dome;
  let s = dome + `<rect x="33" y="48" width="8" height="18" rx="3" fill="${m[0]}" stroke="${m[1]}" stroke-width="2"/><rect x="79" y="48" width="8" height="18" rx="3" fill="${m[0]}" stroke="${m[1]}" stroke-width="2"/>`;
  if (deco === 'plume') s += `<path d="M84 40 C98 30 102 14 94 8 C92 20 86 30 80 36 Z" fill="#9B7FD9" stroke="#5E3FA3" stroke-width="2" stroke-linejoin="round"/>`;
  if (deco === 'crown') s += `<path d="M39 35 L42 18 L51 28 L60 12 L69 28 L78 18 L81 35 Z" fill="#E8B923" stroke="#8A6500" stroke-width="2" stroke-linejoin="round"/><circle cx="60" cy="27" r="2.8" fill="#9B7FD9"/>`;
  return s;
}
const DRAW = { cape, boots, shield, sword, helmet };

const leaves = (x, y, sc) => `<g transform="translate(${x},${y}) scale(${sc})"><path d="M0 20 V0" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M0 7 C-14 -7 -28 -1 -25 8 C-18 13 -7 11 0 7 Z" fill="#F2F4F8" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M0 3 C13 -14 29 -9 27 -1 C22 7 9 7 0 3 Z" fill="#F2F4F8" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/></g>`;

function sprout(have, cls, fresh, look) {
  look = look || {};
  const part = i => {
    const slot = SLOT_OF[i], item = look[slot], ghost = i >= have;
    const tier = item ? item.rarity : 'starter', m = MAT[(item && item.mat) || 'sprout'];
    const svg = DRAW[slot](tier, m, ghost, item && item.deco);
    return i === fresh ? `<g class="fresh">${svg}</g>` : svg;
  };
  // set bonus: every legendary slot earned and worn → a golden aura that stays
  const legendary = SLOT_OF.filter((s, i) => i < have && look[s] && look[s].rarity === 'legendary').length;
  const aura = legendary >= 4 ? `<circle cx="60" cy="82" r="58" fill="#E8B923" opacity=".14"/><circle cx="60" cy="82" r="44" fill="#E8B923" opacity=".12"/><polygon points="${starPts(12, 32, 5)}" fill="#E8B923"/><polygon points="${starPts(108, 44, 4)}" fill="#E8B923"/><polygon points="${starPts(106, 130, 3.5)}" fill="#9B7FD9"/>` : '';
  const helmOn = have > 3;
  return `<svg class="${cls || 'sprout'}" viewBox="0 0 120 150" role="img" aria-label="Sprout warrior with ${have} of 5 pieces">
    ${aura}${part(2)}${part(0)}
    <rect x="37" y="72" width="46" height="50" rx="13" fill="#EFEAF8" stroke="#5E3FA3" stroke-width="2.4"/>
    <path d="M48 73 L60 85 L72 73" fill="none" stroke="#5E3FA3" stroke-width="2"/><rect x="40" y="105" width="40" height="7" fill="#5E3FA3"/>
    ${part(4)}${part(1)}
    ${leaves(60, helmOn ? 4 : 10, .8)}
    <circle cx="60" cy="52" r="24" fill="#fff" stroke="${INK}" stroke-width="3"/>
    <circle cx="52" cy="56" r="3.4" fill="${INK}"/><circle cx="68" cy="56" r="3.4" fill="${INK}"/>
    <path d="M54 63 Q60 68 66 63" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
    ${part(3)}
  </svg>`;
}

G.Warrior = { sprout, MAT, SLOT_OF, RANK };
})(typeof window !== 'undefined' ? window : globalThis);
