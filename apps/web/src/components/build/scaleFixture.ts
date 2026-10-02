import type { FixtureSnapshot } from "./fixtureBuild";

const BROWSERS = ["chromium", "firefox", "webkit"];
const WIDTHS = [375, 768, 1280];

const BUTTON_STORIES = [
  "Account/Billing",
  "Account/Profile",
  "Account/Security",
  "Auth/Sign in",
  "Auth/Sign up",
  "Auth/Reset password",
  "Billing/Invoices",
  "Billing/Plans",
  "Billing/Upgrade dialog",
  "Button/Danger",
  "Button/Ghost",
  "Button/Primary",
  "Button/Secondary",
  "Button/With icon",
  "Checkout/Cart",
  "Checkout/Empty",
  "Checkout/Payment",
  "Checkout/Review",
  "Dashboard/Overview",
  "Dashboard/Empty",
  "Dialog/Confirm",
  "Dialog/Delete project",
  "Form/Contact",
  "Form/Errors",
  "Onboarding/Step 1",
  "Onboarding/Step 2",
  "Onboarding/Step 3",
  "Pricing/Plans",
  "Pricing/Yearly",
  "Settings/General",
  "Settings/Members",
  "Settings/Notifications",
  "Settings/Tokens",
  "Toast/Error",
  "Toast/Success",
];

const HEADER_STORIES = [
  "Header/Default",
  "Header/Signed in",
  "Header/With banner",
  "Marketing/About",
  "Marketing/Blog",
  "Marketing/Careers",
  "Marketing/Home",
  "Marketing/Pricing",
];

const ADDED_STORIES = [
  "Invoices/Empty",
  "Invoices/List",
  "Invoices/Overdue",
  "Invoices/Paid",
];

const REMOVED_STORIES = ["Settings/Legacy", "Billing/Old plans"];

function variants(story: string) {
  return BROWSERS.flatMap((browser) =>
    WIDTHS.map((width) => ({
      name: `${story} [${browser} ${width}]`,
      browser,
      width,
    })),
  );
}

function slug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function changedSnapshot(
  name: string,
  browser: string,
  demo: string,
  diffPixels: number,
): FixtureSnapshot {
  return {
    id: slug(name),
    name,
    browser,
    diffStatus: "changed",
    reviewState: "pending",
    diffPixels,
    image: `/demo/${demo}-new.png`,
    baselineImage: `/demo/${demo}-base.png`,
    diffImage: `/demo/${demo}-diff.png`,
  };
}

const SNAPSHOTS: FixtureSnapshot[] = [
  ...BUTTON_STORIES.flatMap((story, index) =>
    variants(story).map(({ name, browser, width }) =>
      changedSnapshot(
        name,
        browser,
        "buttons",
        900 + ((index * 37 + width) % 700),
      ),
    ),
  ),
  ...HEADER_STORIES.flatMap((story) =>
    variants(story).map(({ name, browser, width }) =>
      changedSnapshot(name, browser, "header", 400 + width / 4),
    ),
  ),
  changedSnapshot("Auth/Sign in error [webkit 375]", "webkit", "signin", 3393),
  ...WIDTHS.map((width) =>
    changedSnapshot(
      `Pricing/Enterprise [firefox ${width}]`,
      "firefox",
      "pricing",
      2100 + width,
    ),
  ),
  ...ADDED_STORIES.flatMap((story) =>
    variants(story).map(({ name, browser }) => ({
      id: slug(name),
      name,
      browser,
      diffStatus: "added" as const,
      reviewState: "pending" as const,
      image: "/demo/invoices-new.png",
      baselineImage: null,
      diffImage: null,
    })),
  ),
  ...REMOVED_STORIES.flatMap((story) =>
    variants(story).map(({ name, browser }) => ({
      id: slug(name),
      name,
      browser,
      diffStatus: "removed" as const,
      reviewState: "none" as const,
      image: null,
      baselineImage: "/demo/header-base.png",
      diffImage: null,
    })),
  ),
  ...["Footer/Default", "Navigation/Mobile", "Table/Sortable", "Avatar/Group"]
    .flatMap(variants)
    .map(({ name, browser }) => ({
      id: slug(name),
      name,
      browser,
      diffStatus: "unchanged" as const,
      reviewState: "none" as const,
      image: "/demo/header-base.png",
      baselineImage: "/demo/header-base.png",
      diffImage: null,
    })),
];

export const SCALE_SNAPSHOTS = SNAPSHOTS.sort((a, b) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
);
