# Dogfood notes

Findings from playing the app, and what each one turned into. Newest first.
Type: **bug** · **copy** · **tuning** (a `CONFIG` value) · **feature** · **spec** (needs a dated spec section).

## 2026-09-27 · The warrior should show growth, and the kid should shape it

**Found by:** Samarth · **Type:** feature + spec

The power-up glow was hard to catch. It was small, in a corner and rare. More importantly, growth should *persist* in how the warrior looks.

**Done:**
- The power-up now plays at centre stage: the question dims and the warrior springs up large with the new piece.
- "Preview warrior power-up" in the dev panel replays it without minting anything.

**Decision (Samarth):** option 1 of three.
- Upgrades are bought with **forge tokens** earned from mastery: +1 per piece, +2 per finished warrior.
- The kid picks what to unlock, or saves for rarer gear (common 1 · rare 3 · legendary 5, and legendary needs a finished warrior).
- XP is never spent.
- We rejected spending XP directly. It would break "never take XP away" and the credit-only ledger, and it would tie gear to question volume.

**Prototype:** Badges → Armory.
- 14 items across 5 slots, with try-on, a confirm step and "N of M tokens saved".
- The chosen look shows everywhere the warrior appears.
- Dev controls: +1 token, +1 finished warrior, reset.

**Spec:** `docs/spec-proposals/2026-09-27-armory.md` needs Samarth's stamp. It includes the "not a shop" exception.

## 2026-09-27 · The run feels muted

**Found by:** Samarth · **Type:** feature + spec

The reward and motivation elements are too quiet during a session. What we saw:
- XP shows up as a small caption under three paragraphs, and nothing moves.
- A correct answer reads like an answer key. It's paced like a worksheet.
- The chip says "Still learning" right after "Correct".
- Nothing visibly builds toward what the run actually unlocks: today's flame, level-ups, pieces.
- The Sprout warrior only appears on the Badges screen.

**Experiment:** *Lively mode*, a switch in the dev panel (Behind the glass → Controls). It is off by default so you can compare the two.
1. The XP pill pops and flies into the counter, which counts up. Challenge answers get a bigger pill.
2. The progress bar becomes a path to today's flame. Honest answers fill it, and a flame marks where the qualifying day lands.
3. A flame-lit moment: the flame chip bursts and a line appears in the feedback.
4. The warrior rides along in the run. It hops on a correct answer, nods on an honest miss and powers up on a piece or level-up.
5. A lighter correct frame: verdict plus one line, with "Why it works" behind a tap. The level chip only appears when the level goes up.

Everything shown comes from events already minted for that answer, so it stays inside "celebrate only QualifyingEvents".

**Open decisions:**
- **Supersede IA §3.** It says progress within a session is "quiet". This needs a dated section if Lively mode is kept.
- **Auto-advance and sound.** Not built yet.
- **Hosted API fields.** The API will need to return the minted event types, the XP delta and a derived "flame today: have/need" count. The prototype reads these from its local event log.
