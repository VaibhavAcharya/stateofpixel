import {
  ArrowUpRightIcon,
  GearIcon,
  ImagesIcon,
  StackIcon,
} from "@phosphor-icons/react/ssr";
import { Button } from "uiofcraft";
import { api, useQuery } from "../lib/backend";
import { AccountBanner } from "./AccountBanner";
import { PageHeader } from "./Page";
import { Tab, Tabs } from "./Tabs";
import { ProjectMark } from "./ui";

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
      <Tabs>
        <Tab
          to="/$owner/$repo"
          params={{ owner, repo }}
          icon={StackIcon}
          label="Builds"
          active={tab === "builds"}
        />
        <Tab
          to="/$owner/$repo/baselines"
          params={{ owner, repo }}
          icon={ImagesIcon}
          label="Baselines"
          active={tab === "baselines"}
        />
        <Tab
          to="/$owner/$repo/settings"
          params={{ owner, repo }}
          icon={GearIcon}
          label="Settings"
          active={tab === "settings"}
          disabledReason={
            settingsLocked
              ? "Only people with write access to this repository on GitHub can change its settings."
              : undefined
          }
        />
      </Tabs>
    </>
  );
}
