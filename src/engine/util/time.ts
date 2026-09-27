export const DAY = 864e5;

/* NOTE: dayKey uses the host's local time zone, as the prototype does. §5 invariant 12
   (day from child.timezone) lands with the schema in build step 3. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** Whole days from day key a to day key b. */
export function dayDiff(a: string, b: string): number {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 864e5);
}
