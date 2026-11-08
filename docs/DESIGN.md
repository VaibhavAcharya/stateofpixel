# stateofpixel: design system

## Principles

1. The screenshot is the loudest thing on the screen. Chrome is grayscale, one weight of border, no gradients. Color is reserved for status and for the diff highlight.
2. Never touch the pixels. The viewer shows images at their true pixels: no rounded corners on the image, no shadow over it, no smoothing above 100% zoom, no filters in dark mode.
3. Dense by default. 14px body text, 32px controls, 32px list rows. A reviewer should see 20+ snapshot names without scrolling on a 900px tall laptop screen.
4. Keyboard first, mouse welcome. Every action on the build page has a key, and the key is printed next to the button.
5. Status is text plus shape plus color. Color alone never carries meaning.
6. Quiet motion. Hover and focus changes are 100 to 250ms. Nothing moves on its own in the app.

## Tokens

Components, neutral colors, fonts, radius and shadows come from [uiofcraft](https://www.npmjs.com/package/uiofcraft), which is built on coss ui (Base UI and Tailwind v4). Its usage guide is `node_modules/uiofcraft/docs/usage.md`. This page lists what stateofpixel adds on top and how the app uses it.

### Color

Neutrals are the uiofcraft tokens. Light values are in `:root` and dark values in `.dark`, in `uiofcraft/theme.css`. Hex values below are the computed sRGB values.

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#ffffff` | `#161616` | Page content |
| `sidebar` | `#fafafa` | `#111111` | Public page frame and header, app header, build sidebar |
| `card` | `#ffffff` | `#1b1b1b` | Cards, table, viewer panel |
| `popover` | same as `card` | same as `card` | Menus, tooltips, the review dock, zoom group |
| `muted` | black 4% | white 4% | Recessed fills: code captions, neutral bands, segmented tracks |
| `accent` | black 4% | white 4% | Row hover and selected row |
| `border` | black 8% | white 6% | Hairlines, card borders, dividers |
| `input` | black 10% | white 8% | Input and outline button borders |
| `foreground` | `#262626` | `#f5f5f5` | Primary text |
| `muted-foreground` | `#686868` | `#818181` | Secondary text, metadata, inactive tabs, placeholders |
| `primary` | `#262626` | `#f5f5f5` | Primary button fill, active segment |
| `primary-foreground` | `#fafafa` | `#262626` | Text on `primary` |
| `ring` | neutral 400 | neutral 500 | Focus ring |

stateofpixel adds these in `apps/web/src/styles.css`:

| Token | Light | Dark | Use |
|---|---|---|---|
| `link` | blue 600 (`#155dfc`) | blue 400 (`#51a2ff`) | Links, slider handle, selection bar in lists |

The primary color is ink. That keeps the blue free for "this is interactive" and every hue free for status.

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
| `diff` | `#ff00ff` (default), `#00cc00`, `#ff0000` or `#0066ff` at 70% opacity | same | Diff overlay, in the color picked in the toolbar. Same in both themes because it sits on the screenshot. |
| `checker-a` / `checker-b` | `#ffffff` / `#e6e6e6` | `#1a1a1a` / `#292929` | Checkerboard, 8px squares |
| `canvas` | `#f5f5f5` | `#0a0a0a` | Area around the image inside the viewer |

The diff PNG is made by the CLI. The CLI renders diff pixels opaque on transparent (`diffMask` in pixelmatch, `outputDiffMask` in odiff). The viewer paints every non-transparent pixel in the picked color with an SVG filter, so the color in the PNG does not matter.

### Typography

UI and heading font: DM Sans. Mono: Lilex. Both come with `uiofcraft/styles.css` as `font-sans`, `font-heading` and `font-mono`, so the app has no font packages of its own. The OG image script renders with satori, which needs static files, so it reads DM Sans from `@fontsource/dm-sans` and Lilex from `@fontsource/lilex`.

The type scale is the Tailwind default (`text-xs` 12px, `text-sm` 14px, `text-base` 16px, and up). uiofcraft controls use `text-base` below 640px and `text-sm` from 640px. stateofpixel adds `text-2xs` (11 / 16) for dense labels.

| Use | Classes |
|---|---|
| Landing and docs hero | `font-heading font-semibold`, `clamp(2.5rem, 5.5vw, 4.5rem)`, line height 1, -0.02em |
| Landing section title | `font-heading font-semibold text-3xl`, `sm:text-[2.5rem]`, -0.01em, with a `text-lg muted-foreground` paragraph under it |
| Closing display line | `clamp(2.25rem, 5vw, 3.75rem)`, line height 1.02, -0.015em |
| App page title | `font-heading font-semibold text-2xl` |
| Empty state title | `font-heading font-semibold text-xl`, with a `text-sm muted-foreground` paragraph under it |
| Body, rows, buttons | `text-sm` |
| Metadata, timestamps, helper text | `text-xs` |

Rules. Numbers (counts, diff percent, sizes, build numbers) use `font-variant-numeric: tabular-nums`. Hashes, branch names and file paths use Lilex through the `mono` utility, which sets it at 0.925em of the text around it. Snapshot names use DM Sans: the parent path in `muted-foreground`, the last segment in `foreground`, and the viewport suffix (`[1280]`) as a separate `mono` `muted-foreground` label that never truncates. Max prose width is 65ch (docs, empty states). Headings use `text-wrap: balance`.

`LeadCopy` in `ui.tsx` renders a title and a paragraph under it, at the `hero`, `section` or `app` size. `as="h1"` defaults to `hero`.

### Spacing

4px base, the Tailwind v4 default `--spacing: 0.25rem`. Page gutter: 24px from 640px, 16px below. Landing section padding: 96px from 640px, 64px below.

### Radius

uiofcraft sets `--radius` to 10px and derives the rest: `rounded-sm` 6px, `rounded-md` 8px, `rounded-lg` 10px, `rounded-xl` 14px, `rounded-2xl` 18px. stateofpixel adds `rounded-xs` (5px) for small swatches and the `rounded-control` alias for `rounded-lg`.

| Radius | Use |
|---|---|
| `rounded-lg` | Buttons, inputs, menus, segmented tracks |
| `rounded-xl` | Code blocks, viewer dock, small cards |
| `rounded-2xl` | Landing cards, the demo frame, pricing cards |
| none | Screenshots, always |

### Borders and shadows

One border weight: 1px `border`. Cards also get uiofcraft's `shadow-xs/5`. Things that float over content (menus, tooltips, the review dock, the zoom group) use `bg-popover`, a 1px `border` and `shadow-lg/5`. The landing demo frame has the coss frame shadow, `shadow-[0_32px_64px_-32px] shadow-black/24` (`black/64` in dark).

`shadow-menu`, `shadow-tooltip` and `shadow-field-focus` are still defined in `styles.css` for the few places not yet on uiofcraft components.

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

`apps/web/src/styles.css` imports `tailwindcss`, then `uiofcraft/styles.css`, then adds the stateofpixel tokens above (status colors, `link`, `canvas`, checkerboard, `text-2xs`, motion) and the `mono`, `skeleton`, `checker`, `syntax`, `pixel-texture` and `range-slider` utilities. Status colors are redefined under `.dark`, so every utility switches without a `dark:` prefix.

Dark mode approach. The user picks System, Light or Dark in the user menu; the choice is stored in `localStorage` under `theme` (default System). A small inline script in the root route's `<head>` resolves System with `matchMedia("(prefers-color-scheme: dark)")` and toggles the `dark` class on `<html>` before first paint, and listens for changes while on System. That class is what uiofcraft reads. The script runs on the server-rendered public pages too, so there is no flash. Without JavaScript the page is light.

## Components

Use the uiofcraft component for every control it has (Button, Input, InputGroup, Menu, Dialog, Table, Alert, Badge, Kbd, Tooltip, Skeleton, Spinner, SegmentedControl, Tabs, Field, Checkbox) and compose with `render`, as in `node_modules/uiofcraft/docs/usage.md`. The paragraphs below say which variant the app uses and what it adds.

Icons: Phosphor Icons from `@phosphor-icons/react/ssr`, the same set uiofcraft uses, regular weight. Inside uiofcraft controls they are sized by the component; elsewhere 16px in rows and 12px inside pills. Color follows the text they sit next to.

Buttons. uiofcraft `Button`. Primary actions use `default`, secondary ones `outline`, toolbar and nav buttons `ghost`, and Reject and Delete project `destructive-outline`. Toolbars use `size="sm"` and icon buttons `icon` or `icon-sm`. Links that look like buttons pass `render={<Link />}` or `render={<a />}`. `buttonClass()` in `ui.tsx` returns the same classes for the few triggers that cannot render a `Button`. A control the user is not allowed to use sets `aria-disabled` instead of `disabled`, so it stays focusable, shows a not-allowed cursor and carries a tooltip that says who can use it. Keyboard keys live in tooltips ("Approve, press a"), never as chips inside a control; kbd chips only appear in the shortcuts dialog, the docs and the landing copy.

Inputs. uiofcraft `Input`, `Textarea` and `InputGroup`, with `Field` for label and description in settings. Settings fields save on blur and show "Saved" in `text-xs muted-foreground` to the right for 2 seconds. The sidebar filter is an `InputGroup` with a search icon and a clear button, and its `/` key lives in a tooltip.

Pills. uiofcraft `Badge` with the status fill and status text color, 12px bold icon then label. Superseded and PR state use the `outline` badge in `muted-foreground`. Always icon plus word ("Changed", "12 to review"), never a bare dot. Counts inside pills are tabular. The diff percent next to a changed row is plain `text-xs muted-foreground` text, not a pill.

Tables (builds list, account home, accounts, usage). No outer card on wide screens; the table sits on `background` with a 1px `border` line under the header and between rows. They render through uiofcraft `Table`. Header cells are `muted-foreground`, no uppercase. Body rows: 44px (48px on the account home), `text-sm`, padding 0 12px per cell, hover `accent` fill across the row, the whole row is one link. Build number is `#412` in weight 500 on the left; time is right-aligned and tabular; SHA is mono `muted-foreground`. The branch cell is a button that sets the branch filter; the active filter shows as a removable chip above the table. Relative time shows the absolute date in a tooltip. Pending builds show a 12px spinner and "2 of 4 shards" in the status cell. "Load more" is a secondary button centered under the table. Tables are built on TanStack Table (`@tanstack/react-table` 9.2.4, MIT) in manual mode through `DataTable`: the server sorts, filters and paginates, and the table renders what it gets. Sortable headers are buttons with a 10px caret for the active direction and set `aria-sort`. Sort and filters live in the URL so a view can be shared. A toolbar above the table holds the controls, 8px apart: a 256px search field (full width below 640px) with a 200ms delay, a "State" menu with a check on the current option, and removable chips for branch and pull request, which are set by clicking those cells. "Clear filters" is a ghost button that appears once a filter is set. Builds sort by number, newest first; projects sort by name or last build, and search orders by relevance with sorting turned off. The account home has the project table (project, latest build with its state pill, branch, updated). Accounts has one row per account (avatar, login and type, storage of the plan limit, project count, last build). `j` and `k` move focus between rows, Enter opens the row, and the focused row gets the `accent` fill and a 2px inset `focus` ring. An empty PR cell stays blank.

Sidebar list rows (build page). Height 32px, padding 0 8px, radius `rounded-md`, `text-sm`. Left: review icon (16px, colored by review state). Middle: snapshot name in mono, truncated with an ellipsis in the middle so the viewport suffix `[1280]` stays visible; full name in `title`. Right: diff percent for changed rows, `text-xs muted-foreground`, tabular. Selected row: `accent` fill plus a 2px `link` bar on the left edge inside the row. Keyboard focus on a row uses the standard focus ring. Group headers are 28px, `text-xs` weight 500, `muted`: the diff status icon in its color, the label, then the count and a caret right-aligned. Every group collapses; Unstable and Unchanged are collapsed by default. Snapshots whose names differ only in the bracketed suffix share one story row: the review icon of the whole story (rejected, then pending, then approved), the name without the suffix, the largest diff percent, and on the right a 40px button with the count and a 10px caret. Stories are open by default and list their snapshots as 32px rows indented 24px, labelled with the suffix in mono `muted-foreground` and sorted with numbers in order; the caret folds a story into its one row. When the build has more than one browser, rows that changed in only some browsers come first under a 24px `text-2xs muted-foreground` "Some browsers" label, with the browsers in a `changed` pill on stories and single rows alike, and the rest follow under "All browsers". When the build has more than one browser, a "Browser" select menu sits under the filter input, with All and one option per browser from the snapshot metadata. Changed snapshots on the project's unstable list move from Changed to an Unstable group between Failed and Unchanged, with the changed icon; its count and the Changed count come from the loaded rows. The filter and the browser menu narrow the rows and `j`/`k` navigation, and the server applies them so rows that are not loaded yet are found too; the group counts stay the build totals. The per-status counts live here instead of in the build header. The sidebar ends with a 40px footer holding a "Keyboard shortcuts `?`" button.

Tabs (account and project pages). A `<nav>` of route links with `aria-current`, styled like the uiofcraft underline `TabsList`: a 16px icon then the label, `text-sm`, `muted-foreground` when inactive, `foreground` with a 2px `primary` underline when active. They stay links rather than Base UI Tabs because they navigate. The account pages have Overview, Members, Usage and Billing; the project page has Builds, Baselines and Settings. A tab the user cannot open stays in place at reduced opacity with a tooltip.

Tooltips. uiofcraft `Tooltip`, wrapped by `Tooltip` in `ui.tsx` with a `label`, `side` (default bottom) and `align` (default start). Shown on hover and keyboard focus. The zoom group puts its tooltips on the left. Relative times keep the native `title` tooltip.

Segmented control. uiofcraft `SegmentedControl`, rendered through the primitive that matches the behavior: a radio group for the billing period, `Tabs` for the setup snippets on the landing page. The build verdict switch and the pipeline and compare pickers keep their own track on `muted`. The viewer modes are toolbar buttons instead: no track, the active one with `accent` fill and `foreground` color, each with a 16px icon and its label and its key in a tooltip.

Range sliders (landing and compare calculators). `RangeSlider` in `apps/web/src/components/RangeSlider.tsx` stays a native `<input type="range">`, because the calculator reads its change events. Its thumb and focus ring follow the uiofcraft `Slider`, and the track fill is the `range-slider` class in `styles.css`.

Toasts. Bottom center, 16px from the bottom edge, and 64px on the build page so they clear the review dock. Width up to 420px, styled like the uiofcraft toast: `popover` fill, 1px `border`, `rounded-lg`, `text-sm`, and a uiofcraft `Button` to dismiss. They still render through `useToasts` and `Toasts` in `Toast.tsx`, not the uiofcraft `ToastProvider`. Icon colored by type, message, optional action ("Retry", "Undo"). Enter is 250ms `ease-out-strong` from 8px below with opacity; exit is a 100ms fade. Auto-dismiss after 5 seconds, paused on hover and focus. Failed review requests use the failed icon and say what failed: "Could not approve Header/Default [1280]. Your change was undone." Toasts use `role="status"`; errors use `role="alert"`.

Banners (build page states). Full width of the main column, directly under the build header. Account and plan banners are uiofcraft `Alert`s with `role="note"`. Build page banners have a min height of 36px, status fill, text in `foreground` with a status-colored icon, one sentence and one link. Superseded and expired use the unchanged colors, pending uses added colors with a spinner, error and storage limit use failed colors, "From PR #123" uses unchanged. Banners stack in that order. The account and project pages use the same banner for storage: changed colors from 80% of the limit, failed colors once the limit is reached.

Keyboard hint chips (kbd). uiofcraft `Kbd`. Modifier keys print as words (`shift`), not symbols, matching the docs. The `?` overlay is a uiofcraft `Dialog` listing `SHORTCUT_GROUPS` as two columns: action in `text-sm`, keys as chips right-aligned.

Empty states. Left-aligned in the content column, not centered in a box. `EmptyState` renders `LeadCopy` at the `app` size, then at most one action. The Setup card on a project with no builds is the only boxed empty state, with the 3-line CI snippet in a code block.

Skeletons. uiofcraft `Skeleton` blocks with the exact size of the content they stand in for: 40px table rows with three bars, 32px sidebar rows, a viewer frame at 16:10. A 1.5s shimmer (`linear-gradient` with `#ffffff0d` in dark, `#0000000a` in light) that is removed under reduced motion. Image placeholders still use the `skeleton` utility in `styles.css`, with the `--color-shimmer` token. Signed-in pages show skeletons until auth and the permission check finish. Snapshot images reserve their real size from the stored width and height and show the same skeleton until they paint, so the viewer frame goes from the 16:10 skeleton to the image size without a jump. A new snapshot never shows the previous image while it loads. An image that fails to load asks for a new link once, then shows a `muted` block of the same size. In the viewer frames the block says "Could not load this image." with a Try again button, above the diff overlay; thumbnails and the slider show the block only.

Code blocks. `CodeBlock`: `card` fill, 1px `border`, `rounded-xl`, `shadow-xs/5`, 13px/1.7 Lilex, and a 40px caption bar on `muted` with the file name and a ghost icon `Button` to copy. Snippets in `apps/web/src/snippets/` get syntax colors at build time from Shiki, with the GitHub light and dark default themes following the theme setting. Inline code: `muted-foreground`, 1px `border`, `rounded-xs`, padding 1px 4px.

### Image viewer chrome

The viewer is a `card` panel with radius `rounded-xl` and 1px `border`. Inside it, from top to bottom:

1. Title row, 48px: snapshot name (`text-base` weight 500, split as in the sidebar), diff status pill, diff percent and pixel count (`text-xs muted-foreground`, tabular), then right-aligned the dimensions (`1280x720 to 1280x812` when they differ, with the second value in `changed` color), the review status ("Approved by @alice 3 min ago", "Waiting for review", or for a folded story "9 snapshots, 9 to review") in `text-xs muted-foreground` with the review icon, and the position ("3 of 20"). Previous and next live in the dock only.
2. Toolbar, at least 44px, wraps instead of scrolling so tooltips are not clipped. With only one image (added or removed) it keeps its height and says "Only the new image, nothing to compare" or "Only the baseline image, nothing to compare" in `text-xs muted-foreground`, so the stage does not jump between snapshots. Otherwise on the left the mode toolbar buttons (Side by side 1, Diff 2, Slider 3, Flip 4), a 1px `border` divider, and a labelled switch for the current mode's option (Diff overlay with `d` in Side by side, which draws the diff mask over the new image and is on by default, Diff only in Diff, Show baseline with `space` in Flip, none in Slider); on the right, while the diff shows (Side by side with the overlay on, and Diff), the diff color: a stack of four 12px swatches with the picked one on top at the right (2px `muted` gap and a 1.5px `text` ring) and the others 3px apart behind it to the left, which fans out to the left in 20px steps (36px on touch) on hover, keyboard focus or a tap, with the picked one staying in place, and closes when the pointer or focus leaves. It is a native radio group, so arrow keys pick a color, and `c` moves to the next one. Zoom sits on the stage instead: a 36px wide vertical `popover` group with a 1px `border`, `shadow-lg/5` and `rounded-lg`, 8px from the bottom right corner, shown while the pointer is over the stage or a control in it has focus, and always on touch, where pinch also zooms. It holds zoom in, the percent (which goes to 100%), zoom out and Fit, each 20px tall with 10px icons and 9px text, and its key in a tooltip to the left. Zoom goes from half the size that shows the whole image up to 800%. The switch is 28x16, `primary` when on, `input` when off.
3. Stage: a pan and zoom canvas with `canvas` fill that fills the remaining height and clips the images, 16px padding around the image at the edges. Side-by-side panes are split by a 1px `border` line, side by side from 768px and stacked below. Images sit on the checkerboard at top-left alignment, with no radius and no shadow. At zoom above 100%, `image-rendering: pixelated`. Each pane has a 28px caption strip above it ("Baseline #405", "New #411") in `text-xs muted-foreground`. In Flip mode the caption is the current side and switches instantly; the frame border turns `link` color while showing the baseline so the state is visible without reading.
4. Review dock, on every snapshot: a floating `popover` group with a 1px `border`, `shadow-lg/5`, `rounded-xl` and 4px padding, centered 8px above the bottom of the stage, with 32px ghost icon buttons (radius `rounded-md`, 16px icons, 14px carets) for previous, reject (`rejected` icon), approve (`approved` icon), undo and next. The buttons never move: undo is disabled until the snapshot is reviewed, and reject and approve are disabled on snapshots that need no review and for readers without write access. The current review state shows as the `accent` fill on its button. Keys live in the tooltips. `r` and `a` review and move to the next pending snapshot, `u` undoes. Comments sit outside the dock: a second floating group of the same style, 8px to its right, with one ghost button that shows a comment icon and the count once there are comments, so the dock itself stays centered. It and `m` open a 480px dialog titled "Comments on {name}" with every comment left on the snapshot, oldest first: the login in weight 500, "commented" and the relative time in `text-xs muted-foreground` after a 12px comment icon, then the text. Comments saved with a rejection earlier show the rejected icon and "rejected" instead. Under the thread, people who can review get a comment field (up to 500 characters) with Cancel and a primary Comment button, disabled while the field is empty; Cmd or Ctrl Enter submits. A comment does not change the review, and the dialog stays open so the new comment shows in the thread. Readers see the thread only. On a folded story the dock reviews every snapshot in it.

Checkerboard CSS, 8px squares:

```css
.checker {
  background-color: var(--color-checker-a);
  background-image: conic-gradient(var(--color-checker-b) 25%, transparent 0 50%, var(--color-checker-b) 0 75%, transparent 0);
  background-size: 16px 16px;
}
```

Slider handle: 2px vertical line in `link`, with a 24px round grip (`card` fill, 1px `border`, two small chevrons) centered vertically. The handle is focusable and moves 1% per arrow key, 10% with shift. Diff overlay is the diff PNG at 70% opacity in the picked diff color over the new image, with a toggle to hide the new image and show the diff alone.

## Layout

Breakpoints: 640, 768, 1024, 1280. App header is 48px, `sidebar`, bottom border. Left: the logo mark (a 20px ink square with two pixel cut-outs, linking to the landing page), an "Accounts" link in `text-sm` weight 500, `muted-foreground` and `text` on Accounts itself, hidden below 640px inside an account, then on account and project pages a slash and the account switcher (account avatar, login, up-down caret; the menu lists All accounts, the accounts and "Add GitHub account"), and on project pages a slash and the repo name. Right: the user avatar, which opens a menu with name and login, a System, Light, Dark icon switch, and Sign out. The favicon is the same mark, `apps/web/public/favicon.svg`, which follows the system color scheme, with a 180px `apple-touch-icon.png` on ink and a 16, 32 and 48px `favicon.ico` in the light colors for clients that request it directly. Public pages follow the coss.com layout. The page frame is `sidebar` with content on `background`, and from 1440px two 1px `border/64` rails mark the 1440px column. The header is 64px, sticky, `sidebar` at 80% with a backdrop blur and a `border/64` hairline under it. Content sits in a 1416px column with a 16px gutter (24px from 640px). The footer is `muted/32` with a `border/64` top line: on the left the wordmark, the tagline and the Company of Craft link; on the right four link columns (Product, Company, Legal, Small free tools) with `text-sm` weight 500 `foreground` labels and `text-sm muted-foreground` links 8px apart, two columns below 768px; under a hairline, the copyright and the support email in `text-xs`. A new public page goes into one of the groups instead of a new row.

Account home and project pages. Content max width 1200px, centered, 32px top padding (24px below 640px). A left-aligned column on a 1440px screen left a wide empty band on the right, so the column is centered. Page title row: optional leading avatar (40px, `rounded-xs`), `text-xl` title with a `text-xs muted-foreground` meta line under it (on the project page the owner link sits above the repo name instead), and a secondary button on the right ("Configure on GitHub", "Repository"). Filters are a row of 28px ghost-style select buttons above the table, 8px apart.

Usage page. A summary box on `card` with a 1px `border` ring and `rounded-xl`: the stored size in `text-2xl` weight 600 with "of 10 GB stored" in `muted-foreground`, an 8px `muted` track filled left to right by baselines in `approved`, PR-only images in `changed` and diff images in `muted-foreground`, each as a share of the plan limit, and a legend of 8px dots with the sizes. Under it the daily chart: 128px of bars in `link`, 1px apart with `rounded-xs` tops, a `border` baseline, and the first date, peak and last date in `text-xs muted-foreground` under it. Then the project table. Sizes read in B, KB, MB or GB with one decimal.

Build review page. Full width, no max width, the viewport height is fixed and only the sidebar list and the stage scroll.

```
+----------------------------------------------------------------+ 48 app header
| #411 feat/header d4e5f6 "New header" PR #88  vs #405 (main)    | 72 build header
| [10 changed] [2 added] [1 removed] [1,488 unchanged] [Reject|12|Approve]|
+----------------------------------------------------------------+
| banner (optional, 36)                                          |
+------------------+---------------------------------------------+
| filter      [/]  | title row                          48       |
| Changed (10)     | toolbar                            40       |
|  row 32          | +-----------------------------------------+ |
|  row             | | stage (scrolls, pans)                   | |
| Added (2)        | +-----------------------------------------+ |
| ...              | review dock floats on the stage         |
| 300px            | history and metadata (collapsible)          |
+------------------+---------------------------------------------+
```

Build header, about 76px: line one is `#411` in `muted-foreground` then the commit message in `text-lg` weight 600, truncated, then the conclusion pill, which is hidden while the verdict switch shows since the switch carries the same state; line two is `text-xs muted-foreground` metadata with 14px icons: branch (links to the filtered builds list), SHA, PR, "vs #405 on main", time. On the right, once the build is finalized and has changes to review, the verdict switch: a 32px segmented track, 440px wide, with "Reject build", the count to review out of the snapshots to review ("4/5 to review", `text-xs` below 640px) and "Approve build". The `card` thumb sits on the count while snapshots wait and slides to a side when that build action runs or when nothing is left to review, to Reject when anything is rejected and to Approve otherwise. The side's label then reads "Rejected" or "Approved" with its icon in `rejected` or `approved`. The middle reads "Undo" whenever the thumb is on a side. A side that would change nothing is disabled in `muted-foreground`. A 2px bar under the count fills with the rejected and approved shares. Each side and the middle Undo have their action and key in a tooltip: `shift a` approves the build, `shift r` rejects it and `shift u` undoes. A build action covers the pending snapshots and the ones the other build action changed. Undo after a build action returns only those to pending, so reviews made one by one stay; with no build action to undo, it returns every snapshot to pending, without a confirm. The sidebar is 300px at 1280 and up, 260px from 1024 to 1279, `sidebar` with a right border. From 1024 up its right edge is a 5px resize handle that turns `link` color on hover, focus and drag, with a 3x16px `input` grip at 60% in the middle of the edge that turns `link` with it. It resizes from 220px to 480px, and never past half the viewport. Arrow keys move it by 16px, Home and End jump to the limits, and a double-click resets it. The detail footer (metadata) sits below the stage and is collapsed to one 32px line by default so the stage keeps its height.

Below 1024 the sidebar becomes a drawer over the viewer (up to 320px, `shadow-menu`, dimmed backdrop), opened by a "3 of 13" button in the title row; `j` and `k` still work with it closed. The drawer has a close button next to the filter, and Escape or a tap on the backdrop closes it too. Below 640 the verdict switch stretches to full width, mode labels shorten (Side, Diff, Slider, Flip), and side-by-side stacks baseline above new. Viewer settings are not saved: every visit starts in Side by side at Fit with the diff overlay on in magenta. The theme is the only saved preference.

Builds table on mobile: rows become two-line list items with a row line between them, line one is `#412` plus the conclusion pill and time, line two is the branch in mono and the commit message in `muted-foreground`. PR and SHA are dropped.

Baselines grid: `repeat(auto-fill, minmax(220px, 1fr))`, gap 16px. Each tile is a `muted` box at the image's aspect ratio capped at 4:3, image `object-fit: contain` top-aligned (never `cover`, which would crop), name under it in `text-xs` mono. Hover draws a 1px `input` outline.

Settings: one column, 640px max width, sections separated by 48px and a `border` line, label above field.

Landing (`/`): the public header with the wordmark, ghost links (Demo, How it works, Pricing, FAQ, Compare, Docs, Open source) from 1024px and a menu below, and on the right a ghost Sign in from 640px up and a primary Start free (Open dashboard when signed in). Sections are `py-16 sm:py-24`; "Access follows GitHub", the questions and the closing line sit on `muted/80` bands. Sections top to bottom: the hero on a 12 column grid, the H1 in 8 columns at the hero size, and in the other 4 the lead copy, Start free with GitHub and an outline "See pricing" button, and a `text-xs muted-foreground` free line; the demo, the real build page (`BuildPage`, the same fixture hook as the lab builds) on a checkerboard inside a uiofcraft `CardFrame` with the coss frame shadow, whose header says "Same review page as the app" and lists the keys from 1024px, fed by static images in `public/demo/` that `stateofpixel compare` produced, with links shown as plain text, keys active while 60% of it is in view and a check line under it that shows the GitHub check text and a Start over button once nothing is pending; setup steps next to a uiofcraft `Tabs` code block (Playwright, Storybook, GitHub Actions, Other CI, Local, each tab with its 14px logo or icon from `public/logos/`, and a note that links to its docs guide); "Nothing to wait for" as one CI run on a `muted` card: a stateofpixel lane where the upload bar fills to the median upload from our own `visual.yml` runs on a seconds axis, then the time at 40px, four step cards and the pending check row, and a hosted rendering lane of dashed steps with no times, played once when it scrolls into view, with a Replay button and the end state under reduced motion; "Access follows GitHub" with two facts and a docs link next to a grid of GitHub roles by capability, Owner first with `approved` checks, a list per role below 640px; the pipeline cases as a list in three groups with each case's flag in mono and a sliding 2px `link` bar, next to the case text, a switch between its states, the CI snippet in a code block, a mock of the check or build page it leads to and a docs link, with the list as a scrolling row below 1024px; the plan cards (Free, 25 GB, 100 GB, 500 GB, `rounded-2xl` with `shadow-xs/5`) with a Monthly and Yearly `SegmentedControl` and a contact line above 500 GB, where Free spans two columns over a status-color pixel texture (`public/pricing-pixels.png`, the `pixel-texture` class); the compare page cost calculator with Argos, Chromatic and Percy; a card with an outline "From X" button per competitor that links to its switch section; "What leaves your CI" as three boxes joined by dashed arrows (what stays in your CI, what the upload sends as rows that open with details, what stateofpixel does with it), then outages and billing, the security and billing docs links and a "Talk to Vaibhav" card with a Book a call button, next to the other questions as rows that open, with Open all; "Start free. Pay when you pass 10 GB." with three checks and the workflow snippet on a `muted/80` band; the footer. The page follows the theme setting.

Docs (`/docs`): the public header and footer with a 208px nav on the left that scrolls with the page, grouped under `text-xs muted-foreground` labels with 32px `rounded-md` rows (`accent` fill and weight 500 for the current page), ending with a "For agents" group that links `llms.txt` and `llms-full.txt` in `mono`, and one article column of 680px. The title is 28 to 36px weight 600 with a `text-lg muted-foreground` lead under it; body is `text-base` on a 24px line, `text-lg` weight 600 section headings with a `#` link on hover, code in `CodeBlock`, inline code as `mono` on `muted` that wraps like text (tables keep it on one line), and tables with `text-2xs muted-foreground` headers and `border` rows. Previous and next cards close every page. Below 1024 the nav folds into a "Docs / Page" disclosure above the article. The quickstart opens with four setup cards in two columns (`card`, 1px `border`, 36px icon tile, `accent` fill) and a copyable coding agent prompt in a code block style box.

Compare (`/compare/{competitor}`): the public header and footer. Hero: our mark, "vs" in mono and the competitor logo at 32px with a "Compare / X" breadcrumb, for priced competitors a `text-display` H1 that leads with the yearly saving for the default suite in `approved` at clamp(56px, 7vw, 112px) and "a year less than X.", with the suite in `text-sm muted-foreground` under it (Lost Pixel keeps its own headline), lead copy, Start free with GitHub and "See the switch", and a `text-xs muted-foreground` line with the check date and a link to the sources; on the right a 480px card with the `HeroChecks` shadow, either the monthly bill for the default suite (ours in `approved` at 36px) or, for Lost Pixel, a status list under a "Shutting down" pill in `rejected`. Then: "One build, step by step", a numbered rail between their steps on `muted-foreground` and ours on `card` with counts for the default suite, a One build and One month switch, and a total row with their "Billed per" pill in `changed` and ours in `approved`; three numbered difference cards; the review page screenshot on the checkerboard; the cost calculator, range sliders on `muted` next to one bar per tool and a yearly savings line; the table as two tall columns, ours on `card` with a `border` ring and theirs on `muted-foreground`, starting with five key rows and a switch for the groups (Pricing, Screenshots, Platform) and All, a Show all button, superscript `link` numbers to the sources, and paired cards per row below 768px; "Where X is ahead" cards on `muted` with their logo; three switch steps above a Before and After pair of code blocks; the FAQ as `details` rows; the sources in three columns of `text-xs`; the display line on a `background` band with the other comparisons as logo rows. Competitor logos are the companies' GitHub avatars at 128px, shown with a 22% radius and a `border` ring. The index (`/compare`) has all five logos above the H1, one card per competitor (40px logo, name, one line, three facts, the default suite bill) and the calculator with every priced competitor.

Open Graph images: every public page and docs page gets a 1200x630 PNG at `/og/<path>.png`, rendered by `apps/web/scripts/ogImage.ts` with satori and resvg, at build time by `scripts/og-images.ts` and on request in dev, from the title and description in `src/lib/pageMeta.ts` and the docs meta. The card is `background` with the wordmark and the page path in Lilex `muted` at the top, the title at 72px weight 600 with -0.045em tracking and the description at 30px `muted` at the bottom, and the pricing pixel texture on the right at 50% opacity, unsmoothed. Both use `textWrap: balance`. The landing card shows the title only. Compare cards replace the path with "vs" and the competitor logo, and use the page headline as the title. `visual/og.visual.ts` captures every card on the desktop project, so the `web` build reviews them.

Sign-in (any signed-in page while signed out): centered 360px column, 32px logo, `text-xl` title, one `text-sm muted-foreground` line, and a full-width primary "Continue with GitHub" button, with a secondary "Continue with Google" button under it when Identity has Google enabled. While auth loads, the page shows a skeleton of the 48px app header only. Connect GitHub (signed in, no GitHub connection yet): the same column with a "Connect GitHub" title, one `text-sm muted-foreground` line and a full-width primary "Connect GitHub" button; an error shows under it on `failed-bg`.

## Accessibility

Contrast ratios, computed with the WCAG 2 relative luminance formula from the uiofcraft tokens:

| Pair | Light | Dark |
|---|---|---|
| `foreground` on `background` | 15.12 | 16.55 |
| `foreground` on `card` | 15.12 | 15.80 |
| `foreground` on `sidebar` | 14.48 | 17.26 |
| `muted-foreground` on `background` | 5.60 | 4.64 |
| `muted-foreground` on `card` | 5.60 | 4.43 |
| `muted-foreground` on `muted` | 5.13 | 4.21 |
| `primary-foreground` on `primary` | 14.48 | 13.86 |
| `link` on `card` | 5.26 | 6.54 |
| changed on its fill | 5.20 | 8.12 |
| added on its fill | 4.92 | 6.86 |
| removed on its fill | 6.93 | 6.00 |
| failed and rejected on fill | 4.85 | 5.95 |
| approved on its fill | 5.00 | 7.43 |

In dark mode `muted-foreground` is under AA (4.5) on `card` and `muted`. The values come from the uiofcraft theme. `border` (1.20:1) and `input` (1.25:1) are below 3:1, so a control never relies on its border alone: buttons and inputs also have a fill or a shadow.

Focus. uiofcraft components show a `ring` focus ring on `:focus-visible`. Other interactive elements show a 2px `ring` outline with 2px offset. Keyboard shortcuts never move focus away from where the user put it, except `/` which focuses the filter; `Escape` returns focus to the list.

Status never relies on color. Every pill and review icon has a distinct shape and a text label or an `aria-label` ("Header/Default [1280], changed, 0.84%, pending review"). The diff overlay has a text alternative in the title row (pixel count and percent). Flip mode says "Showing baseline" or "Showing new" in text.

Reduced motion. Under `prefers-reduced-motion: reduce` all transitions and animations are removed (the base layer in `styles.css`), skeleton shimmer stops, and toasts appear without the slide.

Other. Sidebar list is a `listbox` with `aria-activedescendant` so `j` and `k` announce the selected snapshot. Review results are announced through the toast live region.
