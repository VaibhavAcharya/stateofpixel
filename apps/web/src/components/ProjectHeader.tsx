import {
  ArrowUpRightIcon,
  GearIcon,
  ImagesIcon,
  StackIcon,
} from "@phosphor-icons/react/ssr";
import { api } from "@stateofpixel/backend/api";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { PageHeader } from "./Page";
import { StorageBanner } from "./StorageBanner";
import { buttonClass, type Icon } from "./ui";

type Tab = "builds" | "baselines" | "settings";

const TAB_CLASS =
  "-mb-px flex h-10 items-center gap-1.5 border-b-2 text-sm transition-colors duration-100";

export function ProjectHeader({
  owner,
  repo,
  tab,
}: {
  owner: string;
  repo: string;
  tab: Tab;
}) {
  const access = useQuery(api.projects.access, { owner, name: repo });
  const tabs: { value: Tab; label: string; to: string; icon: Icon }[] = [
    { value: "builds", label: "Builds", to: "/$owner/$repo", icon: StackIcon },
    {
      value: "baselines",
      label: "Baselines",
      to: "/$owner/$repo/baselines",
      icon: ImagesIcon,
    },
    ...(access?.canAdmin
      ? [
          {
            value: "settings" as const,
            label: "Settings",
            to: "/$owner/$repo/settings",
            icon: GearIcon,
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title={repo}
        meta={
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
      {access?.storage && <StorageBanner storage={access.storage} />}
      <nav className="mb-6 flex gap-5 border-b border-border">
        {tabs.map((item) => (
          <Link
            key={item.value}
            to={item.to}
            params={{ owner, repo }}
            aria-current={item.value === tab ? "page" : undefined}
            className={`${TAB_CLASS} ${
              item.value === tab
                ? "border-accent text-text"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            <item.icon size={16} />
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
