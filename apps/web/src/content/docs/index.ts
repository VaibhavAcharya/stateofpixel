import type { MDXContent } from "mdx/types";

export type DocMeta = { title: string; description: string; lead: string };

type DocModule = { default: MDXContent; meta: DocMeta };

const modules = import.meta.glob<DocModule>("./*.mdx", { eager: true });

export function findDoc(slug: string): DocModule | undefined {
  return modules[`./${slug}.mdx`];
}
