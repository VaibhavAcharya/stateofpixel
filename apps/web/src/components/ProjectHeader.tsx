import {
  ArrowUpRightIcon,
  GearIcon,
  ImagesIcon,
  StackIcon,
} from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { Button, Tabs, TabsList, TabsTab } from "uiofcraft";
import { api, useQuery } from "../lib/backend";
import { AccountBanner } from "./AccountBanner";
import { PageHeader } from "./Page";
import { ProjectMark, Tooltip } from "./ui";

type ProjectTab = "builds" | "baselines" | "settings";

export function ProjectHeader({
  owner,
  repo,
  tab,
}: {
  owner: string;
  repo: string;
  tab: ProjectTab;
}) {
  const access = useQuery(api.projects.access, { owner, name: repo });
  const settingsLocked =
    access !== undefined &&
    access !== null &&
    access.permission !== null &&
    !access.canWrite;

  return (
    <>
      <PageHeader
        leading={<ProjectMark name={`${owner}/${repo}`} size={40} />}
        title={repo}
        actions={
          <Button
            variant="outline"
            render={<a href={`https://github.com/${owner}/${repo}`} />}
          >
            Repository
            <ArrowUpRightIcon />
          </Button>
        }
      />
      {access?.account && (
        <AccountBanner
          owner={owner}
          account={access.account}
          repo={{ name: repo, canAdmin: access.canAdmin }}
        />
      )}
      <Tabs value={tab} className="mb-6">
        <TabsList
          variant="underline"
          aria-label="Project"
          className="w-full justify-start border-b"
        >
          <TabsTab
            value="builds"
            nativeButton={false}
            render={<Link to="/$owner/$repo" params={{ owner, repo }} />}
          >
            <StackIcon />
            Builds
          </TabsTab>
          <TabsTab
            value="baselines"
            nativeButton={false}
            render={
              <Link to="/$owner/$repo/baselines" params={{ owner, repo }} />
            }
          >
            <ImagesIcon />
            Baselines
          </TabsTab>
          {settingsLocked ? (
            <Tooltip label="Only people with write access to this repository on GitHub can change its settings.">
              <TabsTab value="settings" disabled>
                <GearIcon />
                Settings
              </TabsTab>
            </Tooltip>
          ) : (
            <TabsTab
              value="settings"
              nativeButton={false}
              render={
                <Link to="/$owner/$repo/settings" params={{ owner, repo }} />
              }
            >
              <GearIcon />
              Settings
            </TabsTab>
          )}
        </TabsList>
      </Tabs>
    </>
  );
}
