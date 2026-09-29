import { createFileRoute, redirect } from "@tanstack/react-router";
import { CHANGELOG_URL } from "../components/landing/sections";

export const Route = createFileRoute("/changelog")({
  beforeLoad: () => {
    throw redirect({ href: CHANGELOG_URL });
  },
});
