import { createFileRoute } from "@tanstack/react-router";
import {
  CostSection,
  PerThousandSection,
  SpeedSection,
} from "../components/landing/Numbers";
import { PricingPlans } from "../components/landing/Pricing";
import {
  FaqList,
  FinalStartFree,
  HeroCentered,
  HowSteps,
  PipelinesSection,
  PromisesSection,
  PublicPage,
  SwitchStrip,
  TeamSection,
} from "../components/landing/sections";
import { PAGES, pageLinks, pageMeta } from "../lib/pageMeta";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "stateofpixel / Catch UI regressions before they merge",
      },
      ...pageMeta(PAGES.home),
    ],
    links: pageLinks(PAGES.home),
  }),
  component: Home,
});

function Home() {
  return (
    <PublicPage>
      <HeroCentered />
      <PerThousandSection />
      <HowSteps />
      <SpeedSection />
      <TeamSection />
      <PipelinesSection />
      <PricingPlans />
      <CostSection />
      <PromisesSection />
      <SwitchStrip />
      <FaqList />
      <FinalStartFree />
    </PublicPage>
  );
}
