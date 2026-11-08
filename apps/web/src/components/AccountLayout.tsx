import {
  ArrowUpRightIcon,
  ChartBarIcon,
  CreditCardIcon,
  SquaresFourIcon,
  UsersIcon,
} from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { Button } from "uiofcraft";
import { api, useAction, useQuery } from "../lib/backend";
import { errorCode } from "../lib/errorCode";
import { useDisconnectExpiredGithub } from "../lib/useDisconnectExpiredGithub";
import { AccountBanner } from "./AccountBanner";
import { Page, PageHeader } from "./Page";
import { Tab, Tabs } from "./Tabs";
import { Avatar, accountAvatar, EmptyState } from "./ui";

type AccountTab = "projects" | "members" | "usage" | "billing";

const refreshedRoles = new Set<string>();

function useRoleRefresh(owner: string) {
  const refresh = useAction(api.members.refreshRole);
  const disconnectGithub = useDisconnectExpiredGithub();
  useEffect(() => {
    if (refreshedRoles.has(owner)) {
      return;
    }
    refreshedRoles.add(owner);
    refresh({ login: owner }).catch((error: unknown) => {
      refreshedRoles.delete(owner);
      if (errorCode(error) === "github_token_invalid") {
        void disconnectGithub();
      }
    });
  }, [owner, refresh, disconnectGithub]);
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
            <Button variant="outline" render={<Link to="/install" />}>
              See your accounts
            </Button>
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
            <Button
              variant="outline"
              render={<a href={home.installationSettingsUrl} />}
            >
              Configure on GitHub
              <ArrowUpRightIcon />
            </Button>
          )
        }
      />
      {home !== undefined && <AccountBanner owner={owner} account={home} />}
      <Tabs>
        <Tab
          to="/$owner"
          params={{ owner }}
          icon={SquaresFourIcon}
          label="Overview"
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
          to="/$owner/settings/usage"
          params={{ owner }}
          icon={ChartBarIcon}
          label="Usage"
          active={tab === "usage"}
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
