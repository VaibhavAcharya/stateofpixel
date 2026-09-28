import type { SnapshotResult } from "../compare";
import type { ReportMeta } from "./write-report";

export function renderReport(
  snapshots: SnapshotResult[],
  meta: ReportMeta,
): string {
  const data = JSON.stringify({ meta, snapshots }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>stateofpixel report</title>
<style>${STYLES}</style>
</head>
<body>
<header class="header">
  <div class="title"><strong>stateofpixel</strong> <span class="muted mono" id="dirs"></span></div>
  <div class="counts" id="counts"></div>
</header>
<div class="layout">
  <aside class="sidebar">
    <input class="filter" id="filter" type="search" placeholder="Filter snapshots" aria-label="Filter snapshots">
    <div id="list" role="listbox" aria-label="Snapshots"></div>
  </aside>
  <main class="viewer" id="viewer"></main>
</div>
<script id="data" type="application/json">${data}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

const STYLES = `
:root {
  color-scheme: light dark;
  --bg: #fafafa; --surface: #ffffff; --surface-2: #f2f2f2; --hover: #ebebeb; --border: #ebebeb;
  --text: #171717; --muted: #666666; --accent: #171717; --accent-fg: #ffffff; --link: #0068d6;
  --unchanged: #666666; --unchanged-bg: #f2f2f2; --changed: #a35200; --changed-bg: #fff6e6;
  --added: #0068d6; --added-bg: #f0f7ff; --removed: #7820bc; --removed-bg: #f9f0ff;
  --canvas: #f2f2f2; --checker-a: #ffffff; --checker-b: #e6e6e6;
  --sans: "IBM Plex Sans Variable", "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
  --mono: "Lilex Variable", "Lilex", ui-monospace, "SF Mono", monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #000000; --surface: #0a0a0a; --surface-2: #1a1a1a; --hover: #1f1f1f; --border: #2e2e2e;
    --text: #ededed; --muted: #a1a1a1; --accent: #ededed; --accent-fg: #0a0a0a; --link: #52a8ff;
    --unchanged: #a1a1a1; --unchanged-bg: #1a1a1a; --changed: #f2a20d; --changed-bg: #291800;
    --added: #52a8ff; --added-bg: #0f1c2e; --removed: #bf7af0; --removed-bg: #231528;
    --canvas: #000000; --checker-a: #1a1a1a; --checker-b: #292929;
  }
}
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body { display: flex; flex-direction: column; background: var(--bg); color: var(--text); font: 400 13px/20px var(--sans); -webkit-font-smoothing: antialiased; }
:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
.muted { color: var(--muted); }
.mono { font-family: var(--mono); }
.num { font-variant-numeric: tabular-nums; }
.header { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--surface); border-bottom: 1px solid var(--border); }
.title strong { font-size: 14px; font-weight: 600; }
.counts { display: flex; flex-wrap: wrap; gap: 6px; }
.pill { display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 6px; border-radius: 5px; font-size: 11px; font-weight: 500; font-variant-numeric: tabular-nums; white-space: nowrap; }
.pill[data-status=unchanged] { color: var(--unchanged); background: var(--unchanged-bg); }
.pill[data-status=changed] { color: var(--changed); background: var(--changed-bg); }
.pill[data-status=added] { color: var(--added); background: var(--added-bg); }
.pill[data-status=removed] { color: var(--removed); background: var(--removed-bg); }
.layout { flex: 1; display: flex; min-height: 0; }
.sidebar { width: 300px; flex-shrink: 0; display: flex; flex-direction: column; background: var(--surface); border-right: 1px solid var(--border); }
.filter { margin: 8px; height: 28px; padding: 0 10px; border: 0; border-radius: 8px; background: var(--surface); color: var(--text); font: inherit; box-shadow: inset 0 0 0 1px #8f8f8f; }
#list { flex: 1; overflow-y: auto; padding: 0 8px 8px; }
.group { display: flex; align-items: center; gap: 6px; width: 100%; height: 28px; padding: 0 8px; border: 0; background: none; color: var(--muted); font: 500 12px/16px var(--sans); cursor: pointer; text-align: left; }
.row { display: flex; align-items: center; gap: 8px; width: 100%; height: 32px; padding: 0 8px; border: 0; border-radius: 7px; background: none; color: var(--text); font: 13px/20px var(--mono); text-align: left; cursor: pointer; position: relative; }
.row:hover { background: var(--hover); }
.row[aria-selected=true] { background: var(--hover); }
.row[aria-selected=true]::before { content: ""; position: absolute; left: 0; top: 6px; bottom: 6px; width: 2px; border-radius: 2px; background: var(--link); }
.row .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row .ratio { color: var(--muted); font: 12px/16px var(--sans); font-variant-numeric: tabular-nums; }
.viewer { flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--surface); }
.viewer-title { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; min-height: 48px; padding: 8px 16px; border-bottom: 1px solid var(--border); }
.viewer-title .name { font: 500 14px/20px var(--mono); }
.viewer-title .dims { margin-left: auto; }
.toolbar { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; padding: 6px 16px; border-bottom: 1px solid var(--border); }
.segmented { display: inline-flex; padding: 2px; border-radius: 11px; background: var(--surface-2); }
.segmented button { height: 28px; padding: 0 10px; border: 1px solid transparent; border-radius: 7px; background: none; color: var(--muted); font: 500 13px/20px var(--sans); cursor: pointer; }
.segmented button[aria-pressed=true] { background: var(--surface); color: var(--text); border-color: var(--border); }
.segmented button:disabled { opacity: .45; cursor: default; }
kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 16px; height: 16px; margin-left: 6px; padding: 0 4px; border: 1px solid var(--border); border-radius: 5px; background: var(--surface); color: var(--muted); font: 500 11px/16px var(--mono); }
.stage { flex: 1; overflow: auto; padding: 16px; background: var(--canvas); }
.pair { display: flex; gap: 16px; align-items: flex-start; }
.pair > figure { flex: 1; min-width: 0; }
figure { margin: 0; }
figcaption { height: 24px; color: var(--muted); font-size: 12px; }
.frame { position: relative; background-color: var(--checker-a); background-image: conic-gradient(var(--checker-b) 25%, transparent 0 50%, var(--checker-b) 0 75%, transparent 0); background-size: 16px 16px; }
.frame img { position: absolute; top: 0; left: 0; display: block; }
.zoom-actual .frame img { image-rendering: pixelated; }
.frame[data-flip=baseline] { outline: 1px solid var(--link); }
.diff-layer { opacity: .7; }
.slider { display: block; width: 100%; margin: 12px 0 0; accent-color: var(--link); }
.handle { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--link); pointer-events: none; }
.empty { padding: 24px; color: var(--muted); font-size: 24px; line-height: 34px; }
.empty strong { color: var(--text); font-weight: 600; }
@media (max-width: 767px) {
  .layout { flex-direction: column; }
  .sidebar { width: auto; max-height: 40vh; border-right: 0; border-bottom: 1px solid var(--border); }
  .pair { flex-direction: column; }
  .pair > figure { width: 100%; }
}
`;

const SCRIPT = `
const { meta, snapshots } = JSON.parse(document.getElementById("data").textContent);
const GROUPS = ["changed", "added", "removed", "unchanged"];
const MODES = [["side", "Side by side"], ["diff", "Diff"], ["slider", "Slider"], ["flip", "Flip"]];
const store = {
  get(key, fallback) { try { return localStorage.getItem("stateofpixel:" + key) || fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem("stateofpixel:" + key, value); } catch {} },
};
const state = {
  filter: "",
  collapsed: new Set(["unchanged"]),
  selected: null,
  mode: store.get("mode", "side"),
  zoom: store.get("zoom", "fit"),
  flip: "new",
  slider: 50,
};

function el(tag, props, children) {
  const node = document.createElement(tag);
  Object.assign(node, props || {});
  for (const child of children || []) node.append(child);
  return node;
}

function pill(status, label) {
  const node = el("span", { className: "pill", textContent: label });
  node.dataset.status = status;
  return node;
}

function percent(ratio) {
  return (ratio * 100).toFixed(ratio < 0.001 ? 3 : 2) + "%";
}

function visibleGroups() {
  const query = state.filter.toLowerCase();
  return GROUPS.map((status) => ({
    status,
    items: snapshots.filter((s) => s.status === status && s.name.toLowerCase().includes(query)),
  })).filter((group) => group.items.length > 0);
}

function navigable() {
  return visibleGroups().flatMap((group) => (state.collapsed.has(group.status) ? [] : group.items));
}

function renderHeader() {
  document.getElementById("dirs").textContent = meta.dir + " vs " + meta.baselineDir;
  const counts = document.getElementById("counts");
  counts.replaceChildren(
    ...GROUPS.map((status) => {
      const count = snapshots.filter((s) => s.status === status).length;
      return pill(status, count.toLocaleString() + " " + status);
    }),
  );
}

function renderList() {
  const list = document.getElementById("list");
  list.replaceChildren(
    ...visibleGroups().flatMap((group) => {
      const collapsed = state.collapsed.has(group.status);
      const header = el("button", {
        className: "group",
        textContent: (collapsed ? "+ " : "- ") + group.status[0].toUpperCase() + group.status.slice(1) + " (" + group.items.length.toLocaleString() + ")",
        onclick: () => {
          if (collapsed) state.collapsed.delete(group.status);
          else state.collapsed.add(group.status);
          renderList();
        },
      });
      header.setAttribute("aria-expanded", String(!collapsed));
      if (collapsed) return [header];
      return [
        header,
        ...group.items.map((snapshot) => {
          const row = el("button", { className: "row", title: snapshot.name, onclick: () => select(snapshot) }, [
            el("span", { className: "name", textContent: snapshot.name }),
          ]);
          row.setAttribute("role", "option");
          row.setAttribute("aria-selected", String(snapshot === state.selected));
          if (snapshot.diffRatio !== undefined) row.append(el("span", { className: "ratio", textContent: percent(snapshot.diffRatio) }));
          return row;
        }),
      ];
    }),
  );
  list.querySelector("[aria-selected=true]")?.scrollIntoView({ block: "nearest" });
}

function frame(images, width, height) {
  const node = el("div", { className: "frame" });
  if (state.zoom === "fit") {
    node.style.width = "100%";
    node.style.maxWidth = width + "px";
    node.style.aspectRatio = width + " / " + height;
  } else {
    node.style.width = width + "px";
    node.style.height = height + "px";
  }
  for (const { image, className, style } of images) {
    const img = el("img", { src: image.file, alt: "", className: className || "" });
    img.style.width = (image.width / width) * 100 + "%";
    Object.assign(img.style, style || {});
    node.append(img);
  }
  return node;
}

function figure(caption, image) {
  return el("figure", {}, [el("figcaption", { textContent: caption }), frame([{ image }], image.width, image.height)]);
}

function renderStage(snapshot) {
  const { image, baselineImage, diffImage } = snapshot;
  if (!image || !baselineImage) {
    const only = image || baselineImage;
    return [figure(image ? "New" : "Baseline", only)];
  }
  const width = Math.max(image.width, baselineImage.width);
  const height = Math.max(image.height, baselineImage.height);
  if (state.mode === "side") {
    return [el("div", { className: "pair" }, [figure("Baseline", baselineImage), figure("New", image)])];
  }
  if (state.mode === "diff") {
    const layers = [{ image }];
    if (diffImage) layers.push({ image: diffImage, className: "diff-layer" });
    return [el("figure", {}, [el("figcaption", { textContent: "New with diff overlay" }), frame(layers, width, height)])];
  }
  if (state.mode === "slider") {
    const clipFor = (value) => "inset(0 " + (100 - value) + "% 0 0)";
    const stageNode = frame([{ image }, { image: baselineImage, style: { clipPath: clipFor(state.slider) } }], width, height);
    const handle = el("div", { className: "handle" });
    handle.style.left = state.slider + "%";
    stageNode.append(handle);
    const slider = el("input", {
      className: "slider",
      type: "range",
      min: 0,
      max: 100,
      value: state.slider,
      oninput: (event) => {
        state.slider = Number(event.target.value);
        stageNode.querySelectorAll("img")[1].style.clipPath = clipFor(state.slider);
        handle.style.left = state.slider + "%";
      },
    });
    slider.setAttribute("aria-label", "Baseline to new");
    const node = el("figure", {}, [el("figcaption", { textContent: "Baseline on the left of the handle, new on the right" }), stageNode, slider]);
    node.style[state.zoom === "fit" ? "maxWidth" : "width"] = width + "px";
    return [node];
  }
  const showing = state.flip === "baseline" ? baselineImage : image;
  const node = frame([{ image: showing }], width, height);
  node.dataset.flip = state.flip;
  return [el("figure", {}, [el("figcaption", { textContent: "Showing " + state.flip + ". Press space to flip." }), node])];
}

function renderViewer() {
  const viewer = document.getElementById("viewer");
  const snapshot = state.selected;
  if (!snapshot) {
    const empty = el("p", { className: "empty" }, [el("strong", { textContent: "No visual changes." }), " Every snapshot matches its baseline."]);
    viewer.replaceChildren(empty);
    return;
  }
  const comparable = Boolean(snapshot.image && snapshot.baselineImage);
  const title = el("div", { className: "viewer-title" }, [
    el("span", { className: "name", textContent: snapshot.name }),
    pill(snapshot.status, snapshot.status),
  ]);
  if (snapshot.diffPixels !== undefined) {
    title.append(el("span", { className: "muted num", textContent: percent(snapshot.diffRatio) + " diff, " + snapshot.diffPixels.toLocaleString() + " px" }));
  }
  const dims = [snapshot.baselineImage, snapshot.image].filter(Boolean).map((i) => i.width + "x" + i.height);
  title.append(el("span", { className: "dims muted num", textContent: [...new Set(dims)].join(" to ") }));

  const modes = el("div", { className: "segmented" }, MODES.map(([mode, label], index) => {
    const button = el("button", { disabled: !comparable, onclick: () => setMode(mode) }, [label, el("kbd", { textContent: String(index + 1) })]);
    button.setAttribute("aria-pressed", String(comparable && state.mode === mode));
    return button;
  }));
  const zoom = el("div", { className: "segmented" }, [["fit", "Fit", "f"], ["actual", "100%", "0"]].map(([value, label, key]) => {
    const button = el("button", { onclick: () => setZoom(value) }, [label, el("kbd", { textContent: key })]);
    button.setAttribute("aria-pressed", String(state.zoom === value));
    return button;
  }));
  const stage = el("div", { className: "stage zoom-" + state.zoom }, renderStage(snapshot));
  viewer.replaceChildren(title, el("div", { className: "toolbar" }, [modes, zoom]), stage);
}

function select(snapshot) {
  state.selected = snapshot;
  state.flip = "new";
  renderList();
  renderViewer();
}

function setMode(mode) {
  state.mode = mode;
  store.set("mode", mode);
  renderViewer();
}

function setZoom(zoom) {
  state.zoom = zoom;
  store.set("zoom", zoom);
  renderViewer();
}

function move(step) {
  const items = navigable();
  if (items.length === 0) return;
  const index = items.indexOf(state.selected);
  const next = index === -1 ? 0 : Math.min(items.length - 1, Math.max(0, index + step));
  select(items[next]);
}

const filter = document.getElementById("filter");
filter.addEventListener("input", () => {
  state.filter = filter.value;
  renderList();
});

document.addEventListener("keydown", (event) => {
  if (event.target === filter) {
    if (event.key === "Escape") filter.blur();
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const modeIndex = ["1", "2", "3", "4"].indexOf(event.key);
  if (event.key === "j") move(1);
  else if (event.key === "k") move(-1);
  else if (modeIndex !== -1) setMode(MODES[modeIndex][0]);
  else if (event.key === "f") setZoom("fit");
  else if (event.key === "0") setZoom("actual");
  else if (event.key === "/") { event.preventDefault(); filter.focus(); }
  else if (event.key === " " && state.mode === "flip") {
    event.preventDefault();
    state.flip = state.flip === "new" ? "baseline" : "new";
    renderViewer();
  }
});

renderHeader();
const first = navigable().find((s) => s.status !== "unchanged");
if (first) select(first);
else { renderList(); renderViewer(); }
`;
