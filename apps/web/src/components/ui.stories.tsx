import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { avatar } from "../lib/storyFixtures";
import {
  Avatar,
  BuildStatePill,
  buttonClass,
  DIFF_ICONS,
  DiffStatusPill,
  EmptyState,
  Kbd,
  Pill,
  ProjectNotFound,
  REVIEW_ICONS,
  Skeleton,
  SkeletonRows,
  SnapshotName,
  Spinner,
  SupersededPill,
  Tooltip,
  Wordmark,
} from "./ui";

const meta = {
  title: "Primitives",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-28 shrink-0 text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}

const counts = { pending: 5, changed: 4, added: 1, rejected: 2 };
const shards = { done: 1, total: 1 };

export const Pills: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Row label="Diff status">
        {(["unchanged", "changed", "added", "removed", "failed"] as const).map(
          (status) => (
            <DiffStatusPill key={status} status={status} />
          ),
        )}
      </Row>
      <Row label="Review state">
        {(
          [
            ["pending", "Pending"],
            ["approved", "Approved"],
            ["rejected", "Rejected"],
          ] as const
        ).map(([state, label]) => (
          <Pill key={state} tone={state} icon={REVIEW_ICONS[state]}>
            {label}
          </Pill>
        ))}
      </Row>
      <Row label="Build">
        <BuildStatePill
          status="finalized"
          conclusion="changes"
          counts={counts}
          shards={shards}
          storageBlocked={false}
        />
        <BuildStatePill
          status="finalized"
          conclusion="approved"
          counts={counts}
          shards={shards}
          storageBlocked={false}
        />
        <BuildStatePill
          status="finalized"
          conclusion="rejected"
          counts={counts}
          shards={shards}
          storageBlocked={false}
        />
        <BuildStatePill
          status="finalized"
          conclusion="no_changes"
          counts={counts}
          shards={shards}
          storageBlocked={false}
        />
        <BuildStatePill
          status="finalized"
          conclusion="changes"
          counts={counts}
          shards={shards}
          storageBlocked
        />
      </Row>
      <Row label="Build, not done">
        <BuildStatePill
          status="pending"
          conclusion={null}
          counts={counts}
          shards={shards}
          storageBlocked={false}
        />
        <BuildStatePill
          status="pending"
          conclusion={null}
          counts={counts}
          shards={{ done: 2, total: 4 }}
          storageBlocked={false}
        />
        <BuildStatePill
          status="expired"
          conclusion={null}
          counts={counts}
          shards={shards}
          storageBlocked={false}
        />
        <BuildStatePill
          status="error"
          conclusion={null}
          counts={counts}
          shards={shards}
          storageBlocked={false}
        />
        <SupersededPill />
      </Row>
      <Row label="Icons">
        {Object.entries({ ...DIFF_ICONS, ...REVIEW_ICONS }).map(
          ([name, Icon]) => (
            <Icon key={name} size={16} />
          ),
        )}
        <Spinner size={16} />
      </Row>
    </div>
  ),
};

export const PillsDark: Story = { ...Pills, parameters: { theme: "dark" } };

const VARIANTS = ["primary", "secondary", "ghost", "danger"] as const;

export const Buttons: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {VARIANTS.map((variant) => (
        <Row key={variant} label={variant}>
          <button type="button" className={buttonClass(variant)}>
            Approve all
          </button>
          <button type="button" className={buttonClass(variant, "sm")}>
            Small
          </button>
          <button type="button" className={buttonClass(variant)} disabled>
            Disabled
          </button>
          <button type="button" className={buttonClass(variant)} aria-disabled>
            Locked
          </button>
        </Row>
      ))}
      <Row label="Keys">
        <Kbd>a</Kbd>
        <Kbd>shift</Kbd>
        <span className={buttonClass("primary")}>
          Approve <Kbd inverted>a</Kbd>
        </span>
      </Row>
    </div>
  ),
};

export const ButtonsDark: Story = { ...Buttons, parameters: { theme: "dark" } };

export const TooltipOpen: Story = {
  render: () => (
    <div className="min-h-32">
      <Tooltip label="Only owners of acme on GitHub can change the plan and billing.">
        <button type="button" aria-disabled className={buttonClass("primary")}>
          Upgrade
        </button>
      </Tooltip>
    </div>
  ),
  play: async ({ canvasElement }) => {
    canvasElement.querySelector("button")?.focus();
  },
};

export const Identity: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Row label="Wordmark">
        <Wordmark />
      </Row>
      <Row label="Avatars">
        <Avatar src={avatar("octocat")} size={24} />
        <Avatar src={avatar("acme")} size={20} square />
        <Avatar src={null} size={24} />
      </Row>
      <Row label="Snapshot names">
        <div className="flex w-72 flex-col gap-1 text-sm">
          <SnapshotName name="Button/Primary [chromium 1280]" />
          <SnapshotName name="landing" />
          <SnapshotName name="Settings/Billing/Plans and invoices with a very long name [chromium 375]" />
        </div>
      </Row>
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-56" />
      <SkeletonRows rows={4} />
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <EmptyState title="No baseline yet.">
      Baselines come from approved builds on <span className="mono">main</span>.
      Merge a change or push to main to create one.
    </EmptyState>
  ),
};

export const ProjectMissing: Story = { render: () => <ProjectNotFound /> };
