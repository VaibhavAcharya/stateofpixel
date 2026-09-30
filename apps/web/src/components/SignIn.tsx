import { GithubLogoIcon, GoogleLogoIcon } from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, useAuthActions, useGoogleSignIn } from "../lib/auth";
import { api, callBackend } from "../lib/backend";
import { buttonClass, Logo, Spinner } from "./ui";

const PROVIDERS = {
  github: { name: "GitHub", icon: GithubLogoIcon },
  google: { name: "Google", icon: GoogleLogoIcon },
};

function usePending() {
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

  return [pending, setPending] as const;
}

export function SignInButton({
  provider = "github",
  redirectTo = "/install",
  label = "Sign in with GitHub",
  variant = "primary",
  className = "",
}: {
  provider?: keyof typeof PROVIDERS;
  redirectTo?: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const { signIn } = useAuthActions();
  const [pending, setPending] = usePending();
  const { name, icon: Icon } = PROVIDERS[provider];

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
        signIn(provider, { redirectTo }).catch(() => setPending(false));
      }}
    >
      {pending ? (
        <Spinner size={16} />
      ) : (
        variant !== "ghost" && <Icon size={16} weight="fill" />
      )}
      {pending ? `Opening ${name}` : label}
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
  const { isLoading, isAuthenticated } = useAuth();
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
  const google = useGoogleSignIn();
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
          {google && (
            <SignInButton
              provider="google"
              redirectTo={redirectTo}
              label="Continue with Google"
              variant="secondary"
              className="mt-2"
            />
          )}
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
        Signing you in
      </span>
    </main>
  );
}

const CONNECT_ERRORS: Record<string, string> = {
  github_account_in_use:
    "This GitHub account is connected to another stateofpixel user.",
};

function useConnectError() {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get(
      "connect_error",
    );
    if (code !== null) {
      setError(CONNECT_ERRORS[code] ?? "Could not connect GitHub. Try again.");
    }
  }, []);
  return [error, setError] as const;
}

export function ConnectGithubScreen({ redirectTo }: { redirectTo: string }) {
  const [pending, setPending] = usePending();
  const [error, setError] = useConnectError();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 pb-24">
      <div className="flex w-full max-w-[360px] flex-col items-center text-center">
        <Link to="/" aria-label="stateofpixel home">
          <Logo size={32} />
        </Link>
        <h1 className="mt-6 text-xl font-semibold tracking-[-0.025em]">
          Connect GitHub
        </h1>
        <p className="mt-2 text-sm text-muted">
          stateofpixel reads your repositories and permissions through GitHub.
        </p>
        <div className="mt-8 flex w-full flex-col">
          <button
            type="button"
            aria-busy={pending}
            disabled={pending}
            className={`${buttonClass("primary")} disabled:opacity-100`}
            data-umami-event="Connect GitHub"
            onClick={() => {
              setPending(true);
              setError(null);
              callBackend(api.connections.githubAuthorizeUrl, { redirectTo })
                .then((url) => {
                  window.location.href = url;
                })
                .catch(() => {
                  setPending(false);
                  setError("Could not connect GitHub. Try again.");
                });
            }}
          >
            {pending ? (
              <Spinner size={16} />
            ) : (
              <GithubLogoIcon size={16} weight="fill" />
            )}
            {pending ? "Opening GitHub" : "Connect GitHub"}
          </button>
        </div>
        {error !== null && (
          <p className="mt-4 w-full rounded-md bg-failed-bg px-3 py-2 text-sm">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
