# Math Sprout

Built from *Math Sprout Consolidated Specs (2026-09-25)*. `HANDOFF.md` is the build brief; `CLAUDE.md` holds the project rules.

## Layout

| Path | What it is |
|---|---|
| `src/engine/` | The engine, rules-v1, in TypeScript with no I/O. Ported from `prototype/engine.js` with no behavior change. |
| `tests/` | Vitest suite. `gates.test.ts` and `bus.test.ts` are the deploy gates, ported from the prototype. `parity.test.ts` runs the prototype and the port side by side and requires identical state and payloads. |
| `prototype/` | The original playable prototype. It is the reference behavior for the port. |

### Engine modules (`src/engine/`)

| Module | Role |
|---|---|
| `config.ts` | Every tunable number (`CONFIG`). All are uncalibrated stubs. |
| `content/` | Concept graph (`skills.ts`) and the 44 templates, one file per skill. |
| `pools.ts` | Deterministic item pools per template version and step; bug values per item. |
| `parse.ts` | The single answer grammar and form rules. |
| `learner.ts` | Learner state as a pure replay of attempts: bands, steps, unlocking, focus choice. |
| `issue.ts` | Issuance: 7-day no-repeat, template rotation, exhaustion fallbacks. |
| `bus.ts` | QualifyingEvent bus and credit-only ledger; flame and BuildGoal pieces derived from events. |
| `feedback.ts` | Verdict-first feedback frames from template metadata. |
| `views.ts` | Client-facing payloads (home, badges, items) and the dev inspector. |
| `server.ts` | `createServer(state, clock)`: the only entry point that drives the engine. |
| `sim.ts` | Simulated learner for gates and the dev sample week. |

## Commands

```bash
npm install
npm run check          # type-check + full test suite (the deploy gate)
npm test               # tests only
npm run prototype:test # the original node gates.js / bustest.js
```

The prototype still runs as-is: open `prototype/index.html`, or rebuild it with `cd prototype && python3 build.py`.
