import {
  ArrowUpRightIcon,
  GearIcon,
  ImagesIcon,
  StackIcon,
} from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { api, useQuery } from "../lib/backend";
import { AccountBanner } from "./AccountBanner";
import { PageHeader } from "./Page";
import { Tab, Tabs } from "./Tabs";
import { buttonClass } from "./ui";

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
    !access.canAdmin;

  return (
    <>
      <PageHeader
        title={repo}
        above={
          <Link to="/$owner" params={{ owner }} className="hover:text-text">
            {owner}
          </Link>
        }
        actions={
          <a
            href={`https://github.com/${owner}/${repo}`}
            className={buttonClass()}
          >
            Repository
            <ArrowUpRightIcon size={14} className="text-muted" />
          </a>
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
              ? "Only admins of this repository on GitHub can change its settings."
              : undefined
          }
        />
      </Tabs>
    </>
  );
}
