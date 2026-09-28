# stateofpixel: design system

Visual reference: [onkeiki.com](https://onkeiki.com). We take its restraint, type and spacing, not its content. Items marked (unverified) were not checked against a source.

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

Build conclusion pills reuse these: `no_changes` uses unchanged, `changes` uses pending ("12 to review"), `approved`, `rejected`, `error` uses failed, `pending` and `expired` use unchanged with a spinner or clock icon. A storage-blocked build shows "Not compared" in failed colors with a warning icon. `superseded` is an outline pill (`border` 1px, `muted` text, no fill) shown next to the conclusion. Pill labels use sentence case ("Approved", "No changes", "Changed"); a label that starts with a count stays as is ("12 to review", "1 rejected").

Image viewer.

| Token | Light | Dark | Use |
|---|---|---|---|
| `diff` | `#00cc00` (default), `#ff0000`, `#ff00ff` or `#0066ff` at 70% opacity | same | Diff overlay, per SPEC 5.5, in the color picked in the toolbar. Same in both themes because it sits on the screenshot. |
| `checker-a` / `checker-b` | `#ffffff` / `#e6e6e6` | `#1a1a1a` / `#292929` | Checkerboard, 8px squares |
| `canvas` | `#f2f2f2` | `#000000` | Area around the image inside the viewer |

The diff PNG is made by the CLI. The CLI renders diff pixels opaque on transparent (`diffMask` in pixelmatch, `outputDiffMask` in odiff). The viewer paints every non-transparent pixel in the picked color with an SVG filter, so the color in the PNG does not matter.

### Typography

UI font: IBM Plex Sans (SIL OFL 1.1). Mono: Lilex (OFL 1.1), a programming font built on IBM Plex Mono, so it matches the sans. Install with `@fontsource-variable/ibm-plex-sans` and `@fontsource-variable/lilex` (both 5.3.0, OFL-1.1, checked with `npm view`), which self-host the files. Family names are `IBM Plex Sans Variable` and `Lilex Variable`. There is no third font: the landing display line is IBM Plex Sans too.

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

The theme lives in `apps/web/src/styles.css`, after `@import "tailwindcss";`. Light values live in `@theme`; dark overrides the same variables, so every utility (`bg-surface`, `text-muted`, `border-border`) switches without a `dark:` prefix. The `dark:` variant is still available for the rare case that needs it.

Dark mode approach. The user picks System, Light or Dark in the user menu; the choice is stored in `localStorage` under `theme` (default System). A small inline script in the root route's `<head>` resolves System with `matchMedia("(prefers-color-scheme: dark)")` and sets `data-theme` on `<html>` before first paint, and listens for changes while on System. The script runs on the server-rendered public pages too, so there is no flash. Without JavaScript the page is light. Note that the `@theme` block redefines Tailwind's `text-xs`, `text-sm` and `text-base` on purpose.

## Components

Icons: Phosphor Icons (`@phosphor-icons/react` 2.1.10, MIT), regular weight, 16px in controls and rows, 12px inside pills. Color follows the text they sit next to.

Buttons. Height 32px, padding 0 12px, radius `radius-control`, 13px weight 500, gap 6px between icon and label. Four variants. Primary: `accent` fill, `accent-fg` text, hover `accent-hover`. Secondary: `surface` fill, 1px `border`, hover `hover`. Ghost: no fill, `muted` text, hover `hover` fill and `text` color. Danger: secondary shape with `rejected` text; used for Reject and Delete project. Disabled is 45% opacity and no hover. A control the user is not allowed to use sets `aria-disabled` instead of `disabled`, so it stays focusable, shows a not-allowed cursor and carries a tooltip that says who can use it. Small size is 24px tall, padding 0 8px, 12px text, for toolbars. On touch devices (`pointer: coarse`) the hit area is at least 44x44 even when the button looks smaller. The review buttons show their key inside the button: `[Approve  a]`, with the kbd chip after the label.

Inputs. Height 32px, padding 0 10px, radius `radius-md`, `surface` fill, border drawn as `inset 0 0 0 1px field-border`. Focus uses `shadow-field-focus` with a 250ms `ease-standard` transition and no outline. Invalid swaps the border color to `rejected`. Placeholder is `subtle`. Settings fields save on blur and show "Saved" in `text-xs muted` to the right for 2 seconds. The sidebar filter input is 28px tall with a search icon and a `/` kbd chip at the right edge while empty.

Pills. Height 20px, padding 0 6px, radius `radius-xs`, 11px weight 500, status fill and status text color, 12px icon then label. Always icon plus word ("changed", "12 to review"), never a bare dot. Counts inside pills are tabular. The diff percent next to a changed row is plain `text-xs muted` text, not a pill.

Tables (builds list, account home, all projects, usage). No outer card on wide screens; the table sits on `bg` with a 1px `border` line under the header and between rows (onkeiki draws its comparison table with row lines only). Header row: 32px, `surface-2` fill, `text-2xs` weight 500, `muted`, no uppercase. Body rows: 44px (48px on the account home), `text-sm`, padding 0 12px per cell, hover `hover` fill across the row, the whole row is one link. Column order follows SPEC 5.4. Build number is `#412` in weight 500 on the left; time is right-aligned and tabular; SHA is mono `muted`. The branch cell is a button that sets the branch filter; the active filter shows as a removable chip above the table. Relative time shows the absolute date in a tooltip. Pending builds show a 12px spinner and "2 of 4 shards" in the status cell. "Load more" is a secondary button centered under the table. Tables are built on TanStack Table (`@tanstack/react-table` 9.2.4, MIT) in manual mode through `DataTable`: the server sorts, filters and paginates, and the table renders what it gets. Sortable headers are buttons with a 10px caret for the active direction and set `aria-sort`. Sort and filters live in the URL so a view can be shared. A toolbar above the table holds the controls, 8px apart: a 256px search field (full width below 640px) with a 200ms delay, a "State" menu with a check on the current option, and removable chips for branch and pull request, which are set by clicking those cells. "Clear filters" is a ghost button that appears once a filter is set. Builds sort by number, newest first; projects sort by name or last build, and search orders by relevance with sorting turned off. The account home and all projects share one project table (project, latest build with its state pill, branch, updated), and all projects shows it once per account under the account name. `j` and `k` move focus between rows, Enter opens the row, and the focused row gets the `hover` fill and a 2px inset `focus` ring. An empty PR cell stays blank.

Sidebar list rows (build page). Height 32px, padding 0 8px, radius `radius-sm`, `text-sm`. Left: review icon (16px, colored by review state). Middle: snapshot name in mono, truncated with an ellipsis in the middle so the viewport suffix `[1280]` stays visible; full name in `title`. Right: diff percent for changed rows, `text-xs muted`, tabular. Selected row: `hover` fill plus a 2px `link` bar on the left edge inside the row. Keyboard focus on a row uses the standard focus ring. Group headers are 28px, `text-xs` weight 500, `muted`: the diff status icon in its color, the label, then the count and a caret right-aligned. Every group collapses; Unchanged is collapsed by default. The per-status counts live here instead of in the build header. The sidebar ends with a 40px footer holding a "Keyboard shortcuts `?`" button.

Tabs (account and project pages). A 16px icon then the label, 6px apart, 40px tall, `text-sm`, `muted` when inactive, `text` when active with a 2px `accent` underline sitting on the header's bottom border. Gap 20px. Hover changes color only. The account pages have Projects, Members, Usage and Billing; the project page has Builds, Baselines and Settings. A tab the user cannot open stays in place at 45% opacity with a tooltip.

Tooltips. Shown under the element on hover and on keyboard focus, aligned to its start or end edge. `surface` fill, 1px `border` ring, radius `radius-md`, padding 6px 10px, `text-xs`, up to 256px wide, `shadow-tooltip`, 100ms fade. The element points to it with `aria-describedby`. Relative times keep the native `title` tooltip.

Segmented control (viewer modes, zoom). A `surface-2` track with radius `radius-control` and 2px inner padding. Items are 28px tall, radius `radius-sm`, `text-sm` weight 500, `muted`. The active item has `surface` fill, `text` color and a 1px `border`. Each item has a 16px icon (mode items only), its label and, from 1024px up, its key as a kbd chip after the label. Below 1024px the chips are hidden and the key shows in a tooltip on hover and focus instead. This is the same shape as onkeiki's channel picker (40px items, `#f1f1f1` pressed fill), made shorter.

Toasts. Bottom center, 16px from the bottom edge (above the sticky review bar on mobile). Width up to 420px, padding 10px 12px, radius `radius-md`, `surface` fill, 1px `border`, `shadow-menu`, `text-sm`. Icon colored by type, message, optional action ("Retry", "Undo"). Enter is 250ms `ease-out-strong` from 8px below with opacity; exit is a 100ms fade. Auto-dismiss after 5 seconds, paused on hover and focus. Failed review requests use the failed icon and say what failed: "Could not approve Header/Default [1280]. Your change was undone." Toasts use `role="status"`; errors use `role="alert"`.

Banners (build page states in SPEC 5.5). Full width of the main column, directly under the build header. Min height 36px, padding 8px 12px, radius `radius-md`, status fill, text in `text` color with a status-colored icon, one sentence and one link. Superseded and expired use the unchanged colors, pending uses added colors with a spinner, error and storage limit use failed colors, "From PR #123" uses unchanged. Banners stack in that order. The account and project pages use the same banner for storage: changed colors from 80% of the limit, failed colors once the limit is reached.

Keyboard hint chips (kbd). Height 20px, min width 20px, padding 0 5px, radius `radius-xs`, 1px `border`, `surface` fill, `text-2xs` Lilex, `muted`. Modifier keys print as words (`shift`), not symbols, matching SPEC. The `?` overlay is a dialog 560px wide, radius `radius-lg`, `shadow-menu`, listing SPEC's shortcut table as two columns: action in `text-sm`, keys as chips right-aligned.

Empty states. Left-aligned in the content column, not centered in a box. The lead-copy pattern at `text-2xl`, then at most one short paragraph and one primary action. The Setup card (SPEC 4.2) is the only boxed empty state: `surface`, 1px dotted `border` (onkeiki uses dotted borders for empty states and list separators), radius `radius-md`, padding 24px, with the 3-line CI snippet in a code block.

Skeletons. Blocks of `surface-2` with the exact size of the content they stand in for: 40px table rows with three bars, 32px sidebar rows, a viewer frame at 16:10. A 1.5s shimmer (`linear-gradient` with `#ffffff0d` in dark, `#0000000a` in light) that is removed under reduced motion. In code this is the `skeleton` utility with the `--color-shimmer` token, next to the `mono` utility and the `enter`, `fade` and `shimmer` keyframes in `styles.css`. Signed-in pages show skeletons until auth and the permission check finish (SPEC 5). Snapshot images reserve their real size from the stored width and height and show the same skeleton until they paint, so the viewer frame goes from the 16:10 skeleton to the image size without a jump. A new snapshot never shows the previous image while it loads. An image that fails to load asks for a new link once, then shows a `surface-2` block of the same size. In the viewer frames the block says "Could not load this image." with a Try again button, above the diff overlay; thumbnails and the slider show the block only.

Code blocks. `surface-2` fill, 1px `border`, radius `radius-md`, 13px/1.8 Lilex, 40px caption bar with file name and copy button. Snippets in `apps/web/src/snippets/` get syntax colors at build time from Shiki, with the GitHub light and dark default themes following the theme setting. Inline code: `surface-2`, 1px `border`, radius `radius-xs`, padding 1px 4px.

### Image viewer chrome

The viewer is a `surface` panel with radius `radius-lg` and 1px `border`. Inside it, from top to bottom:

1. Title row, 48px: snapshot name (`text-base` weight 500, split as in the sidebar), diff status pill, diff percent and pixel count (`text-xs muted`, tabular), then right-aligned the dimensions (`1280x720 to 1280x812` when they differ, with the second value in `changed` color), the position ("3 of 20") and previous and next buttons for `k` and `j`.
2. Toolbar, at least 44px, wraps instead of scrolling so tooltips are not clipped: one track on the left with the mode segmented control (Side by side 1, Diff 2, Slider 3, Flip 4), a 1px divider, and a labelled switch for the current mode's option (Diff overlay with `d` in Side by side, which draws the diff mask over the new image and is on by default, Diff only in Diff, Show baseline with `space` in Flip, none in Slider); while the diff shows (Side by side with the overlay on, and Diff), a second track with four 28px color dots for the diff color (Green, Red, Magenta, Blue), the active one on `surface` like a segmented option; on the right the zoom percent in `text-xs muted` and a secondary Fit button with `f`, disabled while the view is at Fit. The switch is 28x16, `accent` when on, `field-border` when off.
3. Stage: a pan and zoom canvas with `canvas` fill that fills the remaining height and clips the images, 16px padding around the image at the edges. Side-by-side panes are split by a 1px `border` line, side by side from 768px and stacked below. Images sit on the checkerboard at top-left alignment (SPEC 5.5), with no radius and no shadow. At zoom above 100%, `image-rendering: pixelated`. Each pane has a 28px caption strip above it ("Baseline #405", "New #411") in `text-xs muted`. In Flip mode the caption is the current side and switches instantly; the frame border turns `link` color while showing the baseline so the state is visible without reading.
4. Review bar, 56px, top border: review info on the left ("Approved by @alice 3 min ago", "Waiting for review") in `text-xs muted` with the review icon; on the right `[Undo  u]` ghost (only once reviewed), `[Reject  r]` danger and `[Approve  a]` primary, grouped so the pointer travels the shortest distance between them. The kbd chip inside a primary button uses the inverted style (`accent-fg` at 15% fill). `r` swaps the bar for a comment field with Cancel and Reject.

Checkerboard CSS, 8px squares:

```css
.checker {
  background-color: var(--color-checker-a);
  background-image: conic-gradient(var(--color-checker-b) 25%, transparent 0 50%, var(--color-checker-b) 0 75%, transparent 0);
  background-size: 16px 16px;
}
```

Slider handle: 2px vertical line in `link`, with a 24px round grip (`surface` fill, 1px `border`, two small chevrons) centered vertically. The handle is focusable and moves 1% per arrow key, 10% with shift. Diff overlay is the diff PNG at 70% opacity in the picked diff color over the new image, with a toggle to hide the new image and show the diff alone.

## Layout

Breakpoints: 640, 768, 1024, 1280. App header is 48px, `surface`, bottom border. Left: the logo mark (a 20px ink square with two pixel cut-outs, linking to all projects), a slash, the account switcher (account avatar, login, up-down caret; the menu lists accounts and "Add GitHub account"), and on project pages a slash and the repo name. Right: the user avatar, which opens a menu with name and login, a System, Light, Dark icon switch, and Sign out. The favicon is the same mark, `apps/web/public/favicon.svg`, which follows the system color scheme, with a 180px `apple-touch-icon.png` on ink and a 16, 32 and 48px `favicon.ico` in the light colors for clients that request it directly. Public pages use a 64px header and a 1448px max width with a 24px gutter (onkeiki's `--keiki-site-width` and `--site-nav-height`).

Account home and project pages. Content max width 1200px, centered, 32px top padding (24px below 640px). A left-aligned column on a 1440px screen left a wide empty band on the right, so the column is centered like onkeiki's site width. Page title row: optional leading avatar (40px, `radius-xs`), `text-xl` title with a `text-xs muted` meta line under it (on the project page the owner link sits above the repo name instead), and a secondary button on the right ("Configure on GitHub", "Repository"). Filters are a row of 28px ghost-style select buttons above the table, 8px apart.

Usage page. A summary box on `surface` with a 1px `border` ring and `radius-lg`: the stored size in `text-2xl` weight 600 with "of 10 GB stored" in `muted`, an 8px `surface-2` track filled left to right by baselines in `approved`, PR-only images in `changed` and diff images in `subtle`, each as a share of the plan limit, and a legend of 8px dots with the sizes. Under it the daily chart: 128px of bars in `link`, 1px apart with `radius-xs` tops, a `border` baseline, and the first date, peak and last date in `text-xs muted` under it. Then the project table. Sizes read in B, KB, MB or GB with one decimal.

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

Below 1024 the sidebar becomes a drawer over the viewer (up to 320px, `shadow-menu`, dimmed backdrop), opened by a "3 of 13" button in the title row; `j` and `k` still work with it closed. Below 640 the header actions and review buttons stretch to full width, mode labels shorten (Side, Diff, Slider, Flip), side-by-side stacks baseline above new, and buttons are 44px on coarse pointers. Viewer settings are not saved: every visit starts in Side by side at Fit with the diff overlay on in green. The theme is the only saved preference.

Builds table on mobile: rows become two-line list items with a row line between them, line one is `#412` plus the conclusion pill and time, line two is the branch in mono and the commit message in `muted`. PR and SHA are dropped.

Baselines grid: `repeat(auto-fill, minmax(220px, 1fr))`, gap 16px. Each tile is a `surface-2` box at the image's aspect ratio capped at 4:3, image `object-fit: contain` top-aligned (never `cover`, which would crop), name under it in `text-xs` mono. Hover draws a 1px `field-border` outline.

Settings: one column, 640px max width, sections separated by 48px and a dotted `border` line, label above field.

Landing (`/`): 64px sticky header on `surface` with the wordmark, ghost links (Demo, How it works, Pricing, FAQ, Compare, Docs) and on the right, when signed out, a `text-xs muted` "Free up to 10 GB" from 1024px up, a ghost Sign in from 640px up and a primary Start free (Open dashboard when signed in), 1448px max width. Sections top to bottom: a centered H1 at clamp(36px, 3.6vw, 52px) weight 600 with -0.045em tracking and its second half in `muted`, centered lead copy, Start free with GitHub and a secondary "See pricing" anchor, and a `text-xs muted` free line, on the pricing pixel texture that also runs behind the interactive demo; the demo, the real `Viewer` on a checkerboard inside a `radius-xl` frame, fed by static images in `public/demo/` that `stateofpixel compare` produced with keys active while 60% of it is in view and a check line under it that follows the review state; the cost of 1,000 more screenshots as four 56px figures in dotted cells, ours first in `approved`, with a dated footnote; setup steps next to a tabbed code block (Playwright, Storybook, GitHub Actions, Other CI, Local, each tab with its 14px logo or icon from `public/logos/`, and a note that links to its docs guide); "Nothing to wait for" with the median upload from our own `visual.yml` runs at 56px and three `Fig 0.1` to `Fig 0.3` panels on `surface-2` with small CSS figures that animate unless motion is reduced; the GitHub to stateofpixel permission table; "Made for real pipelines" as dotted rows; the plan cards (Free, 25 GB, 100 GB, 500 GB) with a Monthly and Yearly switch and a contact line above 500 GB, where Free spans two columns over a status-color pixel texture (`public/pricing-pixels.png`, the `pixel-texture` class); a stories slider next to monthly bars for stateofpixel, Argos, Chromatic and Percy from the compare calculator; four promises in two columns with `approved` checks; a `surface-2` strip with a "From X" button per competitor that links to its switch section; the FAQ as `details` rows; "Start free. Pay when you pass 10 GB." with three checks and the workflow snippet on a `bg` band; a dotted footer. The page follows the theme setting.

Docs (`/docs`): the public header and footer with a 208px sticky nav on the left, grouped under `text-xs muted` labels with 32px `radius-sm` rows (`hover` fill and weight 500 for the current page), and one article column of 680px. The title is 28 to 36px weight 600 with a `text-lg muted` lead under it; body is `text-base` on a 24px line, `text-lg` weight 600 section headings with a `#` link on hover, code in `CodeBlock`, inline code as `mono` on `surface-2`, and tables with `text-2xs muted` headers and `border` rows. Previous and next cards close every page. Below 1024 the nav folds into a "Docs / Page" disclosure above the article. The quickstart opens with four setup cards in two columns (`surface`, 1px `border`, 36px icon tile, `hover` fill) and a copyable coding agent prompt in a code block style box.

Compare (`/compare/{competitor}`): the public header and footer. Hero: our mark, "vs" in mono and the competitor logo at 32px with a "Compare / X" breadcrumb, for priced competitors a `text-display` H1 that leads with the yearly saving for the default suite in `approved` at clamp(56px, 7vw, 112px) and "a year less than X.", with the suite in `text-sm muted` under it (Lost Pixel keeps its own headline), lead copy, Start free with GitHub and "See the switch", and a `text-xs muted` line with the check date and a link to the sources; on the right a 480px card with the `HeroChecks` shadow, either the monthly bill for the default suite (ours in `approved` at 36px) or, for Lost Pixel, a status list under a "Shutting down" pill in `rejected`. Then: two pipeline lanes of four numbered steps, theirs on `surface-2` with a `changed` "Billed per" pill and ours on `surface` with `approved` step numbers and pill; three numbered difference cards; the review page screenshot on the checkerboard; the cost calculator, range sliders on `surface-2` next to one bar per tool and a yearly savings line; the grouped table (Pricing, Screenshots, Platform) with a sticky header of logos, our column in weight 500 and superscript `link` numbers to the sources, where the label spans both columns below 768px; "Where X is ahead" cards on `surface-2` with their logo; three switch steps above a Before and After pair of code blocks; the FAQ as `details` rows; the sources in three columns of `text-xs`; the display line on a `bg` band with the other comparisons as logo rows. Competitor logos are the companies' GitHub avatars at 128px, shown with a 22% radius and a `border` ring. The index (`/compare`) has all five logos above the H1, one card per competitor (40px logo, name, one line, three facts, the default suite bill) and the calculator with every priced competitor.

Open Graph images: every public page and docs page gets a 1200x630 PNG at `/og/<path>.png`, rendered by `apps/web/scripts/ogImage.ts` with satori and resvg, at build time by `scripts/og-images.ts` and on request in dev, from the title and description in `src/lib/pageMeta.ts` and the docs meta. The card is `bg` with the wordmark and the page path in Lilex `muted` at the top, the title at 72px weight 600 with -0.045em tracking and the description at 30px `muted` at the bottom, and the pricing pixel texture on the right at 50% opacity, unsmoothed. Both use `textWrap: balance`. The landing card shows the title only. Compare cards replace the path with "vs" and the competitor logo, and use the page headline as the title. `visual/og.visual.ts` captures every card on the desktop project, so the `web` build reviews them.

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

Reduced motion. Under `prefers-reduced-motion: reduce` all transitions and animations are removed (the base layer in `styles.css`), skeleton shimmer stops, and toasts appear without the slide.

Other. Sidebar list is a `listbox` with `aria-activedescendant` so `j` and `k` announce the selected snapshot. Review results are announced through the toast live region. Hit targets are 44px on coarse pointers.
