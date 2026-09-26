import { createFileRoute, notFound } from "@tanstack/react-router";
import { ComparePage, faqJsonLd } from "../../components/compare/ComparePage";
import { findCompetitor } from "../../content/compare";
import { pageLinks, pageMeta } from "../../lib/pageMeta";

export const Route = createFileRoute("/compare/$slug")({
  loader: ({ params }) => {
    const competitor = findCompetitor(params.slug);
    if (competitor === undefined) {
      throw notFound();
    }
    return competitor;
  },
  head: ({ loaderData }) =>
    loaderData === undefined
      ? {}
      : {
          meta: [
            { title: loaderData.meta.title },
            ...pageMeta(loaderData.meta),
          ],
          links: pageLinks(loaderData.meta),
          scripts: [
            { type: "application/ld+json", children: faqJsonLd(loaderData) },
          ],
        },
  component: CompareRoute,
});

function CompareRoute() {
  return <ComparePage competitor={Route.useLoaderData()} />;
}
