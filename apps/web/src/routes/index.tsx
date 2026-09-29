import { createFileRoute } from "@tanstack/react-router";
import {
  CostSection,
  PerThousandSection,
  SpeedSection,
} from "../components/landing/Numbers";
import { PricingPlans, TIERS } from "../components/landing/Pricing";
import {
  FAQ,
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
import { PAGES, pageLinks, pageMeta, SITE_URL } from "../lib/pageMeta";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "stateofpixel / Catch UI regressions before they merge",
      },
      ...pageMeta(PAGES.home),
      { name: "msvalidate.01", content: "B06E4B9FFFB847FDE53F521A284FD8FC" },
    ],
    links: pageLinks(PAGES.home),
    scripts: [
      { type: "application/ld+json", children: faqJsonLd() },
      { type: "application/ld+json", children: softwareJsonLd() },
    ],
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

function faqJsonLd() {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  });
}

function softwareJsonLd() {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "stateofpixel",
    applicationCategory: "DeveloperApplication",
    description: PAGES.home.description,
    url: SITE_URL,
    offers: TIERS.map((tier) => ({
      "@type": "Offer",
      name: tier.monthly === 0 ? "Free" : `${tier.gigabytes} GB`,
      price: tier.monthly,
      priceCurrency: "USD",
    })),
  });
}
