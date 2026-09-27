type EventData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: { track: (event: string, data?: EventData) => void };
  }
}

export function track(event: string, data?: EventData) {
  window.umami?.track(event, data);
}

export const UMAMI_BEFORE_SEND_SCRIPT = `window.umamiBeforeSend = (type, payload) => {
  const publicPaths = ["/", "/brand", "/privacy", "/terms", "/refunds", "/install"];
  const publicSections = ["/compare", "/docs"];
  const isPublic = (path) =>
    publicPaths.includes(path) ||
    publicSections.some((section) => path === section || path.startsWith(section + "/"));
  const maskPath = (path) => {
    const [, repo, section, ...rest] = path.split("/").slice(1);
    const parts = [":owner"];
    if (repo) parts.push(":repo");
    if (section) parts.push(section);
    if (section === "baselines" && rest.length > 0) parts.push(":name");
    else rest.forEach((part, index) => parts.push(index % 2 === 0 ? ":id" : part));
    return "/" + parts.join("/");
  };
  const mask = (value) => {
    if (!value) return { value, masked: false };
    const url = new URL(value, location.origin);
    if (url.origin !== location.origin || isPublic(url.pathname)) {
      return { value, masked: false };
    }
    const path = maskPath(url.pathname);
    return { value: value.startsWith("/") ? path : url.origin + path, masked: true };
  };
  const url = mask(payload.url);
  payload.url = url.value;
  payload.referrer = mask(payload.referrer).value;
  if (url.masked && payload.title) payload.title = "stateofpixel";
  return payload;
};`;
