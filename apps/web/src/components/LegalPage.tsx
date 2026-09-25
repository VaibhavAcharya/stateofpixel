import type { ReactNode } from "react";
import { SUPPORT_EMAIL } from "../lib/supportEmail";
import { PublicPage } from "./landing/sections";

export function SupportEmail() {
  return <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;
}

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <PublicPage>
      <article className="mx-auto max-w-[720px] px-6 pt-24 pb-24 max-sm:px-4 max-sm:pt-12">
        <h1 className="text-[clamp(32px,4vw,48px)] leading-[1.1] font-semibold tracking-[-0.045em]">
          {title}
        </h1>
        <p className="mt-4 text-sm text-muted">Last updated {updated}</p>
        <div className="mt-10 text-base [&_a]:text-link [&_a]:hover:underline [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </article>
    </PublicPage>
  );
}
