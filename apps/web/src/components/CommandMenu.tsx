import {
  BookOpenIcon,
  ChartBarIcon,
  CreditCardIcon,
  GearIcon,
  ImagesIcon,
  MagnifyingGlassIcon,
  MonitorIcon,
  MoonIcon,
  SquaresFourIcon,
  StackIcon,
  SunIcon,
  UsersIcon,
} from "@phosphor-icons/react/ssr";
import { useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import {
  Button,
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  Kbd,
  KbdGroup,
} from "uiofcraft";
import { api, usePaginatedQuery, useQuery } from "../lib/backend";
import { isLab } from "../lib/lab";
import { type Theme, useTheme } from "../lib/theme";
import { Avatar, accountAvatar, ProjectMark } from "./ui";

type Entry = {
  value: string;
  label: string;
  icon: ReactNode;
  run: () => void;
};

type Group = { id: string; value: string; items: Entry[] };

const PROJECT_LIMIT = 50;

export function CommandMenu({
  owner,
  repo,
}: {
  owner?: string;
  repo?: string;
}) {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    if (open) {
      setOpened(true);
    }
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        className="w-52 justify-start text-muted-foreground max-md:hidden"
        onClick={() => setOpen(true)}
      >
        <MagnifyingGlassIcon />
        Jump to
        <KbdGroup className="ms-auto">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Jump to"
        className="md:hidden"
        onClick={() => setOpen(true)}
      >
        <MagnifyingGlassIcon />
      </Button>
      <CommandDialogPopup>
        {(open || opened) && (
          <CommandMenuContent
            owner={owner}
            repo={repo}
            close={() => setOpen(false)}
          />
        )}
      </CommandDialogPopup>
    </CommandDialog>
  );
}

const THEMES: { value: Theme; label: string; icon: typeof SunIcon }[] = [
  { value: "system", label: "Use the system theme", icon: MonitorIcon },
  { value: "light", label: "Use the light theme", icon: SunIcon },
  { value: "dark", label: "Use the dark theme", icon: MoonIcon },
];

function CommandMenuContent({
  owner,
  repo,
  close,
}: {
  owner?: string;
  repo?: string;
  close: () => void;
}) {
  const navigate = useNavigate();
  const [, setTheme] = useTheme();
  const accounts = useQuery(api.me.accounts);
  const projects = usePaginatedQuery(
    api.accounts.projects,
    owner === undefined || isLab(owner)
      ? "skip"
      : { login: owner, sort: "name", order: "asc" },
    { initialNumItems: PROJECT_LIMIT },
  );

  const go = (run: () => void) => () => {
    close();
    run();
  };

  const groups: Group[] = [];
  if (owner !== undefined && repo !== undefined) {
    groups.push({
      id: "project",
      value: repo,
      items: [
        {
          value: "project-builds",
          label: "Builds",
          icon: <StackIcon />,
          run: () =>
            void navigate({ to: "/$owner/$repo", params: { owner, repo } }),
        },
        {
          value: "project-baselines",
          label: "Baselines",
          icon: <ImagesIcon />,
          run: () =>
            void navigate({
              to: "/$owner/$repo/baselines",
              params: { owner, repo },
            }),
        },
        {
          value: "project-settings",
          label: "Settings",
          icon: <GearIcon />,
          run: () =>
            void navigate({
              to: "/$owner/$repo/settings",
              params: { owner, repo },
            }),
        },
      ],
    });
  }
  if (owner !== undefined) {
    groups.push({
      id: "account",
      value: owner,
      items: [
        {
          value: "account-overview",
          label: "Overview",
          icon: <SquaresFourIcon />,
          run: () => void navigate({ to: "/$owner", params: { owner } }),
        },
        {
          value: "account-members",
          label: "Members",
          icon: <UsersIcon />,
          run: () =>
            void navigate({
              to: "/$owner/settings/members",
              params: { owner },
            }),
        },
        {
          value: "account-usage",
          label: "Usage",
          icon: <ChartBarIcon />,
          run: () =>
            void navigate({ to: "/$owner/settings/usage", params: { owner } }),
        },
        {
          value: "account-billing",
          label: "Billing",
          icon: <CreditCardIcon />,
          run: () =>
            void navigate({
              to: "/$owner/settings/billing",
              params: { owner },
            }),
        },
      ],
    });
    if (projects.results.length > 0) {
      groups.push({
        id: "projects",
        value: "Projects",
        items: projects.results.map((project) => ({
          value: `project-${project.name}`,
          label: project.name,
          icon: (
            <ProjectMark name={`${project.owner}/${project.name}`} size={16} />
          ),
          run: () =>
            void navigate({
              to: "/$owner/$repo",
              params: { owner: project.owner, repo: project.name },
            }),
        })),
      });
    }
  }
  if (accounts !== undefined && accounts.length > 0) {
    groups.push({
      id: "accounts",
      value: "Accounts",
      items: [
        {
          value: "accounts",
          label: "All accounts",
          icon: <SquaresFourIcon />,
          run: () => void navigate({ to: "/install" }),
        },
        ...accounts.map((account) => ({
          value: `account-${account.login}`,
          label: account.login,
          icon: <Avatar src={accountAvatar(account.login)} size={16} square />,
          run: () =>
            void navigate({ to: "/$owner", params: { owner: account.login } }),
        })),
      ],
    });
  }
  groups.push({
    id: "general",
    value: "General",
    items: [
      {
        value: "docs",
        label: "Docs",
        icon: <BookOpenIcon />,
        run: () => void navigate({ to: "/docs" }),
      },
      ...THEMES.map(({ value, label, icon: Icon }) => ({
        value: `theme-${value}`,
        label,
        icon: <Icon />,
        run: () => setTheme(value),
      })),
    ],
  });

  return (
    <Command items={groups} itemToStringValue={(item) => (item as Entry).label}>
      <CommandInput placeholder="Jump to a project, account or page" />
      <CommandEmpty>Nothing matches.</CommandEmpty>
      <CommandList>
        {(group: Group) => (
          <CommandGroup key={group.id} items={group.items}>
            <CommandGroupLabel>{group.value}</CommandGroupLabel>
            <CommandCollection>
              {(item: Entry) => (
                <CommandItem
                  key={item.value}
                  value={item}
                  className="gap-2.5 [&_svg]:size-4 [&_svg]:text-muted-foreground"
                  onClick={go(item.run)}
                >
                  {item.icon}
                  {item.label}
                </CommandItem>
              )}
            </CommandCollection>
          </CommandGroup>
        )}
      </CommandList>
      <CommandFooter>
        <span className="flex items-center gap-2">
          <KbdGroup>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
          </KbdGroup>
          Move
        </span>
        <span className="flex items-center gap-2">
          <Kbd>Enter</Kbd>
          Open
        </span>
        <span className="flex items-center gap-2">
          <Kbd>Esc</Kbd>
          Close
        </span>
      </CommandFooter>
    </Command>
  );
}
