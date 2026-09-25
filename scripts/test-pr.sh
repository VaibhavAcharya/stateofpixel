#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: scripts/test-pr.sh <no-change|color-change|layout-shift|add-page|remove-page>" >&2
  exit 1
}

scenario="${1:-}"
case "$scenario" in
  no-change) expected="success, No visual changes" ;;
  color-change) expected="action_required, 1 change to review (buttons)" ;;
  layout-shift) expected="action_required, 2 changes to review (buttons, card)" ;;
  add-page) expected="action_required, 1 change to review (badge added)" ;;
  remove-page) expected="success, No visual changes (card removed)" ;;
  *) usage ;;
esac

repo_root="$(git rev-parse --show-toplevel)"
branch="test-pr/${scenario}-$(date +%Y%m%d%H%M%S)"
worktree="$(mktemp -d)"
trap 'git -C "$repo_root" worktree remove --force "$worktree" >/dev/null 2>&1 || true' EXIT

git -C "$repo_root" fetch --quiet origin main
git -C "$repo_root" worktree add --quiet -b "$branch" "$worktree" origin/main
pages="$worktree/examples/playground/pages"

case "$scenario" in
  no-change)
    date -u +%Y-%m-%dT%H:%M:%SZ > "$worktree/examples/playground/last-test-pr.txt"
    ;;
  color-change)
    sed -i.bak 's/--accent: #171717;/--accent: #0068d6;/' "$pages/styles.css"
    ;;
  layout-shift)
    sed -i.bak 's/padding: 32px;/padding: 40px;/' "$pages/styles.css"
    ;;
  add-page)
    cat > "$pages/badge.html" <<'HTML'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <span class="button primary" style="display: inline-flex; align-items: center">New</span>
  </body>
</html>
HTML
    ;;
  remove-page)
    rm "$pages/card.html"
    ;;
esac
rm -f "$pages"/*.bak

git -C "$worktree" add -A
git -C "$worktree" commit --quiet -m "test: ${scenario} scenario"
git -C "$worktree" push --quiet -u origin "$branch"
gh pr create --draft --head "$branch" --base main \
  --title "test: ${scenario} scenario" \
  --body "Scripted dogfooding PR from \`scripts/test-pr.sh ${scenario}\`. Expected \`stateofpixel/playground\` check: ${expected}."
