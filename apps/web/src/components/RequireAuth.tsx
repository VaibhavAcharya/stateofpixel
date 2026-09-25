import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import type { ReactNode } from "react";
import { SignIn } from "./SignIn";
import { LeadCopy, SkeletonRows } from "./ui";

export function RequireAuth({
  redirectTo,
  children,
}: {
  redirectTo: string;
  children: ReactNode;
}) {
  return (
    <>
      <AuthLoading>
        <main className="mx-auto max-w-[1200px] px-6 pt-6">
          <SkeletonRows />
        </main>
      </AuthLoading>
      <Unauthenticated>
        <main className="mx-auto max-w-[1200px] px-6 pt-6">
          <LeadCopy title="Sign in to continue.">
            Access comes from your GitHub permissions on the repository.
          </LeadCopy>
          <SignIn redirectTo={redirectTo} />
        </main>
      </Unauthenticated>
      <Authenticated>{children}</Authenticated>
    </>
  );
}
