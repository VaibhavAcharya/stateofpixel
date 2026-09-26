import { createFileRoute } from "@tanstack/react-router";
import { DocsLayout } from "../components/docs/DocsLayout";

export const Route = createFileRoute("/docs")({
  component: DocsLayout,
});
