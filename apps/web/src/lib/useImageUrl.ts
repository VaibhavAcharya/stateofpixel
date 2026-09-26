import { api } from "@stateofpixel/backend/api";
import type { Id } from "@stateofpixel/backend/dataModel";
import { useMutation } from "convex/react";
import { useEffect, useSyncExternalStore } from "react";

const PRIVATE_IMAGE = /\/images\/([^/?]+)\/[^/?]+$/;
const REFRESH_BEFORE_MS = 30 * 60 * 1000;

type Grant = { exp: number; sig: string };

const grants = new Map<string, Grant>();
const requested = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function renewImageGrant(url: string): boolean {
  const projectId = url.match(PRIVATE_IMAGE)?.[1];
  if (projectId === undefined) {
    return false;
  }
  grants.delete(projectId);
  notify();
  return true;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useImageUrl(url: string | undefined): string | undefined {
  const projectId = url?.match(PRIVATE_IMAGE)?.[1] ?? null;
  const requestGrant = useMutation(api.images.grant);
  const grant = useSyncExternalStore(
    subscribe,
    () => (projectId === null ? undefined : grants.get(projectId)),
    () => undefined,
  );

  useEffect(() => {
    if (projectId === null) {
      return;
    }
    const request = () => {
      if (requested.has(projectId)) {
        return;
      }
      requested.add(projectId);
      requestGrant({ projectId: projectId as Id<"projects"> })
        .then((next) => {
          grants.set(projectId, next);
          notify();
        })
        .catch(() => undefined)
        .finally(() => requested.delete(projectId));
    };
    const delay = (grant?.exp ?? 0) - REFRESH_BEFORE_MS - Date.now();
    if (delay <= 0) {
      request();
      return;
    }
    const timer = setTimeout(request, delay);
    return () => clearTimeout(timer);
  }, [projectId, grant, requestGrant]);

  if (projectId === null) {
    return url;
  }
  return grant === undefined
    ? undefined
    : `${url}?exp=${grant.exp}&sig=${grant.sig}`;
}
