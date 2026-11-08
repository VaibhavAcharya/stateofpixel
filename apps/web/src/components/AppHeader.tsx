import {
  BookOpenIcon,
  CaretUpDownIcon,
  CheckIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SignOutIcon,
  SquaresFourIcon,
  SunIcon,
} from "@phosphor-icons/react/ssr";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { MenuPrimitive } from "uiofcraft";
import { useAuthActions } from "../lib/auth";
import { api, useQuery } from "../lib/backend";
import { type Theme, useTheme } from "../lib/theme";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuLinkItem,
  MenuSeparator,
} from "./Menu";
import { PLAN_NAMES } from "./PlanBox";
import { Avatar, accountAvatar, Logo } from "./ui";

function Slash() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden
      className="shrink-0 text-muted-foreground/64/50"
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
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border bg-sidebar px-4">
      <Link
        to="/"
        aria-label="stateofpixel home"
        className="-ml-1 flex size-8 items-center justify-center rounded-sm hover:bg-accent"
      >
        <Logo />
      </Link>
      <Link
        to="/install"
        activeOptions={{ exact: true }}
        className={`shrink-0 rounded-sm px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground aria-[current=page]:text-foreground ${
          owner === undefined ? "" : "max-sm:hidden"
        }`}
      >
        Accounts
      </Link>
      {owner !== undefined && (
        <>
          <Slash />
          <AccountSwitcher owner={owner} />
        </>
      )}
      {owner !== undefined && repo !== undefined && (
        <>
          <Slash />
          <Link
            to="/$owner/$repo"
            params={{ owner, repo }}
            className="min-w-0 truncate rounded-sm px-2 py-1 text-sm font-medium hover:bg-accent"
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

function AccountSwitcher({ owner }: { owner: string }) {
  const accounts = useQuery(api.me.accounts);
  const installUrl = useQuery(api.me.installUrl);

  return (
    <Menu
      label="Switch account"
      triggerClassName="flex h-8 max-w-56 items-center gap-2 rounded-sm px-2 text-sm font-medium hover:bg-accent"
      trigger={
        <>
          <Avatar src={accountAvatar(owner)} size={18} square />
          <span className="truncate">{owner}</span>
          <CaretUpDownIcon
            size={14}
            className="shrink-0 text-muted-foreground"
          />
        </>
      }
    >
      <MenuLinkItem render={<Link to="/install" />}>
        <SquaresFourIcon size={18} className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">All accounts</span>
      </MenuLinkItem>
      <MenuSeparator />
      <MenuGroup>
        <MenuGroupLabel>Accounts</MenuGroupLabel>
        {accounts?.map((account) => (
          <MenuLinkItem
            key={account.login}
            render={<Link to="/$owner" params={{ owner: account.login }} />}
          >
            <Avatar src={accountAvatar(account.login)} size={18} square />
            <span className="min-w-0 flex-1 truncate">{account.login}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {PLAN_NAMES[account.plan]}
            </span>
            {account.login === owner && (
              <CheckIcon size={14} className="shrink-0 text-muted-foreground" />
            )}
          </MenuLinkItem>
        ))}
      </MenuGroup>
      {installUrl !== undefined && (
        <>
          <MenuSeparator />
          <MenuLinkItem href={installUrl} className="text-muted-foreground">
            <PlusIcon size={16} className="shrink-0" />
            Add GitHub account
          </MenuLinkItem>
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
  const onAccounts = useLocation({
    select: (location) => location.pathname === "/install",
  });
  const [theme, setTheme] = useTheme();

  return (
    <Menu
      label="Account menu"
      align="end"
      triggerClassName="flex size-8 items-center justify-center rounded-full hover:bg-accent"
      trigger={<Avatar src={viewer?.image} size={24} />}
    >
      <div className="flex flex-col px-2 pt-1.5 pb-2">
        <span className="truncate font-medium">
          {viewer?.name ?? viewer?.login}
        </span>
        {viewer?.name && (
          <span className="truncate text-xs text-muted-foreground">
            @{viewer.login}
          </span>
        )}
      </div>
      <MenuSeparator />
      {onAccounts ? (
        <MenuItem disabled>
          <SquaresFourIcon
            size={16}
            className="shrink-0 text-muted-foreground"
          />
          Accounts
        </MenuItem>
      ) : (
        <MenuLinkItem render={<Link to="/install" />}>
          <SquaresFourIcon
            size={16}
            className="shrink-0 text-muted-foreground"
          />
          Accounts
        </MenuLinkItem>
      )}
      <MenuSeparator />
      <div className="flex h-8 items-center justify-between gap-2 pr-1 pl-2">
        <span>Theme</span>
        <MenuPrimitive.RadioGroup
          aria-label="Theme"
          value={theme}
          onValueChange={(value: Theme) => setTheme(value)}
          className="flex rounded-sm bg-muted p-0.5"
        >
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <MenuPrimitive.RadioItem
              key={value}
              value={value}
              title={label}
              aria-label={label}
              className="flex size-6 items-center justify-center rounded-[5px] text-muted-foreground outline-none transition-colors duration-100 data-checked:bg-card data-checked:text-foreground data-checked:shadow-[inset_0_0_0_1px_var(--color-border)] data-highlighted:text-foreground"
            >
              <Icon size={14} />
            </MenuPrimitive.RadioItem>
          ))}
        </MenuPrimitive.RadioGroup>
      </div>
      <MenuSeparator />
      <MenuLinkItem render={<Link to="/docs" />}>
        <BookOpenIcon size={16} className="shrink-0 text-muted-foreground" />
        Docs
      </MenuLinkItem>
      <MenuItem
        onClick={() => void navigate({ to: "/" }).then(() => signOut())}
      >
        <SignOutIcon size={16} className="shrink-0 text-muted-foreground" />
        Sign out
      </MenuItem>
    </Menu>
  );
}
