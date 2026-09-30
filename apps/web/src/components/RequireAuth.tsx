import { type ReactNode, useEffect, useState } from "react";
import {
  Authenticated,
  AuthLoading,
  isAuthCallback,
  Unauthenticated,
} from "../lib/auth";
import { api, useQuery } from "../lib/backend";
import { ConnectGithubScreen, SignInScreen, SigningIn } from "./SignIn";
import { Skeleton } from "./ui";

function useReturningFromSignIn() {
  const [returning, setReturning] = useState(false);
  useEffect(() => {
    setReturning(isAuthCallback());
  }, []);
  return returning;
}

function HeaderSkeleton() {
  return (
    <div className="flex h-12 items-center gap-3 border-b border-border bg-surface px-4">
      <Skeleton className="size-5 rounded-xs" />
      <Skeleton className="h-3 w-28 rounded-xs" />
      <Skeleton className="ml-auto size-6 rounded-full" />
    </div>
  );
}

function RequireGithub({
  redirectTo,
  children,
}: {
  redirectTo: string;
  children: ReactNode;
}) {
  const viewer = useQuery(api.users.viewer);
  if (viewer === undefined) {
    return <HeaderSkeleton />;
  }
  if (viewer === null) {
    return <SignInScreen redirectTo={redirectTo} />;
  }
  if (viewer.login === null) {
    return <ConnectGithubScreen redirectTo={redirectTo} />;
  }
  return children;
}

export function RequireAuth({
  redirectTo,
  children,
}: {
  redirectTo: string;
  children: ReactNode;
}) {
  const returning = useReturningFromSignIn();
  return (
    <>
      <AuthLoading>
        {returning ? <SigningIn /> : <HeaderSkeleton />}
      </AuthLoading>
      <Unauthenticated>
        <SignInScreen redirectTo={redirectTo} />
      </Unauthenticated>
      <Authenticated>
        <RequireGithub redirectTo={redirectTo}>{children}</RequireGithub>
      </Authenticated>
    </>
  );
}
