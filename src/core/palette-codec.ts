import { SYMBOLS } from "./skin";

export const tokenWidth = (size: number) => (size > 64 ? 2 : 1);
export const transparentToken = (size: number) => (size > 64 ? ".." : ".");
export const colorToken = (index: number, size: number) =>
  size > 64 ? index.toString(16).padStart(2, "0") : SYMBOLS[index];
export const tokenIndex = (token: string, size: number) =>
  size > 64
    ? /^[0-9a-f]{2}$/.test(token)
      ? parseInt(token, 16)
      : -1
    : SYMBOLS.indexOf(token);
export function splitRow(row: string, size: number): string[] {
  return size > 64 ? (row.match(/.{1,2}/g) ?? []) : [...row];
}
export function rowPattern(
  width: number,
  size: number,
  transparent: boolean,
  subset?: string[],
) {
  let token: string;
  if (subset)
    token = `(?:${subset.map((t) => t.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")).join("|")})`;
  else if (size <= 64)
    token = `[${SYMBOLS.slice(0, size).replace(/-/g, "\\-")}${transparent ? "." : ""}]`;
  else {
    const hex = "0123456789abcdef",
      full = Math.floor(size / 16),
      tail = size % 16;
    const alternatives = [];
    if (full) alternatives.push(`[${hex.slice(0, full)}][0-9a-f]`);
    if (tail) alternatives.push(`${hex[full]}[${hex.slice(0, tail)}]`);
    if (transparent) alternatives.push("\\.\\.");
    token = `(?:${alternatives.join("|")})`;
  }
  return `^${token}{${width}}$`;
}
