# Math Sprout: project instructions

- **Start here:** `HANDOFF.md` is the build brief. `docs/Math-Sprout-Consolidated-Specs-2026-09-25.pdf` is the spec. Newer dated sections supersede older ones; follow the compiler's currency notes.
- **Review before commit:** work on a branch, keep one slice per PR, and show the plan and diff before committing. Never push to `main` without asking.
- **Rules only at runtime:** no LLM or ML in item generation, scoring, bands or minting.
- **`QualifyingEvent` is the only mint path.** Never add a parallel XP, flame or piece counter; those values are derived from the event log.
- **The server is authoritative.** Client payloads never include answers, params, `evidence_eligible`, `provenance`, `issue_reason`, raw confidence or percentages.
- **Kid-facing copy:** bands are *Still learning / Getting it / Got it*. No "AI thinks…", no streak shame, no percentages. Green is used only for Correct.
- **Tests are the deploy gate:** `gates.js` and `bustest.js` (Vitest once ported). A repeat within 7 days blocks deploy.
- Every tunable number lives in `CONFIG` and is an uncalibrated stub. Don't present any of them as validated.
