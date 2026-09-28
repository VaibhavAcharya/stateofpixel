import { KeyboardIcon } from "@phosphor-icons/react/ssr";
import { api } from "@stateofpixel/backend/api";
import type { Id } from "@stateofpixel/backend/dataModel";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { lazy, Suspense, useState } from "react";
import { AppHeader } from "../../../../components/AppHeader";
import {
  BuildDeleted,
  BuildNotFound,
} from "../../../../components/build/BuildNotFound";
import {
  BuildPage,
  PrefetchSnapshot,
  ShortcutsContext,
} from "../../../../components/build/BuildPage";
import { RequireAuth } from "../../../../components/RequireAuth";
import { ShortcutsDialog } from "../../../../components/ShortcutsDialog";
import { buttonClass, Skeleton } from "../../../../components/ui";
import { isLab } from "../../../../lib/lab";
import { prefetchBuild } from "../../../../lib/prefetch";
import { useProjectAccess } from "../../../../lib/useProjectAccess";

export const Route = createFileRoute("/$owner/$repo/builds/$number")({
  loader: ({ context, params }) =>
    isLab(params.owner) ? undefined : prefetchBuild(context.convex, params),
  component: BuildRoute,
});

const LabBuild = import.meta.env.DEV
  ? lazy(() => import("../../../../components/build/LabBuild"))
  : null;
function BuildRoute() {
  const { owner, repo, number } = Route.useParams();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const lab = isLab(owner) && LabBuild !== null;
  const page = (
    <ShortcutsContext.Provider
      value={{ open: shortcutsOpen, setOpen: setShortcutsOpen }}
    >
      <div className="flex h-dvh flex-col">
        <AppHeader
          owner={owner}
          repo={repo}
          actions={
            <button
              type="button"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
              className={buttonClass("ghost", "icon")}
              onClick={() => setShortcutsOpen(true)}
            >
              <KeyboardIcon size={18} />
            </button>
          }
        />
        {lab ? (
          <Suspense fallback={<BuildSkeleton />}>
            <LabBuild number={Number(number)}>
              {(build) => (
                <BuildPage build={build} canWrite owner={owner} repo={repo} />
              )}
            </LabBuild>
          </Suspense>
        ) : (
          <BuildAccess owner={owner} repo={repo} number={Number(number)} />
        )}
      </div>
      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </ShortcutsContext.Provider>
  );
  return lab ? (
    page
  ) : (
    <RequireAuth redirectTo={`/${owner}/${repo}/builds/${number}`}>
      {page}
    </RequireAuth>
  );
}

function BuildAccess({
  owner,
  repo,
  number,
}: {
  owner: string;
  repo: string;
  number: number;
}) {
  const { snapshotId } = useParams({ strict: false });
  const result = useProjectAccess(owner, repo);
  const valid = Number.isInteger(number);
  const build = useQuery(
    api.builds.get,
    valid ? { owner, name: repo, number } : "skip",
  );
  const deleted = useQuery(
    api.builds.deleted,
    valid && build === null ? { owner, name: repo, number } : "skip",
  );
  const prefetch = valid && snapshotId !== undefined && (
    <PrefetchSnapshot
      owner={owner}
      repo={repo}
      number={number}
      snapshotId={snapshotId as Id<"snapshots">}
    />
  );
  if (result.state === "loading" || (build === undefined && valid)) {
    return (
      <>
        {prefetch}
        <BuildSkeleton />
      </>
    );
  }
  if (result.state === "not_found") {
    return <BuildNotFound title="Project not found." />;
  }
  if (!build) {
    if (deleted === undefined && valid) {
      return <BuildSkeleton />;
    }
    return deleted ? (
      <BuildDeleted
        owner={owner}
        repo={repo}
        number={number}
        deletion={deleted.deletion}
      />
    ) : (
      <BuildNotFound title="Build not found." />
    );
  }
  return (
    <BuildPage
      build={build}
      canWrite={result.access.canWrite}
      owner={owner}
      repo={repo}
    />
  );
}

function BuildSkeleton() {
  return (
    <>
      <div className="flex h-[76px] shrink-0 flex-col justify-center gap-2.5 border-b border-border bg-surface px-4">
        <Skeleton className="h-4 w-80 rounded-xs" />
        <Skeleton className="h-3 w-120 max-w-full rounded-xs" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex w-[300px] shrink-0 flex-col gap-1 border-r border-border bg-surface p-2 max-lg:hidden">
          <Skeleton className="mb-2 h-8" />
          {Array.from({ length: 8 }, (_, index) => `row-${index}`).map(
            (key) => (
              <Skeleton key={key} className="h-8 rounded-sm opacity-60" />
            ),
          )}
        </div>
        <div className="flex-1 bg-canvas p-4">
          <Skeleton className="aspect-[16/10] max-h-full w-full bg-surface" />
        </div>
      </div>
    </>
  );
}
