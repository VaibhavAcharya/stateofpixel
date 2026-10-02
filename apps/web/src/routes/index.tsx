import { createFileRoute } from "@tanstack/react-router";
import { CostCalculator } from "../components/compare/CostCalculator";
import { SpeedSection } from "../components/landing/Numbers";
import { PipelinesSection } from "../components/landing/Pipelines";
import { PricingPlans, TIERS } from "../components/landing/Pricing";
import {
  FinalStartFree,
  HeroCentered,
  HowSteps,
  PublicPage,
  REPO_URL,
  SwitchStrip,
  TeamSection,
} from "../components/landing/sections";
import { QUESTIONS, TrustSection } from "../components/landing/Trust";
import { PAGES, pageLinks, pageMeta, SITE_URL } from "../lib/pageMeta";
import { SUPPORT_EMAIL } from "../lib/supportEmail";

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
      { type: "application/ld+json", children: organizationJsonLd() },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <PublicPage>
      <HeroCentered />
      <HowSteps />
      <SpeedSection />
      <TeamSection />
      <PipelinesSection />
      <PricingPlans />
      <CostCalculator competitors={["argos", "chromatic", "percy"]} />
      <TrustSection />
      <SwitchStrip />
      <FinalStartFree />
    </PublicPage>
  );
}

function faqJsonLd() {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: QUESTIONS.map(([question, answer]) => ({
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

function organizationJsonLd() {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "stateofpixel",
    url: SITE_URL,
    logo: `${SITE_URL}/brand/stateofpixel-mark.png`,
    email: SUPPORT_EMAIL,
    sameAs: [REPO_URL, "https://www.npmjs.com/package/stateofpixel"],
  });
}
