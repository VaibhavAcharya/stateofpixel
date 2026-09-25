import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@stateofpixel/backend/api";
import { Link } from "@tanstack/react-router";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { buttonClass } from "./ui";

export function SignIn({ redirectTo = "/" }: { redirectTo?: string }) {
  const { signIn, signOut } = useAuthActions();

  return (
    <>
      <Unauthenticated>
        <button
          type="button"
          className={`mt-6 ${buttonClass("primary")}`}
          onClick={() => void signIn("github", { redirectTo })}
        >
          Sign in with GitHub
        </button>
      </Unauthenticated>
      <Authenticated>
        <Viewer onSignOut={() => void signOut()} />
      </Authenticated>
    </>
  );
}

function Viewer({ onSignOut }: { onSignOut: () => void }) {
  const viewer = useQuery(api.users.viewer);

  return (
    <div className="mt-6 flex items-center gap-3 text-sm">
      <span>Signed in as {viewer?.login}</span>
      <Link to="/install" className="text-link">
        Projects
      </Link>
      <button type="button" className="text-link" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  );
}
