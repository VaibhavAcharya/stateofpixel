import { useCallback } from "react";
import { api, useMutation } from "./backend";

export function useDisconnectExpiredGithub() {
  const disconnect = useMutation(api.connections.disconnectGithub);
  return useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("connect_error", "github_token_invalid");
    window.history.replaceState(window.history.state, "", url);
    return disconnect({});
  }, [disconnect]);
}
