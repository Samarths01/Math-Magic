/** Digits, ones first. */
export const digits = (n: number): number[] => String(n).split('').map(Number).reverse();
export const fromDigits = (ds: number[]): number => ds.reduceRight((acc, d) => acc * 10 + d, 0);

/** Column sum that drops every carry. */
export function colSumNoCarry(...ns: number[]): number {
  const L = Math.max(...ns.map(n => String(n).length)); const out: number[] = [];
  for (let i = 0; i < L; i++) out.push(ns.reduce((s, n) => s + (digits(n)[i] || 0), 0) % 10);
  return fromDigits(out);
}
/** Column sum that writes both digits of each column total. */
export function colSumConcat(a: number, b: number): number {
  const L = Math.max(String(a).length, String(b).length); let s = '';
  for (let i = L - 1; i >= 0; i--) s += String((digits(a)[i] || 0) + (digits(b)[i] || 0));
  return Number(s);
}
/** Column difference that takes the smaller digit from the larger. */
export function colDiff(a: number, b: number): number {
  const L = String(a).length; const out: number[] = [];
  for (let i = 0; i < L; i++) out.push(Math.abs((digits(a)[i] || 0) - (digits(b)[i] || 0)));
  return fromDigits(out);
}
export function carries(a: number, b: number): number {
  let c = 0, n = 0; const L = Math.max(String(a).length, String(b).length);
  for (let i = 0; i < L; i++) { const s = (digits(a)[i] || 0) + (digits(b)[i] || 0) + c; c = s >= 10 ? 1 : 0; n += c; }
  return n;
}
export function borrows(a: number, b: number): number {
  let br = 0, n = 0; const L = String(a).length;
  for (let i = 0; i < L; i++) { const t = (digits(a)[i] || 0) - br - (digits(b)[i] || 0); br = t < 0 ? 1 : 0; n += br; }
  return n;
}

export const PLACE = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands'];
export const fmtN = (n: number): string => n >= 1000 ? n.toLocaleString('en-US') : String(n);
/** Blank marker inside stems. */
export const B = '▢';
