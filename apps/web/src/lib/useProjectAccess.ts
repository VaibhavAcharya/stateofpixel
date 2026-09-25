import { api } from "@stateofpixel/backend/api";
import { useAction, useQuery } from "convex/react";
import { useEffect, useState } from "react";

export function useProjectAccess(owner: string, name: string) {
  const access = useQuery(api.projects.access, { owner, name });
  const refresh = useAction(api.permissions.refresh);
  const [failed, setFailed] = useState(false);
  const projectId = access?.projectId;
  const fresh = access?.fresh;

  useEffect(() => {
    if (projectId === undefined || fresh !== false) {
      return;
    }
    refresh({ projectId }).catch(() => setFailed(true));
  }, [projectId, fresh, refresh]);

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
