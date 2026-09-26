# Math Sprout — playable prototype (rules-v1)

Built from *Math Sprout Consolidated Specs (2026-09-25)*.

| File | What it is |
|---|---|
| `engine.js` | The "server": concept graph (11 skills), 44 templates × 3 steps, pools, issuance, answer parser, learner state, QualifyingEvent bus, XP ledger, flame, BuildGoal. All tunable numbers live in `CONFIG` at the top. |
| `app.js` | Child UI (home, lane choice, practice, feedback frames, level-up, end card, badges) + the "Behind the glass" inspector. Talks to the engine only through `createServer()`. |
| `style.css` | IA §13 color map; Lexend + Atkinson Hyperlegible. |
| `gates.js` | Deploy gates: pool floors (10/template/step, 20/skill/step), spec parser rulings, 7-day sims at 1 and 2 sessions/day in every lane — zero repeats, zero back-to-back templates. `node gates.js` |
| `bustest.js` | Bus/economy checks: no answers in payloads, unreadable ≠ attempt, replay idempotency, fast-guess mints nothing, flame Hot→Warm→Ember→Resting, Review can't light flame or mint mastery, credit-only ledger, wrong-form frame. `node bustest.js` |
| `build.py` | Inlines the three sources into `index.html`. `python3 build.py` |
