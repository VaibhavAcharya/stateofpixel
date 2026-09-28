import { useAuthActions } from "@convex-dev/auth/react";
import { GithubLogoIcon } from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { useEffect, useState } from "react";
import { buttonClass, Logo, Spinner } from "./ui";

export function SignInButton({
  redirectTo = "/install",
  label = "Sign in with GitHub",
  variant = "primary",
  className = "",
}: {
  redirectTo?: string;
  label?: string;
  variant?: "primary" | "ghost";
  className?: string;
}) {
  const { signIn } = useAuthActions();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setPending(false);
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return (
    <button
      type="button"
      aria-busy={pending}
      disabled={pending}
      className={`${buttonClass(variant)} disabled:opacity-100 ${className}`}
      data-umami-event="Sign in"
      data-umami-event-label={label}
      onClick={() => {
        setPending(true);
        signIn("github", { redirectTo }).catch(() => setPending(false));
      }}
    >
      {pending ? (
        <Spinner size={16} />
      ) : (
        variant === "primary" && <GithubLogoIcon size={16} weight="fill" />
      )}
      {pending ? "Opening GitHub" : label}
    </button>
  );
}

export function AuthButton({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  if (isLoading) {
    return (
      <span
        aria-busy
        className={`${buttonClass("primary")} pointer-events-none ${className}`}
      >
        <GithubLogoIcon size={16} weight="fill" />
        {label}
      </span>
    );
  }
  if (isAuthenticated) {
    return (
      <Link
        to="/install"
        className={`${buttonClass("primary")} ${className}`}
        data-umami-event="Open dashboard"
      >
        Open dashboard
      </Link>
    );
  }
  return <SignInButton label={label} className={className} />;
}

export function SignInScreen({ redirectTo }: { redirectTo: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 pb-24">
      <div className="flex w-full max-w-[360px] flex-col items-center text-center">
        <Link to="/" aria-label="stateofpixel home">
          <Logo size={32} />
        </Link>
        <h1 className="mt-6 text-xl font-semibold tracking-[-0.025em]">
          Sign in to stateofpixel
        </h1>
        <p className="mt-2 text-sm text-muted">
          Access follows your GitHub permissions on each repository.
        </p>
        <div className="mt-8 flex w-full flex-col">
          <SignInButton redirectTo={redirectTo} label="Continue with GitHub" />
        </div>
      </div>
    </main>
  );
}

export function SigningIn() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 pb-24 text-sm text-muted">
      <Logo size={32} />
      <span className="flex items-center gap-2">
        <Spinner size={14} />
        Signing you in with GitHub
      </span>
    </main>
  );
}
