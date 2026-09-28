import { describe, expect, it } from "vitest";
import { htmlToMarkdown, markdownPath } from "./llms";

const SITE_URL = "https://stateofpixel.com";

function convert(body: string) {
  return htmlToMarkdown(
    `<html><body><header>Menu</header><main>${body}</main></body></html>`,
    SITE_URL,
    new Map([["/docs/checks", "/docs/checks.md"]]),
  );
}

describe("markdownPath", () => {
  it("puts the home page at index.md", () => {
    expect(markdownPath("/")).toBe("/index.md");
    expect(markdownPath("/docs/cli")).toBe("/docs/cli.md");
  });
});

describe("htmlToMarkdown", () => {
  it("keeps only the article or main", async () => {
    expect(await convert("<p>Hello</p>")).toBe("Hello\n");
  });

  it("drops heading anchors and hidden parts", async () => {
    expect(
      await convert(
        '<h2 id="a"><a href="#a">Approve<span aria-hidden="true">#</span></a></h2><button>Copy</button>',
      ),
    ).toBe("## Approve\n");
  });

  it("points links to Markdown pages on the site", async () => {
    expect(
      await convert(
        '<p><a href="/docs/checks#states">check</a> and <a href="/privacy">privacy</a></p>',
      ),
    ).toBe(
      `[check](${SITE_URL}/docs/checks.md#states) and [privacy](${SITE_URL}/privacy)\n`,
    );
  });

  it("turns code blocks into fences with the file name", async () => {
    expect(
      await convert(
        "<figure><figcaption><span>ci.yml</span><button>Copy</button></figcaption><pre><code><span>on: push</span>\n<span>jobs: {}</span></code></pre></figure>",
      ),
    ).toBe("```yaml ci.yml\non: push\njobs: {}\n```\n");
  });

  it("separates keys and stacked labels", async () => {
    expect(
      await convert(
        '<p>Press <kbd>j</kbd><kbd>k</kbd></p><a href="/docs/checks"><span class="block">Checks</span><span class="block">What it means.</span></a>',
      ),
    ).toBe(
      `Press \`j\` \`k\`\n\n[Checks: What it means.](${SITE_URL}/docs/checks.md)\n`,
    );
  });
});
