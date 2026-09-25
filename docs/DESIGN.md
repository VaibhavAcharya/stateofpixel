# stateofpixel: design system

Written 2026-09-24. Visual reference: [onkeiki.com](https://onkeiki.com). We take its restraint, type and spacing, not its content. Extracted values and where they came from are in the last section. Items marked (unverified) were not checked against a source.

## Principles

1. The screenshot is the loudest thing on the screen. Chrome is grayscale, one weight of border, no gradients. Color is reserved for status and for the diff highlight.
2. Never touch the pixels. The viewer shows images at their true pixels: no rounded corners on the image, no shadow over it, no smoothing above 100% zoom, no filters in dark mode.
3. Dense by default. 13px body text, 32px controls, 32px list rows. A reviewer should see 20+ snapshot names without scrolling on a 900px tall laptop screen.
4. Keyboard first, mouse welcome. Every action on the build page has a key, and the key is printed next to the button.
5. Status is text plus shape plus color. Color alone never carries meaning.
6. Quiet motion. Hover and focus changes are 100 to 250ms. Nothing moves on its own in the app.

## Tokens

### Color

Neutrals come from the gray scale onkeiki uses (it is the Vercel Geist `ds-gray` scale), so borders and fills sit on the same steps. Status colors come from the same system's 100 (fill) and 900 (text) steps.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#fafafa` | `#000000` | Page background |
| `surface` | `#ffffff` | `#0a0a0a` | Cards, table, sidebar, viewer panel |
| `surface-2` | `#f2f2f2` | `#1a1a1a` | Recessed fills: code, inputs at rest, neutral pills |
| `hover` | `#ebebeb` | `#1f1f1f` | Row hover and selected row |
| `border` | `#ebebeb` | `#2e2e2e` | Hairlines, card borders, dividers |
| `field-border` | `#8f8f8f` | `#6e6e6e` | Input and checkbox outlines (needs 3:1) |
| `text` | `#171717` | `#ededed` | Primary text |
| `muted` | `#666666` | `#a1a1a1` | Secondary text, metadata, inactive tabs |
| `subtle` | `#767676` | `#8f8f8f` | Placeholders, tertiary labels |
| `accent` | `#171717` | `#ededed` | Primary button fill, active segment |
| `accent-fg` | `#ffffff` | `#0a0a0a` | Text on `accent` |
| `link` | `#0068d6` | `#52a8ff` | Links, slider handle, selection outline in lists |
| `focus` | `#0068d6` | `#52a8ff` | Focus ring |

The accent is ink, not a hue. Onkeiki does the same: its primary button is `#171717` with white text and blue only appears on focus rings. For us that keeps the blue free for "this is interactive" and keeps every hue free for status.

Diff status. Each has a text color and a fill for pills.

| Status | Light text / fill | Dark text / fill | Icon |
|---|---|---|---|
| `unchanged` | `#666666` / `#f2f2f2` | `#a1a1a1` / `#1a1a1a` | equals sign |
| `changed` | `#a35200` / `#fff6e6` | `#f2a20d` / `#291800` | half-filled circle |
| `added` | `#0068d6` / `#f0f7ff` | `#52a8ff` / `#0f1c2e` | plus |
| `removed` | `#7820bc` / `#f9f0ff` | `#bf7af0` / `#231528` | minus |
| `failed` | `#cb2a2f` / `#fff0f0` | `#ff6166` / `#2a1314` | warning triangle |

Review state.

| State | Light text / fill | Dark text / fill | Icon |
|---|---|---|---|
| `pending` | `#a35200` / `#fff6e6` | `#f2a20d` / `#291800` | hollow circle |
| `approved` | `#297a3a` / `#effbef` | `#62c073` / `#0b2212` | check |
| `approved` (carried over) | same as approved | same as approved | check with a small link badge |
| `rejected` | `#cb2a2f` / `#fff0f0` | `#ff6166` / `#2a1314` | cross |

Build conclusion pills reuse these: `no_changes` uses unchanged, `changes` uses pending ("12 to review"), `approved`, `rejected`, `error` uses failed, `pending` and `expired` use unchanged with a spinner or clock icon. `superseded` is an outline pill (`border` 1px, `muted` text, no fill) shown next to the conclusion. Pill labels use sentence case ("Approved", "No changes", "Changed"); a label that starts with a count stays as is ("12 to review", "1 rejected").

Image viewer.

| Token | Light | Dark | Use |
|---|---|---|---|
| `diff` | `#ff0000` at 70% opacity | same | Diff overlay, per SPEC 5.5. Same in both themes because it sits on the screenshot. |
| `checker-a` / `checker-b` | `#ffffff` / `#e6e6e6` | `#1a1a1a` / `#292929` | Checkerboard, 8px squares |
| `canvas` | `#f2f2f2` | `#000000` | Area around the image inside the viewer |

The diff PNG is made by the CLI. The CLI must render diff pixels as pure red on transparent so the overlay color above is what the reviewer sees. Pixelmatch and odiff both default to red (unverified).

### Typography

UI font: IBM Plex Sans (SIL OFL 1.1). Mono: Lilex (OFL 1.1), a programming font built on IBM Plex Mono, so it matches the sans. Onkeiki uses Geist for headings and body copy, Inter for controls, and Playfair Display for one display headline; we use IBM Plex Sans everywhere instead, by the owner's choice. Install with `@fontsource-variable/ibm-plex-sans` and `@fontsource-variable/lilex` (both 5.3.0, OFL-1.1, checked with `npm view`), which self-host the files the way onkeiki does. Family names are `IBM Plex Sans Variable` and `Lilex Variable`. There is no third font: the landing display line is IBM Plex Sans too. The tracking values below were taken from onkeiki's Geist settings; recheck them against Plex Sans when the first pages exist.

| Token | Size / line height | Weight | Tracking | Use |
|---|---|---|---|---|
| `text-2xs` | 11 / 16 | 500 | 0 | kbd chips, pill labels, table header |
| `text-xs` | 12 / 16 | 400 | 0 | Metadata, timestamps, helper text |
| `text-sm` | 13 / 20 | 400 | 0 | Default body, rows, buttons (500) |
| `text-base` | 14 / 20 | 400 | 0 | Snapshot title in viewer, form labels |
| `text-lg` | 16 / 24 | 600 | -0.01em | Section titles, dialog titles |
| `text-xl` | 20 / 28 | 600 | -0.025em | Page title (`acme / web-app`, `#411`) |
| `text-2xl` | 24 / 34 | 450 and 600 | -0.035em | Empty-state and landing lead copy |
| `text-display` | clamp(40px, 4.6vw, 66px) / 1.1 | 600 | -0.045em | Landing only |

Rules. Numbers (counts, diff percent, sizes, build numbers) use `font-variant-numeric: tabular-nums`. Hashes, branch names and file paths use Lilex through the `mono` utility, which sets it at 0.925em of the text around it: Lilex at the same pixel size reads larger than Plex Sans and pushes rows wider. Snapshot names use Plex Sans: the parent path in `muted`, the last segment in `text`, and the viewport suffix (`[1280]`) as a separate `mono` `muted` label that never truncates. Max prose width is 65ch (docs, empty states). Headings use `text-wrap: balance`.

The lead-copy pattern is the most recognisable onkeiki trait worth borrowing: a bold phrase in `text` followed by a sentence in `muted` at the same size, in one paragraph. "No builds yet. Add three lines to your CI and push." Use it for empty states, the install page and the landing hero, nowhere else.

### Spacing

4px base, the Tailwind v4 default `--spacing: 0.25rem`. Steps we use: 2, 4, 6, 8, 12, 16, 20, 24, 32, 48, 64, 96. Inside components: 4 to 12. Between groups in a panel: 16 to 24. Page gutter: 24 on desktop, 16 below 640px. Landing section padding: 96 desktop, 48 below 640px (onkeiki's values).

### Radius

| Token | Value | Use |
|---|---|---|
| `radius-xs` | 5px | Pills, kbd, inline code |
| `radius-sm` | 7px | Sidebar rows, menu items, segmented control items |
| `radius-md` | 8px | Cards, inputs, table container, toasts, banners |
| `radius-control` | 11px | Buttons, menu surfaces, segmented control track |
| `radius-lg` | 12px | Viewer panel, dialogs |
| `radius-xl` | 16px | Landing art only |
| none | 0 | Screenshots, always |

### Borders and shadows

One border weight: 1px solid `border`. Surfaces are separated by borders, not shadows. Shadows appear only on things that float over content.

| Token | Light | Dark |
|---|---|---|
| `shadow-menu` | `0 8px 30px #0000001f, 0 2px 6px #0000000f` | `0 8px 30px #00000066, 0 2px 6px #0000003d` |
| `shadow-tooltip` | `0 4px 16px #0000000a` | `0 4px 16px #00000066` |
| `shadow-field-focus` | `inset 0 0 0 1px var(--color-field-border), 0 0 0 1px #0000005c, 0 0 0 3px #0000000d` | same with `#ffffff5c` and `#ffffff1f` |

Menus, popovers, toasts, the shortcuts overlay and dialogs use `shadow-menu`. Nothing else has a shadow.

### Motion

| Token | Value | Use |
|---|---|---|
| `ease-out-strong` | `cubic-bezier(.23, 1, .32, 1)` | Entrances: toasts, menus, overlay |
| `ease-standard` | `cubic-bezier(.4, 0, .2, 1)` | Field focus |
| `duration-fast` | 100ms | Background and color on hover, menu open fade |
| `duration-base` | 180ms | Icon nudge, segmented indicator |
| `duration-slow` | 250ms | Field focus ring, toast enter |

Image mode switches, zoom steps and flip toggles are instant. A fade between baseline and new would hide the exact change the reviewer is looking for.

## Tailwind v4 theme

Paste into `apps/web/src/styles.css` after `@import "tailwindcss";`. Light values live in `@theme`; dark overrides the same variables, so every utility (`bg-surface`, `text-muted`, `border-border`) switches without a `dark:` prefix. The `dark:` variant is still available for the rare case that needs it.

```css
@import "@fontsource-variable/ibm-plex-sans";
@import "@fontsource-variable/lilex";

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

@theme {
  --font-sans: "IBM Plex Sans Variable", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Lilex Variable", ui-monospace, "SF Mono", monospace;

  --text-2xs: 11px;  --text-2xs--line-height: 16px;
  --text-xs: 12px;   --text-xs--line-height: 16px;
  --text-sm: 13px;   --text-sm--line-height: 20px;
  --text-base: 14px; --text-base--line-height: 20px;
  --text-lg: 16px;   --text-lg--line-height: 24px;
  --text-xl: 20px;   --text-xl--line-height: 28px;
  --text-2xl: 24px;  --text-2xl--line-height: 34px;

  --color-bg: #fafafa;
  --color-surface: #ffffff;
  --color-surface-2: #f2f2f2;
  --color-hover: #ebebeb;
  --color-border: #ebebeb;
  --color-field-border: #8f8f8f;
  --color-text: #171717;
  --color-muted: #666666;
  --color-subtle: #767676;
  --color-accent: #171717;
  --color-accent-fg: #ffffff;
  --color-accent-hover: #333333;
  --color-link: #0068d6;
  --color-focus: #0068d6;

  --color-unchanged: #666666;  --color-unchanged-bg: #f2f2f2;
  --color-changed: #a35200;    --color-changed-bg: #fff6e6;
  --color-added: #0068d6;      --color-added-bg: #f0f7ff;
  --color-removed: #7820bc;    --color-removed-bg: #f9f0ff;
  --color-failed: #cb2a2f;     --color-failed-bg: #fff0f0;
  --color-pending: #a35200;    --color-pending-bg: #fff6e6;
  --color-approved: #297a3a;   --color-approved-bg: #effbef;
  --color-rejected: #cb2a2f;   --color-rejected-bg: #fff0f0;

  --color-diff: #ff0000;
  --color-canvas: #f2f2f2;
  --color-checker-a: #ffffff;
  --color-checker-b: #e6e6e6;

  --radius-xs: 5px;
  --radius-sm: 7px;
  --radius-md: 8px;
  --radius-control: 11px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  --shadow-menu: 0 8px 30px #0000001f, 0 2px 6px #0000000f;
  --shadow-tooltip: 0 4px 16px #0000000a;
  --shadow-field-focus: inset 0 0 0 1px var(--color-field-border), 0 0 0 1px #0000005c, 0 0 0 3px #0000000d;

  --ease-out-strong: cubic-bezier(.23, 1, .32, 1);
  --ease-standard: cubic-bezier(.4, 0, .2, 1);
}

@layer base {
  :root[data-theme="dark"] {
    color-scheme: dark;
    --color-bg: #000000;
    --color-surface: #0a0a0a;
    --color-surface-2: #1a1a1a;
    --color-hover: #1f1f1f;
    --color-border: #2e2e2e;
    --color-field-border: #6e6e6e;
    --color-text: #ededed;
    --color-muted: #a1a1a1;
    --color-subtle: #8f8f8f;
    --color-accent: #ededed;
    --color-accent-fg: #0a0a0a;
    --color-accent-hover: #cccccc;
    --color-link: #52a8ff;
    --color-focus: #52a8ff;
    --color-unchanged: #a1a1a1;  --color-unchanged-bg: #1a1a1a;
    --color-changed: #f2a20d;    --color-changed-bg: #291800;
    --color-added: #52a8ff;      --color-added-bg: #0f1c2e;
    --color-removed: #bf7af0;    --color-removed-bg: #231528;
    --color-failed: #ff6166;     --color-failed-bg: #2a1314;
    --color-pending: #f2a20d;    --color-pending-bg: #291800;
    --color-approved: #62c073;   --color-approved-bg: #0b2212;
    --color-rejected: #ff6166;   --color-rejected-bg: #2a1314;
    --color-canvas: #000000;
    --color-checker-a: #1a1a1a;
    --color-checker-b: #292929;
    --shadow-menu: 0 8px 30px #00000066, 0 2px 6px #0000003d;
    --shadow-tooltip: 0 4px 16px #00000066;
    --shadow-field-focus: inset 0 0 0 1px var(--color-field-border), 0 0 0 1px #ffffff5c, 0 0 0 3px #ffffff1f;
  }
  html { color-scheme: light; }
  body {
    background: var(--color-bg);
    color: var(--color-text);
    font: 400 13px/20px var(--font-sans);
    -webkit-font-smoothing: antialiased;
  }
  :focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
  }
}
```

Dark mode approach. The user picks System, Light or Dark in the user menu; the choice is stored in `localStorage` under `theme` (default System). A small inline script in the root route's `<head>` resolves System with `matchMedia("(prefers-color-scheme: dark)")` and sets `data-theme` on `<html>` before first paint, and listens for changes while on System. The script runs on the server-rendered public pages too, so there is no flash. Without JavaScript the page is light. Note that the `@theme` block redefines Tailwind's `text-xs`, `text-sm` and `text-base` on purpose.

## Components

Icons: Phosphor Icons (`@phosphor-icons/react` 2.1.10, MIT), regular weight, 16px in controls and rows, 12px inside pills. Color follows the text they sit next to.

Buttons. Height 32px, padding 0 12px, radius `radius-control`, 13px weight 500, gap 6px between icon and label. Four variants. Primary: `accent` fill, `accent-fg` text, hover `accent-hover`. Secondary: `surface` fill, 1px `border`, hover `hover`. Ghost: no fill, `muted` text, hover `hover` fill and `text` color. Danger: secondary shape with `rejected` text; used for Reject and Delete project. Disabled is 45% opacity and no hover. Small size is 24px tall, padding 0 8px, 12px text, for toolbars. On touch devices (`pointer: coarse`) the hit area is at least 44x44 even when the button looks smaller. The review buttons show their key inside the button: `[Approve  a]`, with the kbd chip after the label.

Inputs. Height 32px, padding 0 10px, radius `radius-md`, `surface` fill, border drawn as `inset 0 0 0 1px field-border`. Focus uses `shadow-field-focus` with a 250ms `ease-standard` transition and no outline. Invalid swaps the border color to `rejected`. Placeholder is `subtle`. Settings fields save on blur and show "Saved" in `text-xs muted` to the right for 2 seconds. The sidebar filter input is 28px tall with a search icon and a `/` kbd chip at the right edge while empty.

Pills. Height 20px, padding 0 6px, radius `radius-xs`, 11px weight 500, status fill and status text color, 12px icon then label. Always icon plus word ("changed", "12 to review"), never a bare dot. Counts inside pills are tabular. The diff percent next to a changed row is plain `text-xs muted` text, not a pill.

Tables (builds list, account home, all projects, usage). No outer card on wide screens; the table sits on `bg` with a 1px `border` line under the header and between rows (onkeiki draws its comparison table with row lines only). Header row: 32px, `text-2xs` weight 500, `muted`, no uppercase. Body rows: 44px (48px on the account home), `text-sm`, padding 0 12px per cell, hover `hover` fill across the row, the whole row is one link. Column order follows SPEC 5.4. Build number is `#412` in weight 500 on the left; time is right-aligned and tabular; SHA is mono `muted`. The branch cell is a button that sets the branch filter; the active filter shows as a removable chip above the table. Relative time shows the absolute date in a tooltip. Pending builds show a 12px spinner and "2 of 4 shards" in the status cell. "Load more" is a secondary button centered under the table. Tables are built on TanStack Table (`@tanstack/react-table` 9.2.4, MIT) in manual mode through `DataTable`: the server sorts, filters and paginates, and the table renders what it gets. Sortable headers are buttons with a 10px caret for the active direction and set `aria-sort`. Sort and filters live in the URL so a view can be shared. A toolbar above the table holds the controls, 8px apart: a 256px search field (full width below 640px) with a 200ms delay, a "State" menu with a check on the current option, and removable chips for branch and pull request, which are set by clicking those cells. "Clear filters" is a ghost button that appears once a filter is set. Builds sort by number, newest first; projects sort by name or last build, and search orders by relevance with sorting turned off. The account home and all projects share one project table (project, latest build with its state pill, branch, updated), and all projects shows it once per account under the account name. `j` and `k` move focus between rows, Enter opens the row, and the focused row gets the `hover` fill and a 2px inset `focus` ring. An empty PR cell stays blank.

Sidebar list rows (build page). Height 32px, padding 0 8px, radius `radius-sm`, `text-sm`. Left: review icon (16px, colored by review state). Middle: snapshot name in mono, truncated with an ellipsis in the middle so the viewport suffix `[1280]` stays visible; full name in `title`. Right: diff percent for changed rows, `text-xs muted`, tabular. Selected row: `hover` fill plus a 2px `link` bar on the left edge inside the row. Keyboard focus on a row uses the standard focus ring. Group headers are 28px, `text-xs` weight 500, `muted`: the diff status icon in its color, the label, then the count and a caret right-aligned. Every group collapses; Unchanged is collapsed by default. The per-status counts live here instead of in the build header. The sidebar ends with a 40px footer holding a "Keyboard shortcuts `?`" button.

Tabs (project page). Text tabs, 40px tall, `text-sm`, `muted` when inactive, `text` when active with a 2px `accent` underline sitting on the header's bottom border. Gap 20px. Hover changes color only.

Segmented control (viewer modes, zoom). A `surface-2` track with radius `radius-control` and 2px inner padding. Items are 28px tall, radius `radius-sm`, `text-sm` weight 500, `muted`. The active item has `surface` fill, `text` color and a 1px `border`. Each mode item carries its number key as a kbd chip on hover and in the tooltip. This is the same shape as onkeiki's channel picker (40px items, `#f1f1f1` pressed fill), made shorter.

Toasts. Bottom center, 16px from the bottom edge (above the sticky review bar on mobile). Width up to 420px, padding 10px 12px, radius `radius-md`, `surface` fill, 1px `border`, `shadow-menu`, `text-sm`. Icon colored by type, message, optional action ("Retry", "Undo"). Enter is 250ms `ease-out-strong` from 8px below with opacity; exit is a 100ms fade. Auto-dismiss after 5 seconds, paused on hover and focus. Failed review requests use the failed icon and say what failed: "Could not approve Header/Default [1280]. Your change was undone." Toasts use `role="status"`; errors use `role="alert"`.

Banners (build page states in SPEC 5.5). Full width of the main column, directly under the build header. Min height 36px, padding 8px 12px, radius `radius-md`, status fill, text in `text` color with a status-colored icon, one sentence and one link. Superseded and expired use the unchanged colors, pending uses added colors with a spinner, error and storage limit use failed colors, "From PR #123" uses unchanged. At most two banners stack; the rest collapse into "and 1 more".

Keyboard hint chips (kbd). Height 20px, min width 20px, padding 0 5px, radius `radius-xs`, 1px `border`, `surface` fill, `text-2xs` Lilex, `muted`. Modifier keys print as words (`shift`), not symbols, matching SPEC. The `?` overlay is a dialog 560px wide, radius `radius-lg`, `shadow-menu`, listing SPEC's shortcut table as two columns: action in `text-sm`, keys as chips right-aligned.

Empty states. Left-aligned in the content column, not centered in a box. The lead-copy pattern at `text-2xl`, then at most one short paragraph and one primary action. The Setup card (SPEC 4.2) is the only boxed empty state: `surface`, 1px dotted `border` (onkeiki uses dotted borders for empty states and list separators), radius `radius-md`, padding 24px, with the 3-line CI snippet in a code block.

Skeletons. Blocks of `surface-2` with the exact size of the content they stand in for: 40px table rows with three bars, 32px sidebar rows, a viewer frame at 16:10. A 1.5s shimmer (`linear-gradient` with `#ffffff0d` in dark, `#0000000a` in light) that is removed under reduced motion. In code this is the `skeleton` utility with the `--color-shimmer` token, next to the `mono` utility and the `enter`, `fade` and `shimmer` keyframes in `styles.css`. Signed-in pages show skeletons until auth and the permission check finish (SPEC 5).

Code blocks. `surface-2` fill, 1px `border`, radius `radius-md`, 13px/1.8 Lilex, 40px caption bar with file name and copy button. Inline code: `surface-2`, 1px `border`, radius `radius-xs`, padding 1px 4px.

### Image viewer chrome

The viewer is a `surface` panel with radius `radius-lg` and 1px `border`. Inside it, from top to bottom:

1. Title row, 48px: snapshot name (`text-base` weight 500, split as in the sidebar), diff status pill, diff percent and pixel count (`text-xs muted`, tabular), then right-aligned the dimensions (`1280x720 to 1280x812` when they differ, with the second value in `changed` color), the position ("3 of 20") and previous and next buttons for `k` and `j`.
2. Toolbar, 44px: mode segmented control on the left (Side by side 1, Diff 2, Slider 3, Flip 4, with the key printed after the label from 1024px up), a toggle next to it for the current mode (Diff with `d` in Side by side, which draws the diff mask over the new image and is on by default and remembered, Diff only in Diff, Showing new / Showing baseline with `space` in Flip), zoom segmented control on the right (Fit f, 100% 0, 200%), hidden below 640px.
3. Stage: `canvas` fill, 16px padding, fills the remaining height. Images sit on the checkerboard at top-left alignment (SPEC 5.5), with no radius and no shadow. At zoom above 100%, `image-rendering: pixelated`. Each image in side-by-side has a 24px caption strip above it ("Baseline #405", "New #411") in `text-xs muted`. In Flip mode the caption is the current side and switches instantly; the frame border turns `link` color while showing the baseline so the state is visible without reading.
4. Review bar, 56px, top border: review info on the left ("Approved by @alice 3 min ago", "Waiting for review") in `text-xs muted` with the review icon; on the right `[Undo  u]` ghost (only once reviewed), `[Reject  r]` danger and `[Approve  a]` primary, grouped so the pointer travels the shortest distance between them. The kbd chip inside a primary button uses the inverted style (`accent-fg` at 15% fill). `r` swaps the bar for a comment field with Cancel and Reject.

Checkerboard CSS, 8px squares:

```css
.checker {
  background-color: var(--color-checker-a);
  background-image: conic-gradient(var(--color-checker-b) 25%, transparent 0 50%, var(--color-checker-b) 0 75%, transparent 0);
  background-size: 16px 16px;
}
```

Slider handle: 2px vertical line in `link`, with a 24px round grip (`surface` fill, 1px `border`, two small chevrons) centered vertically. The handle is focusable and moves 1% per arrow key, 10% with shift. Diff overlay is the diff PNG at 70% opacity over the new image, with a toggle to hide the new image and show the diff alone.

## Layout

Breakpoints: 640, 768, 1024, 1280. App header is 48px, `surface`, bottom border. Left: the logo mark (a 20px ink square with two pixel cut-outs, linking to all projects), a slash, the account switcher (account avatar, login, up-down caret; the menu lists accounts and "Add GitHub account"), and on project pages a slash and the repo name. Right: the user avatar, which opens a menu with name and login, a System, Light, Dark icon switch, and Sign out. The favicon is the same mark, `apps/web/public/favicon.svg`, which follows the system color scheme, with a 180px `apple-touch-icon.png` on ink. Public pages use a 64px header and a 1448px max width with a 24px gutter (onkeiki's `--keiki-site-width` and `--site-nav-height`).

Account home and project pages. Content max width 1200px, centered, 32px top padding (24px below 640px). A left-aligned column on a 1440px screen left a wide empty band on the right, so the column is centered like onkeiki's site width. Page title row: optional leading avatar (40px, `radius-xs`), `text-xl` title with a `text-xs muted` meta line under it, and a secondary button on the right ("Configure on GitHub", "Repository"). Filters are a row of 28px ghost-style select buttons above the table, 8px apart.

Build review page. Full width, no max width, the viewport height is fixed and only the sidebar list and the stage scroll.

```
+----------------------------------------------------------------+ 48 app header
| #411 feat/header d4e5f6 "New header" PR #88  vs #405 (main)    | 72 build header
| [10 changed] [2 added] [1 removed] [1,488 unchanged]  [Rej][All]|
+----------------------------------------------------------------+
| banner (optional, 36)                                          |
+------------------+---------------------------------------------+
| filter      [/]  | title row                          48       |
| Changed (10)     | toolbar                            40       |
|  row 32          | +-----------------------------------------+ |
|  row             | | stage (scrolls, pans)                   | |
| Added (2)        | +-----------------------------------------+ |
| ...              | review bar                         56       |
| 300px            | history and metadata (collapsible)          |
+------------------+---------------------------------------------+
```

Build header, about 76px: line one is `#411` in `muted` then the commit message in `text-lg` weight 600, truncated, then the conclusion pill; line two is `text-xs muted` metadata with 14px icons: branch (links to the filtered builds list), SHA, PR, "vs #405 on main", time. "Reject build" and "Approve all N" sit on the right and are hidden until the build is finalized. The sidebar is 300px at 1280 and up, 260px from 1024 to 1279, `surface` with a right border. The detail footer (metadata) sits below the review bar and is collapsed to one 32px line by default so the stage keeps its height.

Below 1024 the sidebar becomes a drawer over the viewer (up to 320px, `shadow-menu`, dimmed backdrop), opened by a "3 of 13" button in the title row; `j` and `k` still work with it closed. Below 640 the header actions and review buttons stretch to full width, mode labels shorten (Side, Diff, Slider, Flip), side-by-side stacks baseline above new, and buttons are 44px on coarse pointers. Default mode on phones stays whatever the user picked last.

Builds table on mobile: rows become two-line list items with a row line between them, line one is `#412` plus the conclusion pill and time, line two is the branch in mono and the commit message in `muted`. PR and SHA are dropped.

Baselines grid: `repeat(auto-fill, minmax(220px, 1fr))`, gap 16px. Each tile is a `surface-2` box at the image's aspect ratio capped at 4:3, image `object-fit: contain` top-aligned (never `cover`, which would crop), name under it in `text-xs` mono. Hover draws a 1px `field-border` outline.

Settings: one column, 640px max width, sections separated by 48px and a dotted `border` line, label above field.

Landing (`/`): 64px sticky header on `surface` with the wordmark and one primary button (Sign in, or Open dashboard when signed in), 1448px max width. Sections top to bottom: centered lead-copy hero with Get started and a ghost "How it works" anchor; the product art, a static HTML mock of the build page on a checkerboard inside a `radius-xl` frame; three steps in a 3-column grid; the CI snippet next to its lead copy on a `bg` band with hairlines above and below; the pricing lead copy over three facts split by dotted lines; one display line; a dotted footer. The page follows the theme setting.

Sign-in (any signed-in page while signed out): centered 360px column, 32px logo, `text-xl` title, one `text-sm muted` line, and a full-width primary "Continue with GitHub" button. While auth loads, the page shows a skeleton of the 48px app header only.

## Accessibility

Contrast ratios, computed with the WCAG 2 relative luminance formula for the pairs we ship:

| Pair | Light | Dark |
|---|---|---|
| `text` on `surface` | 17.93 | 16.91 |
| `text` on `bg` | 17.18 | 17.94 |
| `muted` on `surface` | 5.74 | 7.66 |
| `muted` on `surface-2` | 5.13 | 6.74 |
| `subtle` on `surface` | 4.54 | 6.12 |
| `accent-fg` on `accent` | 17.93 | 16.91 |
| `link` on `surface` | 5.31 | 7.92 |
| `text` on `hover` (selected row) | 15.04 | 14.08 |
| changed on its fill | 5.20 | 8.12 |
| added on its fill | 4.92 | 6.86 |
| removed on its fill | 6.93 | 6.00 |
| failed and rejected on fill | 4.85 | 5.95 |
| approved on its fill | 5.00 | 7.43 |
| `field-border` on `surface` | 3.23 | 3.88 |

All text pairs pass AA (4.5). `border` (`#ebebeb`, 1.2:1) fails 3:1, so it is only used for decoration and grouping, never as the only edge of an input or control; inputs use `field-border`.

Focus. Every interactive element shows a 2px `focus` outline with 2px offset on `:focus-visible` (onkeiki uses the same 2px blue outline). Inputs use `shadow-field-focus` instead. Keyboard shortcuts never move focus away from where the user put it, except `/` which focuses the filter; `Escape` returns focus to the list.

Status never relies on color. Every pill and review icon has a distinct shape and a text label or an `aria-label` ("Header/Default [1280], changed, 0.84%, pending review"). The diff overlay has a text alternative in the title row (pixel count and percent). Flip mode says "Showing baseline" or "Showing new" in text.

Reduced motion. Under `prefers-reduced-motion: reduce` all transitions and animations are removed (the base layer above), skeleton shimmer stops, and toasts appear without the slide.

Other. Sidebar list is a `listbox` with `aria-activedescendant` so `j` and `k` announce the selected snapshot. Review results are announced through the toast live region. Hit targets are 44px on coarse pointers.

## What we observed on onkeiki.com

Fetched 2026-09-24 with curl (HTML plus `/assets/index--mty5weW.css`, `/assets/index-DtiuvPeR.css`, `/assets/styles-D5EgjrnL.css`) and Playwright 1.63 screenshots at 1440 and 390 wide of `/`, `/docs`, `/developers` and `/about`, in light and dark color schemes. Computed styles were read with `getComputedStyle` in the same Playwright session.

What makes it distinct: a white page with almost no color in the chrome; ink-black pill-cornered buttons; two-tone headlines where a bold phrase in `#171717` runs into a muted `#666` sentence at 24px; grainy, film-like photos framed in 16px rounded rectangles, with white product cards (12px radius, soft layered shadow) floating on top; generous section spacing; hairline and dotted dividers instead of boxes; one serif display line at the end of the page.

Fonts. Self-hosted variable woff2 files for `Geist Variable`, `Inter Variable` and `Playfair Display Variable`, all 100 to 900. Body `Inter Variable` 13px/20px (inline critical CSS). Site copy `Geist Variable` 14px/1.6. Buttons Inter 13px/18px weight 500. Home lead copy Geist 24px/34.8px, weight 450 muted and 600 ink, letter spacing -0.84px (-0.035em). Feature titles Geist 600 20px/1.4, -0.025em. Final headline Playfair Display 400 66px/74.58px, -3.3px, second line in `#85877f`. Docs: title Geist 600 32px/38.4px, -0.8px; prose 15px/27px; sidebar links 13px/20px, 36px tall, radius 8px. Mono is `ui-monospace, SF Mono, JetBrains Mono` (system fonts). The `/developers` and `/about` pages use a different style: headline `Iowan Old Style` 92px weight 400, body `Inter`, background `#fcfcfd`, a red uppercase eyebrow. Iowan Old Style ships with Apple systems and is not free to embed; the closest free option would be Source Serif 4 (not compared side by side, unverified). We do not use that style.

Colors. Home: background `#fff`, soft `#fafafa`, text `#171717`, muted `#666`, subtle `#767676`, line `#e5e5e5` fallback and `#ebebeb` resolved, selected `#ebebeb`, pressed channel button `#f1f1f1`, primary button `#171717` with hover `#333`, focus outline `#0068d6`. Docs dark: body `#000`, cards `#0a0a0a`, border `#2e2e2e`, text `#ededed`, muted `#a1a1a1`, inline code `#1a1a1a`. The gray, blue, red, amber, green and purple scales under `:root[data-theme=keiki]` are where our status colors come from (for example `--ds-amber-900: #a35200`, `--ds-green-900: #297a3a`, `--ds-red-900: #cb2a2f`, `--ds-purple-900: #7820bc`).

Radius and borders. Buttons and menus 11px (`--home-control-radius`), cards 8px (`--site-card-radius`), art 16px (`--site-art-radius`), menu items 7px, badges 5px, inline code 5px, tooltips 10px. Borders are 1px solid; empty states, card attributions and list separators use 1px dotted.

Shadows. Menu `0 8px 30px #0000001f, 0 2px 6px #0000000f` (dark `#0006` and `#0000003d`). Tooltip `0 4px 16px #0000000a`. Floating product card `0 8px 32px #11151a18, 0 1px 4px #11151a0a`. Field idle is an inset 1px line; field focus adds `0 0 0 1px #0000005c, 0 0 0 3px #0000000d`.

Layout. Site width 1448px, gutter 24px, nav 64px, section spacing 96px and content spacing 48px, reduced to 48 and 32 below 640px. Nav links collapse to a menu below 880px. Docs sidebar is `min(22vw, 300px)`, table of contents 240px at 1280 and up, docs content max 900px. Feature grids are 3 columns with 48px by 64px gaps, dropping to 1 column below 768px.

Motion. `--ease-out-strong: cubic-bezier(.23, 1, .32, 1)`; menu fade 0.1s ease-out; field focus 0.25s `cubic-bezier(.4,0,.2,1)`; menu item hover 0.1s; text link icon 0.18s; image hover `scale(1.035)` over 0.3s; story entrance 0.5s. A `prefers-reduced-motion` rule removes all animation and transition on the home page.

Dark mode. The docs follow the system setting and have a light, dark and system switch in the sidebar footer. The home page stayed white with a dark color scheme, even though `<html>` got `data-mode="dark"`, so the marketing page is light only (observed at 1440; not tested at other widths).

Icons. The bundle includes a module named `CaretDown.es`, which matches Phosphor Icons' file naming (unverified). The feature-section icons look pixel-drawn; we did not identify their source.
