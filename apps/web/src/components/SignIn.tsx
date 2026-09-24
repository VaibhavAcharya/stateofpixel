import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@stateofpixel/backend/api";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";

export function SignIn() {
  const { signIn, signOut } = useAuthActions();

  return (
    <>
      <Unauthenticated>
        <button
          type="button"
          className="mt-6 h-8 rounded-[11px] bg-neutral-900 px-3 text-sm font-medium text-white"
          onClick={() => void signIn("github")}
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
      <button type="button" className="underline" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  );
}
