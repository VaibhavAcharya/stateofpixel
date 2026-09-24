import { expect, it } from "vitest";
import { renderReport } from "./template";

it("escapes snapshot data so a name cannot close the script tag", () => {
  const html = renderReport(
    [{ name: "</script><script>alert(1)</script>", status: "added" }],
    {
      dir: "new",
      baselineDir: "baseline",
      engine: "odiff",
      createdAt: "2026-09-24T00:00:00.000Z",
    },
  );

  expect(html).not.toContain("</script><script>alert(1)");
  expect(html).toContain("\\u003c/script>\\u003cscript>alert(1)");
});
