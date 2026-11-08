import {
  BookOpenIcon,
  CaretUpDownIcon,
  ChartBarIcon,
  CheckIcon,
  CreditCardIcon,
  GearIcon,
  ImagesIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SignOutIcon,
  SquaresFourIcon,
  StackIcon,
  SunIcon,
  UsersIcon,
} from "@phosphor-icons/react/ssr";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  cn,
  MenuPrimitive,
  Separator,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  Skeleton,
  useSidebar,
} from "uiofcraft";
import { useAuthActions } from "../lib/auth";
import { api, usePaginatedQuery, useQuery } from "../lib/backend";
import { formatCount } from "../lib/format";
import { isLab } from "../lib/lab";
import { type Theme, useTheme } from "../lib/theme";
import { CommandMenu } from "./CommandMenu";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuLinkItem,
  MenuSeparator,
} from "./Menu";
import { PLAN_NAMES } from "./PlanBox";
import { Avatar, accountAvatar, Logo, ProjectMark, Tooltip } from "./ui";

const SIDEBAR_PROJECTS = 12;

let sidebarOpen: boolean | null = null;

export function AppShell({
  owner,
  repo,
  crumb,
  actions,
  fullHeight = false,
  children,
}: {
  owner?: string;
  repo?: string;
  crumb?: string;
  actions?: ReactNode;
  fullHeight?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(fullHeight ? false : (sidebarOpen ?? true));
  return (
    <SidebarProvider
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!fullHeight) {
          sidebarOpen = value;
        }
      }}
      className={fullHeight ? "h-dvh overflow-hidden" : undefined}
    >
      <AppSidebar owner={owner} repo={repo} />
      <CloseMobileSidebarOnNavigate />
      <SidebarInset
        className={cn(
          "min-w-0",
          fullHeight && "h-[calc(100dvh-var(--spacing)*4)] overflow-hidden",
        )}
      >
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 rounded-t-[inherit] border-b bg-background/80 px-3 backdrop-blur-sm sm:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <AppBreadcrumb owner={owner} repo={repo} crumb={crumb} />
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <CommandMenu owner={owner} repo={repo} />
            {actions}
          </div>
        </header>
        {fullHeight ? (
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        ) : (
          children
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}

function CloseMobileSidebarOnNavigate() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { setOpenMobile } = useSidebar();
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current !== pathname) {
      previous.current = pathname;
      setOpenMobile(false);
    }
  }, [pathname, setOpenMobile]);
  return null;
}

function AppBreadcrumb({
  owner,
  repo,
  crumb,
}: {
  owner?: string;
  repo?: string;
  crumb?: string;
}) {
  const trail: { label: string; link?: ReactElement }[] = [
    { label: "Accounts", link: <Link to="/install" /> },
  ];
  if (owner !== undefined) {
    trail.push({
      label: owner,
      link: <Link to="/$owner" params={{ owner }} />,
    });
  }
  if (owner !== undefined && repo !== undefined) {
    trail.push({
      label: repo,
      link: <Link to="/$owner/$repo" params={{ owner, repo }} />,
    });
  }
  if (crumb !== undefined) {
    trail.push({ label: crumb });
  }
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {trail.map((item, index) => {
          const last = index === trail.length - 1;
          return [
            index > 0 && (
              <BreadcrumbSeparator
                key={`${item.label}-separator`}
                className="max-sm:hidden"
              />
            ),
            <BreadcrumbItem
              key={item.label}
              className={cn("min-w-0", !last && "max-sm:hidden")}
            >
              {last ? (
                <BreadcrumbPage className="truncate">
                  {item.label}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink className="truncate" render={item.link}>
                  {item.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>,
          ];
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function MenuSkeleton() {
  return (
    <div aria-hidden className="flex h-8 items-center gap-2 px-2">
      <Skeleton className="size-4 rounded-md" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

function AppSidebar({ owner, repo }: { owner?: string; repo?: string }) {
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        {owner === undefined ? <HomeLink /> : <AccountSwitcher owner={owner} />}
      </SidebarHeader>
      <SidebarContent>
        {owner === undefined ? (
          <AccountsGroup />
        ) : (
          <>
            <AccountNav owner={owner} />
            <ProjectsGroup owner={owner} repo={repo} />
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Docs" render={<Link to="/docs" />}>
              <BookOpenIcon />
              <span>Docs</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <UserMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function HomeLink() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          tooltip="stateofpixel"
          render={<Link to="/" aria-label="stateofpixel home" />}
        >
          <span className="flex size-8 shrink-0 items-center justify-center">
            <Logo size={24} />
          </span>
          <span className="font-heading font-semibold">stateofpixel</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

const ACCOUNT_NAV = [
  { label: "Overview", icon: SquaresFourIcon, to: "/$owner" },
  { label: "Members", icon: UsersIcon, to: "/$owner/settings/members" },
  { label: "Usage", icon: ChartBarIcon, to: "/$owner/settings/usage" },
  { label: "Billing", icon: CreditCardIcon, to: "/$owner/settings/billing" },
] as const;

function AccountNav({ owner }: { owner: string }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {ACCOUNT_NAV.map(({ label, icon: Icon, to }) => (
            <SidebarMenuItem key={label}>
              <SidebarMenuButton
                tooltip={label}
                isActive={pathname === to.replace("$owner", owner)}
                render={<Link to={to} params={{ owner }} />}
              >
                <Icon />
                <span>{label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function ProjectsGroup({ owner, repo }: { owner: string; repo?: string }) {
  const { results, status } = usePaginatedQuery(
    api.accounts.projects,
    { login: owner, sort: "name", order: "asc" },
    { initialNumItems: SIDEBAR_PROJECTS },
  );
  const projects = results.slice(0, SIDEBAR_PROJECTS);
  const missing =
    repo !== undefined && !projects.some((project) => project.name === repo);
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {status === "LoadingFirstPage" &&
            ["a", "b", "c"].map((key) => (
              <SidebarMenuItem key={key}>
                <MenuSkeleton />
              </SidebarMenuItem>
            ))}
          {projects.map((project) => (
            <ProjectItem
              key={project.name}
              owner={owner}
              name={project.name}
              active={project.name === repo}
              toReview={toReview(project.latestBuild)}
            />
          ))}
          {missing && (
            <ProjectItem owner={owner} name={repo} active toReview={0} />
          )}
          {status !== "LoadingFirstPage" && status !== "Exhausted" && (
            <SidebarMenuItem>
              <SidebarMenuButton
                className="text-muted-foreground"
                render={<Link to="/$owner" params={{ owner }} />}
              >
                <SquaresFourIcon />
                <span>All projects</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

type LatestBuild = {
  status: string;
  conclusion: string | null;
  counts: { pending: number };
  storageBlocked: boolean;
} | null;

function toReview(build: LatestBuild) {
  return build?.status === "finalized" &&
    build.conclusion === "changes" &&
    !build.storageBlocked
    ? build.counts.pending
    : 0;
}

function ProjectItem({
  owner,
  name,
  active,
  toReview,
}: {
  owner: string;
  name: string;
  active: boolean;
  toReview: number;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={name}
        isActive={active}
        render={<Link to="/$owner/$repo" params={{ owner, repo: name }} />}
      >
        <ProjectMark name={`${owner}/${name}`} size={16} />
        <span>{name}</span>
      </SidebarMenuButton>
      {toReview > 0 && (
        <SidebarMenuBadge
          title={`${formatCount(toReview)} to review on the latest build`}
          className="text-pending tabular-nums"
        >
          {formatCount(toReview)}
        </SidebarMenuBadge>
      )}
      {active && <ProjectPages owner={owner} repo={name} />}
    </SidebarMenuItem>
  );
}

const PROJECT_PAGES = [
  { label: "Builds", icon: StackIcon, to: "/$owner/$repo" },
  { label: "Baselines", icon: ImagesIcon, to: "/$owner/$repo/baselines" },
  { label: "Settings", icon: GearIcon, to: "/$owner/$repo/settings" },
] as const;

function ProjectPages({ owner, repo }: { owner: string; repo: string }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const access = useQuery(
    api.projects.access,
    isLab(owner) ? "skip" : { owner, name: repo },
  );
  const settingsLocked =
    access !== undefined &&
    access !== null &&
    access.permission !== null &&
    !access.canWrite;
  const base = `/${owner}/${repo}`;
  const current = pathname.startsWith(`${base}/baselines`)
    ? "Baselines"
    : pathname === `${base}/settings`
      ? "Settings"
      : "Builds";
  return (
    <SidebarMenuSub className="mr-0 pr-0">
      {PROJECT_PAGES.map(({ label, icon: Icon, to }) => (
        <SidebarMenuSubItem key={label}>
          {label === "Settings" && settingsLocked ? (
            <Tooltip
              side="right"
              label="Only people with write access to this repository on GitHub can change its settings."
            >
              <SidebarMenuSubButton
                aria-disabled
                className="aria-disabled:pointer-events-auto cursor-not-allowed opacity-64"
                render={<button type="button" />}
              >
                <Icon />
                <span>{label}</span>
              </SidebarMenuSubButton>
            </Tooltip>
          ) : (
            <SidebarMenuSubButton
              isActive={current === label}
              render={<Link to={to} params={{ owner, repo }} />}
            >
              <Icon />
              <span>{label}</span>
            </SidebarMenuSubButton>
          )}
        </SidebarMenuSubItem>
      ))}
    </SidebarMenuSub>
  );
}

function AccountsGroup() {
  const accounts = useQuery(api.me.accounts);
  const installUrl = useQuery(api.me.installUrl);
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Accounts</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {accounts === undefined &&
            ["a", "b"].map((key) => (
              <SidebarMenuItem key={key}>
                <MenuSkeleton />
              </SidebarMenuItem>
            ))}
          {accounts?.map((account) => (
            <SidebarMenuItem key={account.login}>
              <SidebarMenuButton
                tooltip={account.login}
                render={<Link to="/$owner" params={{ owner: account.login }} />}
              >
                <Avatar src={accountAvatar(account.login)} size={16} square />
                <span>{account.login}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          {installUrl && (
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Add GitHub account"
                className="text-muted-foreground"
                render={<a href={installUrl} />}
              >
                <PlusIcon />
                <span>Add GitHub account</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function AccountSwitcher({ owner }: { owner: string }) {
  const accounts = useQuery(api.me.accounts);
  const installUrl = useQuery(api.me.installUrl);
  const plan = accounts?.find((account) => account.login === owner)?.plan;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Menu
          label="Switch account"
          width="w-(--anchor-width) min-w-56"
          triggerRender={<SidebarMenuButton size="lg" />}
          trigger={
            <>
              <Avatar src={accountAvatar(owner)} size={32} square />
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate font-medium">{owner}</span>
                <span className="truncate text-muted-foreground text-xs">
                  {plan === undefined ? "Account" : `${PLAN_NAMES[plan]} plan`}
                </span>
              </span>
              <CaretUpDownIcon className="ml-auto text-muted-foreground" />
            </>
          }
        >
          <MenuLinkItem render={<Link to="/install" />}>
            <SquaresFourIcon
              size={18}
              className="shrink-0 text-muted-foreground"
            />
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
                <span className="shrink-0 text-muted-foreground text-xs">
                  {PLAN_NAMES[account.plan]}
                </span>
                {account.login === owner && (
                  <CheckIcon
                    size={14}
                    className="shrink-0 text-muted-foreground"
                  />
                )}
              </MenuLinkItem>
            ))}
          </MenuGroup>
          {installUrl && (
            <>
              <MenuSeparator />
              <MenuLinkItem href={installUrl} className="text-muted-foreground">
                <PlusIcon size={16} className="shrink-0" />
                Add GitHub account
              </MenuLinkItem>
            </>
          )}
        </Menu>
      </SidebarMenuItem>
    </SidebarMenu>
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
  const [theme, setTheme] = useTheme();

  return (
    <Menu
      label="Account menu"
      width="w-(--anchor-width) min-w-56"
      triggerRender={<SidebarMenuButton size="lg" />}
      trigger={
        <>
          <span className="flex size-8 shrink-0 items-center justify-center">
            <Avatar src={viewer?.image} size={24} />
          </span>
          <span className="grid min-w-0 flex-1 text-left leading-tight">
            <span className="truncate font-medium">
              {viewer?.name ?? viewer?.login}
            </span>
            {viewer?.name && (
              <span className="truncate text-muted-foreground text-xs">
                @{viewer.login}
              </span>
            )}
          </span>
          <CaretUpDownIcon className="ml-auto text-muted-foreground" />
        </>
      }
    >
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
      <MenuItem
        onClick={() => void navigate({ to: "/" }).then(() => signOut())}
      >
        <SignOutIcon size={16} className="shrink-0 text-muted-foreground" />
        Sign out
      </MenuItem>
    </Menu>
  );
}
