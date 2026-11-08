import {
  GithubLogoIcon,
  GoogleLogoIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { Alert, AlertDescription, Button, cn } from "uiofcraft";
import { useAuth, useAuthActions, useGoogleSignIn } from "../lib/auth";
import { api, callBackend } from "../lib/backend";
import { Logo, Spinner } from "./ui";

const BUTTON_VARIANTS = {
  primary: "default",
  secondary: "outline",
  ghost: "ghost",
} as const;

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
    <Button
      variant={BUTTON_VARIANTS[variant]}
      aria-busy={pending}
      disabled={pending}
      className={cn("disabled:opacity-100", className)}
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
    </Button>
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
      <Button
        render={<span />}
        aria-busy
        className={cn("pointer-events-none", className)}
      >
        <GithubLogoIcon size={16} weight="fill" />
        {label}
      </Button>
    );
  }
  if (isAuthenticated) {
    return (
      <Button
        render={<Link to="/install" />}
        className={className}
        data-umami-event="Open dashboard"
      >
        <SquaresFourIcon />
        Open dashboard
      </Button>
    );
  }
  return <SignInButton label={label} className={className} />;
}

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <Link
          to="/"
          aria-label="stateofpixel home"
          className="flex w-fit items-center gap-2 font-heading font-semibold text-lg tracking-[-0.01em]"
        >
          <Logo size={24} />
          stateofpixel
        </Link>
        <div className="flex flex-1 items-center justify-center py-16">
          <div className="w-full max-w-[360px]">{children}</div>
        </div>
      </div>
      <aside className="relative hidden flex-col justify-center gap-10 overflow-hidden border-l bg-sidebar p-12 lg:flex xl:p-16">
        <div className="max-w-[520px]">
          <p className="text-balance font-heading font-semibold text-3xl tracking-[-0.01em]">
            Catch UI regressions before they merge.
          </p>
          <p className="mt-3 text-pretty text-lg text-muted-foreground">
            Every pull request gets a visual check. Your CI takes the
            screenshots, a person approves each change.
          </p>
        </div>
        <div className="checker -mr-24 rounded-2xl border p-4 shadow-[0_32px_64px_-32px] shadow-black/24 xl:-mr-40 dark:shadow-black/64">
          <img
            src="/readme/review-page.png"
            alt="The stateofpixel review page, with the baseline and the new screenshot side by side and the changed pixels in magenta"
            width={1440}
            height={760}
            className="w-full rounded-lg border"
          />
        </div>
      </aside>
    </main>
  );
}

export function SignInScreen({ redirectTo }: { redirectTo: string }) {
  const google = useGoogleSignIn();
  return (
    <AuthLayout>
      <div className="flex flex-col">
        <h1 className="font-heading font-semibold text-2xl tracking-[-0.01em]">
          Sign in to stateofpixel
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
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
    </AuthLayout>
  );
}

export function SigningIn() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 pb-24 text-sm text-muted-foreground">
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
    "This GitHub account is connected to another stateofpixel user. Sign in the way you used before, or write to us to move it.",
  github_token_invalid: "Your GitHub connection expired. Connect again.",
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
    <AuthLayout>
      <div className="flex flex-col">
        <h1 className="font-heading font-semibold text-2xl tracking-[-0.01em]">
          Connect GitHub
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          stateofpixel reads your repositories and permissions through GitHub.
        </p>
        <div className="mt-8 flex w-full flex-col">
          <Button
            aria-busy={pending}
            disabled={pending}
            className="disabled:opacity-100"
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
          </Button>
        </div>
        {error !== null && (
          <Alert variant="error" className="mt-4 text-left">
            <AlertDescription className="text-foreground">
              {error}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </AuthLayout>
  );
}
