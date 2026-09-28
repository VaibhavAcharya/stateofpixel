import { createFileRoute, notFound } from "@tanstack/react-router";
import { QUICKSTART } from "../../components/docs/DocsLayout";
import { DocsArticle, docsHead } from "../../components/docs/mdx";
import { findDoc } from "../../content/docs";

export const Route = createFileRoute("/docs/$slug")({
  loader: ({ params }) => {
    if (params.slug === QUICKSTART || findDoc(params.slug) === undefined) {
      throw notFound();
    }
  },
  head: ({ params }) => docsHead(params.slug),
  component: DocRoute,
});

function DocRoute() {
  const { slug } = Route.useParams();
  return <DocsArticle slug={slug} />;
}
