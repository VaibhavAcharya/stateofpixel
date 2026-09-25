import { useAuthActions } from "@convex-dev/auth/react";
import {
  CaretUpDownIcon,
  CheckIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  RocketLaunchIcon,
  SignOutIcon,
  SquaresFourIcon,
  SunIcon,
} from "@phosphor-icons/react/ssr";
import { api } from "@stateofpixel/backend/api";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import type { ReactNode } from "react";
import { type Theme, useTheme } from "../lib/theme";
import { Menu, MenuLabel, MenuSeparator, menuItemClass } from "./Menu";
import { PLAN_NAMES } from "./PlanBox";
import { Avatar, accountAvatar, Logo } from "./ui";

function Slash() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden
      className="shrink-0 text-field-border/50"
    >
      <path d="M10.5 2.5 5.5 13.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

export function AppHeader({
  owner,
  repo,
  actions,
}: {
  owner?: string;
  repo?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border bg-surface px-4">
      <Link
        to="/"
        aria-label="stateofpixel home"
        className="-ml-1 flex size-8 items-center justify-center rounded-sm hover:bg-hover"
      >
        <Logo />
      </Link>
      <Slash />
      <AccountSwitcher owner={owner} />
      {owner !== undefined && repo !== undefined && (
        <>
          <Slash />
          <Link
            to="/$owner/$repo"
            params={{ owner, repo }}
            className="min-w-0 truncate rounded-sm px-2 py-1 text-sm font-medium hover:bg-hover"
          >
            {repo}
          </Link>
        </>
      )}
      <div className="ml-auto flex items-center gap-1">
        {actions}
        <UserMenu />
      </div>
    </header>
  );
}

function AccountSwitcher({ owner }: { owner?: string }) {
  const accounts = useQuery(api.me.accounts);
  const installUrl = useQuery(api.me.installUrl);
  const billingAvailable = useQuery(api.billing.available);
  const current = accounts?.find((account) => account.login === owner);

  return (
    <Menu
      label="Switch account"
      triggerClassName="flex h-8 max-w-56 items-center gap-2 rounded-sm px-2 text-sm font-medium hover:bg-hover"
      trigger={
        <>
          {owner === undefined ? (
            <>
              <SquaresFourIcon size={18} className="shrink-0 text-muted" />
              <span>All projects</span>
            </>
          ) : (
            <>
              <Avatar src={accountAvatar(owner)} size={18} square />
              <span className="truncate">{owner}</span>
            </>
          )}
          <CaretUpDownIcon size={14} className="shrink-0 text-muted" />
        </>
      }
    >
      <Link to="/install" className={menuItemClass}>
        <SquaresFourIcon size={18} className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate">All projects</span>
        {owner === undefined && (
          <CheckIcon size={14} className="shrink-0 text-muted" />
        )}
      </Link>
      <MenuSeparator />
      <MenuLabel>Accounts</MenuLabel>
      {accounts?.map((account) => (
        <Link
          key={account.login}
          to="/$owner"
          params={{ owner: account.login }}
          className={menuItemClass}
        >
          <Avatar src={accountAvatar(account.login)} size={18} square />
          <span className="min-w-0 flex-1 truncate">{account.login}</span>
          <span className="shrink-0 text-xs text-muted">
            {PLAN_NAMES[account.plan]}
          </span>
          {account.login === owner && (
            <CheckIcon size={14} className="shrink-0 text-muted" />
          )}
        </Link>
      ))}
      {billingAvailable && current !== undefined && !current.subscribed && (
        <>
          <MenuSeparator />
          <Link
            to="/$owner/settings/billing"
            params={{ owner: current.login }}
            className={`${menuItemClass} text-muted`}
            data-umami-event="Upgrade hint"
            data-umami-event-source="account switcher"
          >
            <RocketLaunchIcon size={16} className="shrink-0" />
            Upgrade plan
          </Link>
        </>
      )}
      {installUrl !== undefined && (
        <>
          <MenuSeparator />
          <a href={installUrl} className={`${menuItemClass} text-muted`}>
            <PlusIcon size={16} className="shrink-0" />
            Add GitHub account
          </a>
        </>
      )}
    </Menu>
  );
}

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof SunIcon }[] = [
  { value: "system", label: "System", icon: MonitorIcon },
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
];

function UserMenu() {
  const viewer = useQuery(api.users.viewer);
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const onAllProjects = useLocation({
    select: (location) => location.pathname === "/install",
  });
  const [theme, setTheme] = useTheme();

  return (
    <Menu
      label="Account menu"
      align="end"
      triggerClassName="flex size-8 items-center justify-center rounded-full hover:bg-hover"
      trigger={<Avatar src={viewer?.image} size={24} />}
    >
      <div className="flex flex-col px-2 pt-1.5 pb-2">
        <span className="truncate font-medium">
          {viewer?.name ?? viewer?.login}
        </span>
        {viewer?.name && (
          <span className="truncate text-xs text-muted">@{viewer.login}</span>
        )}
      </div>
      <MenuSeparator />
      {onAllProjects ? (
        <span
          aria-disabled
          className={`${menuItemClass} pointer-events-none opacity-45`}
        >
          <SquaresFourIcon size={16} className="shrink-0 text-muted" />
          All projects
        </span>
      ) : (
        <Link to="/install" className={menuItemClass}>
          <SquaresFourIcon size={16} className="shrink-0 text-muted" />
          All projects
        </Link>
      )}
      <MenuSeparator />
      <div className="flex h-8 items-center justify-between gap-2 pr-1 pl-2">
        <span>Theme</span>
        <fieldset
          aria-label="Theme"
          className="flex rounded-sm bg-surface-2 p-0.5"
        >
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              title={label}
              aria-label={label}
              className={`flex size-6 items-center justify-center rounded-[5px] transition-colors duration-100 ${
                theme === value
                  ? "bg-surface text-text shadow-[inset_0_0_0_1px_var(--color-border)]"
                  : "text-muted hover:text-text"
              }`}
              onClick={() => setTheme(value)}
            >
              <Icon size={14} />
            </button>
          ))}
        </fieldset>
      </div>
      <MenuSeparator />
      <button
        type="button"
        className={menuItemClass}
        onClick={() => void navigate({ to: "/" }).then(() => signOut())}
      >
        <SignOutIcon size={16} className="shrink-0 text-muted" />
        Sign out
      </button>
    </Menu>
  );
}
