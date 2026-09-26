# Math Sprout — Build Handoff

**For:** Claude Code, working with Samarth
**Date:** 2026-09-25
**Starting point:** a playable prototype in this folder (`engine.js`, `app.js`, `style.css`) that passes the spec's deploy gates (`gates.js`, `bustest.js`).
**Goal:** turn the prototype into a real, hostable web app: TypeScript, a persistent server-authoritative backend, and a real test suite. Keep every behavior the prototype already gets right.

---

## 0. Read this first

1. **Source of truth, in order:**
   1. `docs/Math-Sprout-Consolidated-Specs-2026-09-25.pdf`. The specs follow a "supersede, don't erase" rule: newer dated sections win, and the grey *compiler's currency notes* say which passage is current.
   2. This document's §4 *Decisions made in the prototype*. These fill gaps in the spec or pick a side where it contradicts itself.
   3. The prototype code. It is the reference behavior, not the reference architecture.
2. **Ask Samarth before starting:** build inside the existing repo `Samarths01/Math-Sprout` (the spec references its PRs and files, such as `lib/qualifying-bus.ts`), or start a fresh repo from this folder? If the existing repo is chosen, read it first and reconcile it with this document before writing code.
3. **Working style:** Samarth reviews before anything is committed. Work on a branch, keep PRs small (one slice each), and don't push to `main` without asking.

---

## 1. What the product is, in one screen

A motivation and mastery loop for kids practicing grades 2–4 number sense, operations and fractions. It is web-first, with the child as the primary user and the parent as the root of trust.

- **Two engines, one bus.** Adaptive progression decides what comes next and how hard. Gamification (XP, a flame streak, one avatar-warrior BuildGoal) supplies the reason to keep going. **`QualifyingEvent` is the only thing that can mint rewards.** There is no parallel "soft XP" path.
- **Rules only at runtime.** No LLM and no ML in the practice path. Items come from deterministic templates, and the code computes every answer.
- **The server is authoritative** for generation, scoring, time, bands and minting. The client renders what it's given and never sees an answer before the child submits.

---

## 2. What exists and is verified

| Area | Status in prototype | Verified by |
|---|---|---|
| Concept graph: 11 skills with prerequisite edges | Done | — |
| 44 templates (4 per skill) × 3 difficulty steps, bug rules → `oneFocus`, `whyItWorks` where real | Done | `gates.js` (copy has no NaN or undefined; bug values never equal the answer) |
| Deterministic pools, snapshotted per template version and step | Done | `gates.js` (floors of 10 per template-step and 20 per skill-step; smallest skill-step pool is 89) |
| Issuance: 7-day no-repeat, least-recently-seen template, no back-to-back template, fallback to `exhausted_switch` then `exhausted_repeat` (never step up), `template_switch` | Done | `gates.js` (12 seven-day sims, zero repeats) |
| Answer parser: whole, fraction, mixed. Forms `any`, `lowest`, `improper`, `mixed`. Unreadable input is not an attempt. Right value in the wrong form is a scored Not yet | Done | `gates.js` parser rulings from the ML note |
| Learner state as a pure replay of attempts: bands, `assignedStep`, level-ups, `bandLog` | Done | `bustest.js` |
| QE bus and credit-only ledger: HonestAttempt, QualifyingPracticeDay, LevelUpSlight, MasteryBandTransition, BadgeMilestone, BuildPieceUnlock, ConceptProgressTick | Done | `bustest.js` |
| Flame: Hot, Warm, Ember, Resting from qualifying days only | Done | `bustest.js` |
| Review dual cap: 2 sessions a week, 0.4× XP, no band/level-up/piece/badge, can't light the flame | Done | `bustest.js` |
| Same-key replay returns the original response and mints nothing | Done (keyed by `item_instance_id`) | `bustest.js` |
| UI: home (IA §9 order), lane choice, practice with slim fuel strip and reward line, verdict-first Correct / Not yet frames, wrong-form copy (IA §12b), unreadable hint (IA §12a), level-up frame, end card, badges with the Sprout warrior | Done | Manual play-through at desktop and phone width |
| Session summary **records** (§11f / Arch §30) | **Not built.** The end card shows fuel chips, the progress tick, and minutes/questions only | — |
| Parent surface, consent, pause/revoke (Phase D) | **Not built** | — |
| Offline queue and batch (§18, §24, §26.6, §27) | **Not built** | — |
| Persistence | `localStorage`, one child, one browser | — |

---

## 3. Target architecture (recommended; confirm with Samarth)

| Layer | Recommendation | Why |
|---|---|---|
| App | **Next.js (App Router) + TypeScript** | Web-first lock; one repo for the client and the API routes; hostable in minutes |
| Domain core | `packages/engine` (or `src/engine`): **pure TypeScript with no I/O**, ported from `engine.js` | The spec requires learner state to be a pure, replayable function of stored attempts under `policy_version` |
| DB | **Postgres** (Neon or Supabase) with Drizzle ORM | Append-only tables, unique constraints for idempotency, transactions for the mint path |
| Tests | **Vitest** for the engine and API; **Playwright** for one play-through | Port `gates.js` and `bustest.js` directly; they become the CI deploy gate |
| Hosting | Vercel (or similar) | Shortest path to a working URL |
| Auth | Deferred for dogfood (one household). Model `guardian → child_profile` now so it isn't a rewrite later | The parent is the root of trust (Arch §2) |

**Boundary rule:** the engine never imports DB code. An API route loads the child's rows, calls the engine, and writes the engine's outputs (new issued item, attempt, events, ledger rows, band-log rows) **in one transaction**. The prototype's `createServer(state)` shape already works this way: it reads and appends to arrays, and those arrays become tables.

### 3.1 Tables (append-only unless noted)

| Table | Key columns | Notes |
|---|---|---|
| `child_profiles` | id, guardian_id, name, grade_prior, timezone, seed | `grade_prior` only sets which skills are open (see §4.6) |
| `practice_sessions` | id, child_id, focus_skill, lane, plan (json), mix_skills (json), started_at, ended_at, band_at_start, step_at_start, abandoned | The plan is **frozen at creation** (Arch §31a addendum 3) |
| `issued_items` | item_instance_id, child_id, session_id, template_id, template_version, difficulty_step, params (json), param_hash, lane, issue_reason, evidence_eligible, shown_at, format_example, policy_version, build_sha | Store resolved params, never just a seed (Arch §26.2) |
| `attempts` | id, **item_instance_id (UNIQUE)**, child_id, session_id, skill, step, lane, outcome (`correct`/`wrong`/`form_mismatch`), bug_tag, typed_canonical, rt_ms (clamped 0–120000), fast_guess, honest, counts_for_band, submitted_at, day (child TZ), policy_version, response (json) | The UNIQUE constraint is the idempotency key. On conflict, return the stored `response` |
| `answer_format_rejects` | id, item_instance_id, template_id, template_version, answer_kind, reason, reject_seq, at | **Never** store the raw input (ML note) |
| `qe_events` | id, child_id, type, skill, item_instance_id, day, data (json), policy_version, at | The bus |
| `xp_ledger` | id, event_id (FK qe_events), xp (> 0) | Credit-only; enforce `CHECK (xp > 0)` |
| `band_log` | id, child_id, skill, from, to, item_instance_id, policy_version, at | Append-only. This unlocks the "First Got-it" record (§11f) |
| `templates` | id, version, skill, provenance (`seed`/`parent`/`ai_assisted`), evidence_eligible, answer_kind, form, content_hash | Arch §28 columns from day one, even though only `seed` exists now |

Derived and never stored as counters: XP total, flame state and count, BuildGoal pieces, band, `assignedStep`, template recency. These are computed from the tables above (Arch §25, §31a addendum 2).

### 3.2 API (shapes match the prototype's `createServer` methods)

| Route | Prototype method | Returns |
|---|---|---|
| `GET /api/home` | `homeView()` | name, focus {id, name, bandLabel}, fuel {flame {state, count}, xp, pieces {have, per, goal}}, laneOffer, reviewLeft |
| `POST /api/sessions {lane}` | `startSession(lane)` | sessionId, focus, lane, total |
| `POST /api/sessions/:id/next` | `nextItem(id)` | `{iid, skillName, step, lane, stem, layout, answerKind, formatExample, index, total}` or `{done:true}`. **No params, no answer** |
| `POST /api/attempts {iid, answer, rtMs, submittedAt}` | `submit(...)` | `format_rejected {hint}`, or scored `{correct, outcome, frame, clientView {bandLabel, showConceptChip, celebrationTier}, rewardLine, levelUp, fuel, mintedIds}` |
| `POST /api/sessions/:id/end` | `endSession(id)` | fuel, xpGained, piecesGained, tick, minutes, questions |
| `GET /api/badges` | `badgesView()` | skills with band and badge, pieces |
| `GET /api/dev/inspect` (dev only) | `inspect()` | Behind-the-glass data. Gate it behind an env flag |

A **leak test** must assert that no client payload contains `params`, the answer, `provenance`, `evidence_eligible`, `issue_reason`, `form_mismatch`, raw confidence or percentages (Arch §21.3, §28, §31a).

---

## 4. Decisions made in the prototype (fill gaps or resolve contradictions)

Flag any of these to Samarth before changing them.

1. **Session shape is focus-bounded with interleaving.** Samarth picked this over the 11-skill rotation. Each session has 12 items: 8 on the focus skill and 4 interleaved skills at slots 3, 6, 9 and 11, frozen on the session row. This resolves the conflict between Arch §4.3 and IA §9 (one focus) and the #16 rotation.
   - **Consequence:** the spec's pool floor of 20 per skill-step assumed rotation. With focus-bounded sessions, the worst case (stuck at one step, 2 sessions a day, 7 days) is about 112 items on one skill-step. Current smallest pool: 89 (`eq` step 1). The fallback covers it silently. **Add a gate that simulates a stuck learner, and widen pools until it passes.**
2. **The 11 skills.** The spec never lists them. These cover every skill the spec names by example: `pv` Place value · `add2` Adding two-digit numbers · `sub2` Subtracting two-digit numbers · `as3` Adding and subtracting bigger numbers · `mul` Multiplication facts · `div` Division facts · `mdm` Multiplying by one digit · `mn` Missing numbers · `uf` Naming and comparing fractions · `eq` Equivalent fractions (templates: scale, lowest, improper, mixed, per the spec) · `af` Adding and subtracting fractions. Prerequisite edges are in `engine.js` `SKILLS`.
3. **Config stubs** (all in `CONFIG`; none are calibrated):
   - Session: `SESSION_ITEMS 12`, `MIX_SLOTS [3,6,9,11]`
   - Qualifying day: `QPD_K 5`, with at least 1 Recommended or Challenge attempt
   - Integrity: `MIN_LATENCY_MS 1000` (below this, not an HonestAttempt), `FAST_GUESS_MS 2000` (instrument only), `RT_CAP_MS 120000`
   - Bands: `BAND_WINDOW 8`, `BAND_MIN 6`, `GETTING_IT 0.6`, `GOT_IT 0.85`, `GOT_IT_RUN 3`. Got it also needs one correct step-2+ answer from Recommended or Challenge
   - Steps: up after 3 correct in a row at or above the current step; down after 3 misses in the last 4 at the current step
   - Review: 2 sessions a week, 0.4× XP
   - XP: correct 10, Challenge correct 15, effort (honest miss or wrong form) 3, tick 15, band 30, level-up 25
   - BuildGoal: 5 pieces a goal. Pieces unlock on the **first** reach of each band per skill and on flame milestones 3, 7 and 14. `LevelUpSlight` earns XP and the level-up frame but no piece; otherwise pieces come too fast
   - Focus rotation: `FOCUS_MAX_SESSIONS 4`
   - **Known tuning issue:** "Got it" can arrive within one strong 12-item session. Candidates: raise `BAND_WINDOW` or require evidence across 2 or more sessions.
4. **Bug-rule collisions.** When a bug rule's output equals the correct value for a particular item (for example "forgot to regroup" on a sum with no regrouping), that **rule is dropped for that item**; the item is kept. The spec says the item is "rejected at draw time", which would empty every step-1 no-regroup pool. Confirm with Samarth/Signal.
5. **Integrity.** An answer is not an HonestAttempt (no XP, no QPD credit, not band evidence) when `rt < 1000ms`, or when it's the same wrong answer typed into 3 different items in a row. Blank submit is prevented in the UI (Check stays disabled), so `empty_answer` never occurs; add it server-side if another client can post blanks.
6. **Unlocking.** A skill is open if its `grade ≤ child.grade_prior`, if it has any attempts, or if every prerequisite is at Getting it or above. Grade is only a starting prior (memo §2).
7. **Level-up** is minted only when a skill reaches a **new max step**. Stepping down and back up again doesn't re-celebrate.
8. **Band transitions** are minted only on the first time a skill reaches each band, which blocks oscillation farming. Bands may still drop honestly, and a drop is never shown as a loss.
9. **Colors:** IA §13 exactly. **Green is only for Correct**, so the Sprout warrior companion is drawn in ink and neutrals, with violet pieces. Contrast text shades are in `style.css` (`--*-t`). Add the contrast test IA §13 asks for.
10. **Type:** Lexend (stems and UI; designed for early readers), Atkinson Hyperlegible (feedback text; distinguishes 1/l/I and 0/O), IBM Plex Mono (dev panel only).

---

## 5. Invariants: each one must be a test

1. Only the QE bus mints. XP total = sum of `xp_ledger`; every ledger row points to an event; `xp > 0`.
2. The client never receives an answer or params before submit (leak test).
3. Unreadable input writes no attempt row, emits no event, and doesn't use up the item. The retry happens on the same `item_instance_id`.
4. Right value in the wrong form is a scored Not yet with `reason: {kind: 'wrong_form', required}`. Effort XP counts toward the qualifying day, and there is no reward line.
5. The same `item_instance_id` submitted twice returns the identical stored response with zero new events.
6. No exact item repeats for a child within 7 days (the `shown_at` window), and never the same template back-to-back within a session.
7. Pool exhaustion: `exhausted_switch` (silent, normal evidence) → `exhausted_repeat` (new id, `evidence_eligible=false`). **Never step up.** `assignedStep` is never changed by issuance.
8. Review attempts are never band evidence, never mint LevelUp/Band/Badge/Piece, and a Review-only day can't light the flame.
9. Got it needs a correct step-2+ answer from Recommended or Challenge in the window.
10. Flame state depends only on qualifying days: Hot today, Warm yesterday, Ember after one missed day (count holds), Resting after two or more (shown as "Flame resting", never 0).
11. `celebrationTier = full` only when a band transition or level-up committed in the same transaction. Fails closed otherwise.
12. The day comes from the server-clamped time in `child.timezone`. A timezone change can't create a second qualifying day within 24 hours (§27).
13. The parent view never shows XP (for when Phase D lands).

---

## 6. Build order (one PR each)

1. **Port the engine to TypeScript.** Split it into `content/` (skills and templates), `pools`, `parse`, `issue`, `learner`, `bus`, `views`. Port `gates.js` and `bustest.js` to Vitest, all green. No behavior change: sample outputs from the prototype and the port should match for the same seed.
2. **Add the stuck-learner gate** (see §4.1) and widen pools until it passes.
3. **Schema and API routes** (§3.1, §3.2) with transactional mints and the UNIQUE idempotency constraint. Add the leak test.
4. **Port the UI** to React components with the same screens and CSS tokens. Keep the dev panel behind a flag. Add one Playwright play-through at 390px and 1180px.
5. **Deploy for dogfood** as one household, with `build_sha` stamped on issued items and attempts.
6. **Then, in the order Samarth prefers:** session summary records (§11f / Arch §30; needs `band_log`, which already exists) → parent one-breath surface and consent/pause/revoke (Phase D, memo §11b) → offline queue (§18, §24, §26.6, §27, and the late-replay and clamp rulings in the ML note).

---

## 7. Open questions for Samarth

- Build inside `Samarths01/Math-Sprout` or start a fresh repo? (See §0.)
- Stack confirmation (§3).
- Band speed: is "Got it" in one session too fast? (§4.3)
- Bug-rule collision handling (§4.4).
- Memo §8 items still open: monetization, positioning, tone lock, success thresholds.

---

## 8. Prompt to paste into Claude Code

> Read `CLAUDE.md`, then `HANDOFF.md`, then skim `docs/Math-Sprout-Consolidated-Specs-2026-09-25.pdf`. Run `node gates.js` and `node bustest.js` to confirm the prototype baseline is green. Then ask me the §7 open questions before writing any code. After I answer, start §6 step 1 (port the engine to TypeScript with the tests ported) on a new branch, and show me the plan before you commit.
