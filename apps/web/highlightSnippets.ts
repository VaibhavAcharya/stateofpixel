import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { codeToTokens } from "shiki";
import type { Plugin } from "vite";

const QUERY = "?highlight";
const LANGUAGES: Record<
  string,
  "yaml" | "shellscript" | "typescript" | "json"
> = {
  ".yml": "yaml",
  ".json": "json",
  ".sh": "shellscript",
  ".ts": "typescript",
};

export function highlightSnippets(): Plugin {
  return {
    name: "highlight-snippets",
    async load(id) {
      if (!id.endsWith(QUERY)) {
        return null;
      }
      const file = id.slice(0, -QUERY.length);
      const lang = LANGUAGES[extname(file)];
      if (lang === undefined) {
        throw new Error(`No highlight language for ${file}`);
      }
      this.addWatchFile(file);
      const code = (await readFile(file, "utf8")).trimEnd();
      const { tokens } = await codeToTokens(code, {
        lang,
        themes: { light: "github-light-default", dark: "github-dark-default" },
        defaultColor: false,
      });
      const lines = tokens.map((line) =>
        line.map(({ content, offset, htmlStyle }) => ({
          content,
          offset,
          style: htmlStyle,
        })),
      );
      return `export default ${JSON.stringify({ code, lines })};`;
    },
  };
}
