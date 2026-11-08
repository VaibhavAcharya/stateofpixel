import {
  GithubLogoIcon,
  GoogleLogoIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
        <p className="mt-2 text-sm text-muted-foreground">
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
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 pb-24">
      <div className="flex w-full max-w-[360px] flex-col items-center text-center">
        <Link to="/" aria-label="stateofpixel home">
          <Logo size={32} />
        </Link>
        <h1 className="mt-6 text-xl font-semibold tracking-[-0.025em]">
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
    </main>
  );
}
