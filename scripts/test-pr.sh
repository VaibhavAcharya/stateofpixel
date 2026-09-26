#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: scripts/test-pr.sh <no-change|color-change|layout-shift|add-page|remove-page|add-story|remove-story|flaky|many-changes|sharded|restyle>" >&2
  exit 1
}

scenario="${1:-}"
case "$scenario" in
  no-change) expected="playground and storybook: success, No visual changes" ;;
  color-change) expected="playground: pending, 1 change to review (buttons). storybook: pending, 1 change to review (Button/Primary)" ;;
  layout-shift) expected="playground: pending, 2 changes to review (buttons, card). storybook: pending, 4 changes to review (every story)" ;;
  add-page) expected="playground: pending, 1 change to review (badge added). storybook: success, No visual changes" ;;
  remove-page) expected="playground: success, No visual changes (card removed). storybook: success, No visual changes" ;;
  add-story) expected="playground: success, No visual changes. storybook: pending, 1 change to review (Badge/Default added)" ;;
  remove-story) expected="playground: success, No visual changes. storybook: success, No visual changes (Card/Default removed)" ;;
  flaky) expected="playground and storybook: success, No visual changes (the animation is cancelled at capture)" ;;
  many-changes) expected="playground: pending, 23 changes to review (3 changed, 20 added). storybook: pending, 24 changes to review (4 changed, 20 added)" ;;
  restyle) expected="playground: pending, 3 changes to review. storybook: pending, 4 changes to review. web and web-storybook: pending, almost every snapshot changed" ;;
  sharded) expected="playground: success, No visual changes (1 auto shard, then finalize). storybook: success, No visual changes (2 shards)" ;;
  *) usage ;;
esac

repo_root="$(git rev-parse --show-toplevel)"
branch="test-pr/${scenario}-$(date +%Y%m%d%H%M%S)"
worktree="$(mktemp -d)"
trap 'git -C "$repo_root" worktree remove --force "$worktree" >/dev/null 2>&1 || true' EXIT

git -C "$repo_root" fetch --quiet origin main
git -C "$repo_root" worktree add --quiet -b "$branch" "$worktree" origin/main
pages="$worktree/examples/playground/pages"
stories="$worktree/examples/playground/stories"

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
  add-story)
    cat > "$stories/Badge.stories.js" <<'JS'
export default {
  title: "Badge",
  render: ({ label }) =>
    `<span class="button primary" style="display: inline-flex; align-items: center">${label}</span>`,
};

export const Default = { args: { label: "New" } };
JS
    ;;
  remove-story)
    rm "$stories/Card.stories.js"
    ;;
  flaky)
    cat >> "$pages/styles.css" <<'CSS'

.button.primary {
  animation: pulse 1s ease-in-out infinite alternate;
}

@keyframes pulse {
  to {
    opacity: 0.2;
  }
}
CSS
    ;;
  many-changes)
    sed -i.bak 's#font: 14px / 20px sans-serif;#font: 16px / 24px sans-serif;#' "$pages/styles.css"
    for i in $(seq 1 20); do
      cat > "$pages/item-$i.html" <<HTML
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <button type="button" class="button primary">Item $i</button>
  </body>
</html>
HTML
    done
    {
      cat <<'JS'
export default {
  title: "Item",
  render: ({ label }) =>
    `<button type="button" class="button primary">${label}</button>`,
};
JS
      for i in $(seq 1 20); do
        printf '\nexport const Item%s = { args: { label: "Item %s" } };\n' "$i" "$i"
      done
    } > "$stories/Item.stories.js"
    ;;
  restyle)
    sed -i.bak \
      -e 's/--accent: #171717;/--accent: #7c3aed;/' \
      -e 's/--border: #ebebeb;/--border: #c4b5fd;/' \
      -e 's#font: 14px / 20px sans-serif;#font: 15px / 22px serif;#' \
      "$pages/styles.css"
    sed -i.bak \
      -e 's/--font-sans: "IBM Plex Sans Variable", /--font-sans: ui-serif, Georgia, /' \
      -e 's/--color-accent: #171717;/--color-accent: #7c3aed;/' \
      -e 's/--color-border: #ebebeb;/--color-border: #c4b5fd;/' \
      -e 's/--color-link: #0068d6;/--color-link: #db2777;/' \
      "$worktree/apps/web/src/styles.css"
    ;;
  sharded)
    sed -i.bak \
      -e 's#\(upload examples/playground/screenshots --build-name playground\)#\1 --shard auto \&\& node packages/cli/dist/index.mjs finalize --build-name playground#' \
      -e 's#\(node packages/cli/dist/index.mjs storybook examples/playground/storybook-static --build-name storybook\)#\1 --include "Button/*" --shard 1/2 \&\& \1 --exclude "Button/*" --shard 2/2#' \
      "$worktree/.github/workflows/visual.yml"
    ;;
esac
rm -f "$pages"/*.bak "$worktree"/.github/workflows/*.bak "$worktree"/apps/web/src/*.bak

git -C "$worktree" add -A
git -C "$worktree" commit --quiet -m "test: ${scenario} scenario"
git -C "$worktree" push --quiet -u origin "$branch"
gh pr create --draft --head "$branch" --base main \
  --title "test: ${scenario} scenario" \
  --body "Scripted dogfooding PR from \`scripts/test-pr.sh ${scenario}\`. Expected checks: ${expected}."
