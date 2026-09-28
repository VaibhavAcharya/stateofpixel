import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { codeToTokens } from "shiki";
import type { Plugin } from "vite";

const QUERY = "?highlight";

type Language = "yaml" | "shellscript" | "typescript" | "json";

const EXTENSIONS: Record<string, Language> = {
  ".yml": "yaml",
  ".json": "json",
  ".sh": "shellscript",
  ".ts": "typescript",
};

const FENCES: Record<string, Language> = {
  yaml: "yaml",
  json: "json",
  sh: "shellscript",
  ts: "typescript",
};

async function highlight(code: string, lang: Language) {
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
  return { code, lines };
}

export function highlightSnippets(): Plugin {
  return {
    name: "highlight-snippets",
    async load(id) {
      if (!id.endsWith(QUERY)) {
        return null;
      }
      const file = id.slice(0, -QUERY.length);
      const lang = EXTENSIONS[extname(file)];
      if (lang === undefined) {
        throw new Error(`No highlight language for ${file}`);
      }
      this.addWatchFile(file);
      const code = (await readFile(file, "utf8")).trimEnd();
      return `export default ${JSON.stringify(await highlight(code, lang))};`;
    },
  };
}

type MdNode = {
  type: string;
  lang?: string | null;
  meta?: string | null;
  value?: string;
  children?: MdNode[];
  [key: string]: unknown;
};

export function remarkCodeBlocks() {
  return async (tree: MdNode) => {
    const pending: Promise<void>[] = [];
    const visit = (node: MdNode) => {
      for (const [index, child] of (node.children ?? []).entries()) {
        if (child.type !== "code") {
          visit(child);
          continue;
        }
        const code = (child.value ?? "").trimEnd();
        const lang = child.lang ? FENCES[child.lang] : undefined;
        if (child.lang && child.lang !== "text" && lang === undefined) {
          throw new Error(`No highlight language for fence ${child.lang}`);
        }
        pending.push(
          (lang === undefined
            ? Promise.resolve({ code })
            : highlight(code, lang)
          ).then((snippet) => {
            node.children?.splice(index, 1, {
              type: "mdxJsxFlowElement",
              name: "CodeBlock",
              attributes: [
                {
                  type: "mdxJsxAttribute",
                  name: "fileName",
                  value: child.meta ?? "terminal",
                },
                {
                  type: "mdxJsxAttribute",
                  name: "snippet",
                  value: JSON.stringify(snippet),
                },
              ],
              children: [],
            });
          }),
        );
      }
    };
    visit(tree);
    await Promise.all(pending);
  };
}
