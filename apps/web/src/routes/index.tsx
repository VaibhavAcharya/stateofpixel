import { createFileRoute } from "@tanstack/react-router";
import { HeroChecks } from "../components/landing/HeroArt";
import { PricingPlans } from "../components/landing/Pricing";
import {
  DemoSection,
  FaqList,
  FinalWithSnippet,
  HeroDescriptive,
  HowFlow,
  HowSteps,
  PublicPage,
  StatusSection,
  WhatWeDont,
} from "../components/landing/sections";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        name: "description",
        content:
          "Visual regression testing that runs in your CI. Review pixel diffs, set GitHub checks, pay only for storage.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <PublicPage>
      <HeroDescriptive art={<HeroChecks />} />
      <DemoSection />
      <HowFlow />
      <HowSteps />
      <PricingPlans />
      <WhatWeDont />
      <FaqList />
      <StatusSection />
      <FinalWithSnippet />
    </PublicPage>
  );
}
