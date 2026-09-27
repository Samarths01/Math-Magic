/* Every tunable number lives here. None of them are calibrated: they are stubs
   until dogfood locks them (Opportunity §11, stamp 6). */
export const CONFIG = {
  POLICY_VERSION: 'rules-v1',
  SESSION_ITEMS: 12,            // IA §7 directional 8–12
  MIX_SLOTS: [3, 6, 9, 11],     // 1-based slots filled by interleaved skills; the rest are focus
  QPD_K: 5,                     // honest attempts for a QualifyingPracticeDay (≥1 Recommended/Challenge)
  MIN_LATENCY_MS: 1000,         // below this an answer is not an HonestAttempt
  FAST_GUESS_MS: 2000,          // instrument only (ML note)
  RT_CAP_MS: 120000,            // response-time clamp (ML note, 4:44pm)
  NO_REPEAT_DAYS: 7,
  BAND_WINDOW: 8, BAND_MIN: 6, GETTING_IT: 0.6, GOT_IT: 0.85, GOT_IT_RUN: 3,
  STEP_UP_RUN: 3, STEP_DOWN_MISSES: 3, STEP_DOWN_WINDOW: 4,
  REVIEW_PER_WEEK: 2, REVIEW_XP_MULT: 0.4,
  XP: { correct: 10, challenge: 15, effort: 3, tick: 15, band: 30, levelUp: 25 },
  TICK_DELTA: 0.34, TICK_MIN: 6,
  PIECES_PER_GOAL: 5, FLAME_MILESTONES: [3, 7, 14],
  FOCUS_MAX_SESSIONS: 4,        // rotate focus if the band hasn't moved up in this many focus sessions
  POOL_FLOOR_TEMPLATE: 10, POOL_FLOOR_SKILL: 20, POOL_CAP: 80,
};

export type Config = typeof CONFIG;
