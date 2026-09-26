import { createFileRoute } from "@tanstack/react-router";
import { QUICKSTART } from "../../components/docs/DocsLayout";
import { DocsArticle, docsHead } from "../../components/docs/mdx";

export const Route = createFileRoute("/docs/")({
  head: () => docsHead(QUICKSTART),
  component: () => <DocsArticle slug={QUICKSTART} />,
});
