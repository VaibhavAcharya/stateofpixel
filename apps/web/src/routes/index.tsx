import { createFileRoute } from "@tanstack/react-router";
import { HeroChecks } from "../components/landing/HeroArt";
import { CostSection, SpeedSection } from "../components/landing/Numbers";
import { PricingPlans } from "../components/landing/Pricing";
import {
  DemoSection,
  FaqList,
  FinalWithSnippet,
  HeroDescriptive,
  HowSteps,
  PipelinesSection,
  PublicPage,
  TeamSection,
  WhatWeDont,
} from "../components/landing/sections";
import { PAGES, pageMeta } from "../lib/pageMeta";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Visual regression testing that runs in your CI / stateofpixel",
      },
      ...pageMeta(PAGES.home),
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <PublicPage>
      <HeroDescriptive art={<HeroChecks />} />
      <DemoSection />
      <HowSteps />
      <SpeedSection />
      <TeamSection />
      <PipelinesSection />
      <PricingPlans />
      <CostSection />
      <WhatWeDont />
      <FaqList />
      <FinalWithSnippet />
    </PublicPage>
  );
}
