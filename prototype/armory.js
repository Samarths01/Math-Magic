/* Armory (prototype of spec proposal 2026-09-27). Plays the "server" role, like engine.js.
   Forge tokens are never stored: they are derived from the event log (earned from BuildPieceUnlock
   events and finished warriors) minus what has been claimed. XP is never spent and never drops.
   Items are fixed and visible up front: rarity means cost, never chance. Claims are permanent. */
(function (G) {
'use strict';
const M = G.MathSprout;

/* Uncalibrated stubs, like everything in CONFIG. */
const ARMORY = { TOKENS_PER_PIECE: 1, TOKENS_PER_WARRIOR: 2, COST: { common: 1, rare: 3, legendary: 5 }, LEGENDARY_NEEDS_WARRIORS: 1 };

const SLOTS = ['helmet', 'shield', 'cape', 'sword', 'boots'];
const SLOT_NAMES = { helmet: 'Helmet', shield: 'Shield', cape: 'Cape', sword: 'Sword', boots: 'Boots' };
const it = (id, slot, name, rarity, mat, deco) => ({ id, slot, name, rarity, mat, deco: deco || null, cost: ARMORY.COST[rarity] });
const ITEMS = [
  it('bronze-helm', 'helmet', 'Bronze helmet', 'common', 'bronze'),
  it('plume-helm', 'helmet', 'Plumed helmet', 'rare', 'silver', 'plume'),
  it('crown-helm', 'helmet', 'Crown helm', 'legendary', 'gold', 'crown'),
  it('bronze-shield', 'shield', 'Bronze shield', 'common', 'bronze'),
  it('star-shield', 'shield', 'Star shield', 'rare', 'silver', 'star'),
  it('sun-shield', 'shield', 'Sun shield', 'legendary', 'gold', 'sun'),
  it('night-cape', 'cape', 'Night cape', 'common', 'night'),
  it('starry-cape', 'cape', 'Starry cape', 'rare', 'night', 'stars'),
  it('royal-cape', 'cape', 'Royal cape', 'legendary', 'royal', 'trim'),
  it('bronze-sword', 'sword', 'Bronze sword', 'common', 'bronze'),
  it('gem-sword', 'sword', 'Gem sword', 'rare', 'silver', 'gem'),
  it('gold-sword', 'sword', 'Golden sword', 'legendary', 'gold', 'gem'),
  it('bronze-boots', 'boots', 'Bronze boots', 'common', 'bronze'),
  it('winged-boots', 'boots', 'Winged boots', 'rare', 'silver', 'wings'),
];
const ITEM = Object.fromEntries(ITEMS.map(x => [x.id, x]));

function ensure(S) {
  if (!S.armory) S.armory = { claims: [], wearing: {} };
  if (!S.dev.armory) S.dev.armory = { bonusTokens: 0, bonusWarriors: 0 };   // dev panel only; never shown to a child
  return S.armory;
}

/* Tokens: earned from mastery events, minus claims. A derived count, not a counter. */
function tokens(S) {
  ensure(S);
  const pieces = S.events.filter(e => e.type === 'BuildPieceUnlock').length;
  const warriors = Math.floor(pieces / M.CONFIG.PIECES_PER_GOAL) + S.dev.armory.bonusWarriors;
  const earned = pieces * ARMORY.TOKENS_PER_PIECE + warriors * ARMORY.TOKENS_PER_WARRIOR + S.dev.armory.bonusTokens;
  const spent = S.armory.claims.reduce((n, c) => n + ITEM[c.item].cost, 0);
  return { earned, spent, available: earned - spent, warriors };
}

const owns = (S, id) => ensure(S).claims.some(c => c.item === id);

function view(S) {
  const t = tokens(S), A = ensure(S);
  return {
    tokens: t,
    items: ITEMS.map(x => {
      const owned = owns(S, x.id), wearing = A.wearing[x.slot] === x.id;
      const needsWarrior = x.rarity === 'legendary' && t.warriors < ARMORY.LEGENDARY_NEEDS_WARRIORS;
      return { ...x, owned, wearing, needsWarrior, affordable: !owned && !needsWarrior && t.available >= x.cost, saved: Math.min(t.available, x.cost) };
    }),
  };
}

function claim(S, id, now) {
  const x = ITEM[id]; if (!x) return { error: 'unknown-item' };
  const A = ensure(S); const t = tokens(S);
  if (owns(S, id)) return { error: 'already-owned' };
  if (x.rarity === 'legendary' && t.warriors < ARMORY.LEGENDARY_NEEDS_WARRIORS) return { error: 'needs-warrior' };
  if (t.available < x.cost) return { error: 'not-enough-tokens' };
  A.claims.push({ item: id, at: now }); A.wearing[x.slot] = id;          // append-only claim; wear it straight away
  return { ok: true, item: x, tokens: tokens(S).available };
}

/* Wear an owned item, or null to go back to the starter Sprout look for that slot. */
function wear(S, slot, id) {
  const A = ensure(S);
  if (id && (!ITEM[id] || ITEM[id].slot !== slot || !owns(S, id))) return { error: 'not-owned' };
  if (id) A.wearing[slot] = id; else delete A.wearing[slot];
  return { ok: true };
}

/* The current look: slot → item (or undefined for the starter look). */
function look(S) { const A = ensure(S); return Object.fromEntries(SLOTS.map(s => [s, A.wearing[s] ? ITEM[A.wearing[s]] : undefined])); }

G.Armory = { ARMORY, SLOTS, SLOT_NAMES, ITEMS, ITEM, tokens, view, claim, wear, look };
})(typeof window !== 'undefined' ? window : globalThis);
