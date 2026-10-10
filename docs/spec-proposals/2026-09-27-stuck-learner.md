# Proposed spec section: The stuck learner: change the route, not the pool (2026-09-27)

**Status:** Proposal. Nothing is locked until Samarth stamps it. Direction agreed in chat 2026-09-29; this page makes it reviewable.
**Decision owner:** Samarth · **Drafted:** 2026-09-29
**Disposition:** Additive to the focus-bounded session rule (HANDOFF §4.1). It reopens no lock. It replaces the HANDOFF §6.2 plan ("widen pools until a stuck-learner gate passes") with a routing rule; pool widening becomes a safety margin.
**Prototype:** none. The engine change lives in `src/engine/learner.ts` (`chooseFocus`), the values in `CONFIG`.

## 1. Intent

The worst case in HANDOFF §4.1 is a child on one skill-step for 2 sessions a day over 7 days, about 112 items on it, mostly wrong. The pools can't hold that (smallest is 89, `eq` step 1), and the silent fallback then serves repeats that count as no evidence. The deeper problem is that the app keeps serving the same failing practice at all. Wheel-spinning research (Beck & Gong, 2013) finds that learners who haven't mastered a skill after roughly ten attempts rarely do with more of the same. So the fix is to change what the child is asked to do, not to make the pile bigger.

## 2. What exists today

- Step-down already happens inside `replaySkill`: 3 misses in the last 4 answers at a step drops the step by one.
- `FOCUS_MAX_SESSIONS` (4) rotates focus after 4 consecutive focus sessions with no band rise. Nothing else stops a child from repeating a skill, and `chooseFocus` can pick the same skill again when it is still the weakest.
- Nothing handles a child who is at step 1 and still failing, and nothing caps focus sessions on one skill per day.

## 3. Rules

1. **Stuck is derived, never stored.** A skill is *stuck* when its last `STUCK_SESSIONS` (stub: 2) focus sessions that had band-evidence attempts all have accuracy below `STUCK_ACC` (stub: 0.5), the band did not rise across them, and no new max step was reached. It is recomputed from attempts and sessions on every call. No stuck flag, counter or table (CLAUDE.md, "no parallel counters").
2. **Route in this order** when the skill the child would practise next is stuck:
   1. **Step down** if `step > 1`. This is the existing replay rule; stuck detection adds nothing here except counting toward rule 3.
   2. **At step 1, go to a prerequisite.** Focus becomes the unlocked prerequisite with the lowest band that is below Got it (ties: concept-graph order). This uses the existing `prereq` edges.
   3. **Otherwise rest the skill.** With no such prerequisite (`pv` and `uf` have none, or every prerequisite is at Got it), take the skill out of *focus* for `REST_DAYS` (stub: 2) days and pick the next-weakest unlocked skill. The rest is derived from the date of the session that made it stuck. A rested skill may still appear in the interleaved slots; that is light, spaced exposure.
3. **Daily cap.** A skill is the focus of at most `FOCUS_MAX_PER_DAY` (stub: 2) sessions in a child-day (the server-clamped day in `child.timezone`). A further session that day chooses a different focus. This alone cuts the 7-day worst case from about 112 items on one skill-step to about 32.
4. **Nothing about it is a status.** No client field says stuck, resting or falling behind. The child sees only the next focus skill name, as today.
5. **Rewards are untouched.** Honest attempts earn XP and light the flame exactly as before. A prerequisite session mints band and level-up events under the same rules; no "catch-up" bonus and no penalty.
6. **`assignedStep` is never changed by issuance.** Routing changes which skill is the focus, not the step a skill is served at (§5 invariant 7 still holds).
7. **Dev override wins.** `dev.focusOverride` bypasses routing, so the existing parity scenarios keep testing pool exhaustion directly.

## 4. Kid-facing copy (for the UI slice, not this one)

Framed as a choice and a build-up, never as failure:
- Going to a prerequisite: "Let's warm up with {skill} first." No "you're stuck", no "again", no "back".
- Resting: the child just gets a different focus. No message.
Bands stay *Still learning / Getting it / Got it*. No percentages, no streak shame.

## 5. Parent surface (Phase D, not built)

If a skill has been stuck across `STUCK_REPORT_RESTS` (stub: 3) rests, the parent one-breath surface may show one calm line, for example "{Skill} is taking a while; working through a few together might help." Derived from the same log. The parent view never shows XP.

## 6. Test gate

A stuck-learner gate in `tests/gates.test.ts`, run with no `focusOverride`, a simulated learner with a low `pBase` and `pStep: 0`, 2 sessions a day for 7 days:
- no skill is the focus of more than `FOCUS_MAX_PER_DAY` sessions on any day;
- once stuck at step 1 with an unmastered prerequisite, the next session's focus is that prerequisite;
- a stuck skill with no such prerequisite is not the focus during its rest, and returns afterwards;
- no attempt has `issueReason: 'exhausted_repeat'`;
- per-skill totals over the week stay under the smallest pool.

## 7. Open questions

- **Thresholds.** All five stubs (`STUCK_SESSIONS`, `STUCK_ACC`, `STUCK_MIN_ATTEMPTS`, `REST_DAYS`, `FOCUS_MAX_PER_DAY`) are guesses until dogfood. `STUCK_MIN_ATTEMPTS` (4) was added in the build: a session with fewer band-evidence attempts says nothing either way.
- **Streaks.** The weak-session streak resets after it triggers and after any good session, so a skill that comes back from a rest needs `STUCK_SESSIONS` fresh weak sessions to be stuck again.
- **Feels like a demotion?** Going to a prerequisite may read as being sent back a grade. Watch it in dogfood and tune the copy.
- **Rested skill in the mix.** Keeping it in the interleaved slots gives spaced exposure but also more misses. The alternative is to drop it from the mix for the same days.
- **Interaction with `FOCUS_MAX_SESSIONS`.** Kept as the general rotation; the stuck rule simply fires sooner (2 sessions instead of 4).
