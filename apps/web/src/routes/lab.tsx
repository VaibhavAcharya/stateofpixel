import { createFileRoute } from "@tanstack/react-router";
import { Lab } from "../components/lab/Lab";

export const Route = createFileRoute("/lab")({
  head: () => ({
    meta: [
      { title: "Lab / stateofpixel" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Lab,
});
