import { matchesBranch } from "./matchesBranch.ts";

const VARIANT_SUFFIX = /^(.*?)\s*\[[^\]]+\]$/;

export function isUnstable(patterns: string[], name: string): boolean {
  const story = VARIANT_SUFFIX.exec(name)?.[1] ?? name;
  return patterns.some(
    (pattern) => matchesBranch(pattern, name) || matchesBranch(pattern, story),
  );
}
