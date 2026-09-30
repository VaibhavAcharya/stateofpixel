import { useEffect, useState } from "react";
import { api, useAction, useMutation, useQuery } from "./backend";
import { errorCode } from "./errorCode";

export function useProjectAccess(owner: string, name: string) {
  const access = useQuery(api.projects.access, { owner, name });
  const refresh = useAction(api.permissions.refresh);
  const disconnectGithub = useMutation(api.connections.disconnectGithub);
  const [failed, setFailed] = useState(false);
  const projectId = access?.projectId;
  const fresh = access?.fresh;

  useEffect(() => {
    if (projectId === undefined || fresh !== false) {
      return;
    }
    refresh({ projectId }).catch((error: unknown) => {
      if (errorCode(error) === "github_token_invalid") {
        void disconnectGithub({});
        return;
      }
      setFailed(true);
    });
  }, [projectId, fresh, refresh, disconnectGithub]);

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
