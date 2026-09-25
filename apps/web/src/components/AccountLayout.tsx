import { useAuthActions } from "@convex-dev/auth/react";
import {
  ArrowUpRightIcon,
  CreditCardIcon,
  SquaresFourIcon,
  UsersIcon,
} from "@phosphor-icons/react/ssr";
import { api } from "@stateofpixel/backend/api";
import { Link } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { type ReactNode, useEffect } from "react";
import { errorCode } from "../lib/errorCode";
import { Page, PageHeader } from "./Page";
import { StorageBanner } from "./StorageBanner";
import { Tab, Tabs } from "./Tabs";
import { Avatar, accountAvatar, buttonClass, EmptyState } from "./ui";

type AccountTab = "projects" | "members" | "billing";

const refreshedRoles = new Set<string>();

function useRoleRefresh(owner: string) {
  const refresh = useAction(api.members.refreshRole);
  const { signOut } = useAuthActions();
  useEffect(() => {
    if (refreshedRoles.has(owner)) {
      return;
    }
    refreshedRoles.add(owner);
    refresh({ login: owner }).catch((error: unknown) => {
      refreshedRoles.delete(owner);
      if (errorCode(error) === "github_token_invalid") {
        void signOut();
      }
    });
  }, [owner, refresh, signOut]);
}

export function AccountLayout({
  owner,
  tab,
  children,
}: {
  owner: string;
  tab: AccountTab;
  children: ReactNode;
}) {
  const home = useQuery(api.accounts.home, { login: owner });
  useRoleRefresh(owner);

  if (home === null) {
    return (
      <Page>
        <EmptyState
          title="Account not found."
          action={
            <Link to="/install" className={buttonClass()}>
              See your accounts
            </Link>
          }
        >
          It may not have the GitHub App installed, or you are not a member.
        </EmptyState>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        leading={<Avatar src={accountAvatar(owner)} size={40} square />}
        title={owner}
        meta={
          home === undefined
            ? "Loading"
            : home.type === "org"
              ? "Organization"
              : "Personal account"
        }
        actions={
          home?.installationSettingsUrl && (
            <a href={home.installationSettingsUrl} className={buttonClass()}>
              Configure on GitHub
              <ArrowUpRightIcon size={14} className="text-muted" />
            </a>
          )
        }
      />
      {home !== undefined && (
        <StorageBanner owner={owner} storage={home.storage} />
      )}
      <Tabs>
        <Tab
          to="/$owner"
          params={{ owner }}
          icon={SquaresFourIcon}
          label="Projects"
          active={tab === "projects"}
        />
        <Tab
          to="/$owner/settings/members"
          params={{ owner }}
          icon={UsersIcon}
          label="Members"
          active={tab === "members"}
        />
        <Tab
          to="/$owner/settings/billing"
          params={{ owner }}
          icon={CreditCardIcon}
          label="Billing"
          active={tab === "billing"}
        />
      </Tabs>
      {children}
    </Page>
  );
}
