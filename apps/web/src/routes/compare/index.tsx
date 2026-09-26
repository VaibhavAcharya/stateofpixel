import { createFileRoute } from "@tanstack/react-router";
import { CompareIndex } from "../../components/compare/CompareIndex";
import { COMPARE_PAGE } from "../../content/compare";
import { pageLinks, pageMeta } from "../../lib/pageMeta";

export const Route = createFileRoute("/compare/")({
  head: () => ({
    meta: [{ title: "Compare / stateofpixel" }, ...pageMeta(COMPARE_PAGE)],
    links: pageLinks(COMPARE_PAGE),
  }),
  component: CompareIndex,
});
