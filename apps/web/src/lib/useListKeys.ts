import { useEffect } from "react";

const LIST_ROW = "data-list-row";

export function useListKeys() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.key !== "j" && event.key !== "k") ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        (event.target as HTMLElement | null)?.closest(
          "input, textarea, select, [contenteditable]",
        )
      ) {
        return;
      }
      const rows = [
        ...document.querySelectorAll<HTMLElement>(`[${LIST_ROW}]`),
      ].filter((row) => row.offsetParent !== null);
      if (rows.length === 0) {
        return;
      }
      const index = rows.indexOf(document.activeElement as HTMLElement);
      const next =
        event.key === "j"
          ? Math.min(index + 1, rows.length - 1)
          : Math.max(index - 1, 0);
      rows[index === -1 ? 0 : next]?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
