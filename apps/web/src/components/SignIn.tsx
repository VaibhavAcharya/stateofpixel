import { useAuthActions } from "@convex-dev/auth/react";
import { GithubLogo } from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { buttonClass, Logo } from "./ui";

export function SignInButton({
  redirectTo = "/install",
  label = "Sign in with GitHub",
}: {
  redirectTo?: string;
  label?: string;
}) {
  const { signIn } = useAuthActions();
  return (
    <button
      type="button"
      className={buttonClass("primary")}
      onClick={() => void signIn("github", { redirectTo })}
    >
      <GithubLogo size={16} weight="fill" />
      {label}
    </button>
  );
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
