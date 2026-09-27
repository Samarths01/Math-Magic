export interface Rat { n: number; d: number }

export function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = a % b; a = b; b = t; }
  return a;
}

/** Reduced rational with a positive denominator. */
export function R(n: number, d = 1): Rat {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}

export const eqR = (a: Rat, b: Rat): boolean => a.n * b.d === b.n * a.d;

export function fmtR(r: Rat, form?: string | null): string {
  if (r.d === 1) return String(r.n);
  if (form === 'mixed' && r.n > r.d) return Math.floor(r.n / r.d) + ' ' + (r.n % r.d) + '/' + r.d;
  return r.n + '/' + r.d;
}
