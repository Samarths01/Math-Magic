import { CONFIG } from './config';
import { TPL, type Step, type Template } from './content';
import { hashStr, rng } from './util/random';
import { R, eqR, type Rat } from './util/rational';

/* Pools: deterministic, snapshotted per template version and step, counted after filters. */
export interface PoolEntry<P = any> { key: string; p: P }

const POOLS: Record<string, PoolEntry[]> = {};

export function itemKey(t: Template, step: Step, p: unknown): string { return `${t.id}@${t.ver}#${step}:${JSON.stringify(p)}`; }

function buildPool(t: Template, step: Step): PoolEntry[] {
  const r = rng(hashStr(`${t.id}@${t.ver}#${step}`)); const seen = new Set<string>(), out: PoolEntry[] = [];
  for (let i = 0; i < 4000 && out.length < CONFIG.POOL_CAP; i++) {
    const p = t.gen[step](r); if (!p) continue;
    const a = t.ans(p); if (!a || a.n < 0) continue;
    if (t.form === 'mixed' && a.d === 1) continue;          // mixed answers never come out whole
    const k = itemKey(t, step, p); if (seen.has(k)) continue; seen.add(k); out.push({ key: k, p });
  }
  return out;
}

export function pool(tid: string, step: Step): PoolEntry[] {
  const k = tid + '#' + step;
  return POOLS[k] || (POOLS[k] = buildPool(TPL[tid], step));
}

export interface BugValue { tag: string; v: Rat }

/* Bug values for one concrete item. A bug that equals the right value (after canonicalizing)
   doesn't apply to this item; the item is kept (HANDOFF §4.4, confirmed 2026-09-26). */
export function bugsFor(t: Template, p: unknown): BugValue[] {
  const a = t.ans(p), out: BugValue[] = [];
  for (const [tag, f] of t.bugs) {
    const raw = f(p); if (raw == null) continue;
    let v: Rat;
    if (typeof raw === 'number') { if (raw < 0 || !Number.isFinite(raw)) continue; v = R(raw); } else v = raw;
    if (v.n < 0 || v.d <= 0) continue; if (eqR(v, a)) continue; out.push({ tag, v });
  }
  return out;
}
