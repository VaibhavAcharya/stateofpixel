import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import type { ReactNode } from "react";
import { SignInScreen } from "./SignIn";
import { Skeleton } from "./ui";

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
        <div className="flex h-12 items-center gap-3 border-b border-border bg-surface px-4">
          <Skeleton className="size-5 rounded-xs" />
          <Skeleton className="h-3 w-28 rounded-xs" />
          <Skeleton className="ml-auto size-6 rounded-full" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <SignInScreen redirectTo={redirectTo} />
      </Unauthenticated>
      <Authenticated>{children}</Authenticated>
    </>
  );
}
