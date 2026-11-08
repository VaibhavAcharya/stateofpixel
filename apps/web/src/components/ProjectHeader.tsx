import { ArrowUpRightIcon } from "@phosphor-icons/react/ssr";
import { Button } from "uiofcraft";
import { api, useQuery } from "../lib/backend";
import { AccountBanner } from "./AccountBanner";
import { PageHeader } from "./Page";
import { ProjectMark } from "./ui";

type ProjectTab = "builds" | "baselines" | "settings";

const PROJECT_PAGES: Record<ProjectTab, string> = {
  builds: "Builds",
  baselines: "Baselines",
  settings: "Settings",
};

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

  return (
    <>
      <PageHeader
        leading={<ProjectMark name={`${owner}/${repo}`} size={40} />}
        above={repo}
        title={PROJECT_PAGES[tab]}
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
    </>
  );
}
