import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@stateofpixel/backend/api";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { buttonClass } from "./ui";

export function AppHeader({ owner }: { owner?: string }) {
  const viewer = useQuery(api.users.viewer);
  const accounts = useQuery(api.me.accounts);
  const { signOut } = useAuthActions();
  const navigate = useNavigate();

  return (
    <header className="flex h-12 items-center gap-4 border-b border-border bg-surface px-6 max-sm:px-4">
      <Link to="/install" className="text-sm font-semibold">
        stateofpixel
      </Link>
      {accounts !== undefined && accounts.length > 0 && (
        <select
          aria-label="Account"
          className="h-7 rounded-sm bg-transparent px-1 text-sm text-muted hover:bg-hover hover:text-text"
          value={owner ?? ""}
          onChange={(event) =>
            void navigate({
              to: "/$owner",
              params: { owner: event.target.value },
            })
          }
        >
          {owner === undefined && <option value="">Choose account</option>}
          {accounts.map((account) => (
            <option key={account.login} value={account.login}>
              {account.login}
            </option>
          ))}
        </select>
      )}
      <div className="ml-auto flex items-center gap-2">
        {viewer?.image && (
          <img src={viewer.image} alt="" className="size-6 rounded-full" />
        )}
        <span className="text-sm text-muted max-sm:hidden">
          {viewer?.login}
        </span>
        <button
          type="button"
          className={buttonClass("ghost", "sm")}
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
