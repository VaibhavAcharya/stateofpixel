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

export function isKeptBranch(
  project: { defaultBranch: string; autoApproveBranches: string[] },
  branch: string,
): boolean {
  return (
    branch === project.defaultBranch ||
    project.autoApproveBranches.some((pattern) =>
      matchesBranch(pattern, branch),
    )
  );
}
