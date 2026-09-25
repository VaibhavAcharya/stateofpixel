export function matchesBranch(pattern: string, branch: string): boolean {
  const source = pattern
    .trim()
    .split("**")
    .map((part) =>
      part
        .split("*")
        .map((text) => text.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
        .join("[^/]*"),
    )
    .join(".*");
  return new RegExp(`^${source}$`).test(branch);
}
