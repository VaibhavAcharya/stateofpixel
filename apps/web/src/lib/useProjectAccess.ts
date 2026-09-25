import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@stateofpixel/backend/api";
import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useEffect, useState } from "react";

export function useProjectAccess(owner: string, name: string) {
  const access = useQuery(api.projects.access, { owner, name });
  const refresh = useAction(api.permissions.refresh);
  const { signOut } = useAuthActions();
  const [failed, setFailed] = useState(false);
  const projectId = access?.projectId;
  const fresh = access?.fresh;

  useEffect(() => {
    if (projectId === undefined || fresh !== false) {
      return;
    }
    refresh({ projectId }).catch((error: unknown) => {
      if (
        error instanceof ConvexError &&
        error.data?.code === "github_token_invalid"
      ) {
        void signOut();
        return;
      }
      setFailed(true);
    });
  }, [projectId, fresh, refresh, signOut]);

  if (
    access === undefined ||
    (access !== null && !access.canRead && !access.fresh && !failed)
  ) {
    return { state: "loading" as const };
  }
  if (access === null || !access.canRead) {
    return { state: "not_found" as const };
  }
  return { state: "ready" as const, access };
}
