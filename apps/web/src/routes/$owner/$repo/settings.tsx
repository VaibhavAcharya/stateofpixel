import { api } from "@stateofpixel/backend/api";
import type { Id } from "@stateofpixel/backend/dataModel";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAction, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { type ReactNode, useEffect, useId, useState } from "react";
import { AppHeader } from "../../../components/AppHeader";
import { CodeBlock } from "../../../components/CodeBlock";
import { Page } from "../../../components/Page";
import { ProjectHeader } from "../../../components/ProjectHeader";
import { RequireAuth } from "../../../components/RequireAuth";
import {
  buttonClass,
  EmptyState,
  RelativeTime,
  SkeletonRows,
} from "../../../components/ui";
import { useProjectAccess } from "../../../lib/useProjectAccess";

export const Route = createFileRoute("/$owner/$repo/settings")({
  component: SettingsRoute,
});

const INPUT_CLASS =
  "h-8 w-full rounded-md bg-surface px-2.5 text-sm shadow-[inset_0_0_0_1px_var(--color-field-border)] transition-shadow duration-250 ease-standard outline-none placeholder:text-subtle focus:shadow-field-focus aria-invalid:shadow-[inset_0_0_0_1px_var(--color-rejected)]";

const ERRORS: Record<string, string> = {
  invalid_branches: "Use at most 20 patterns of up to 200 characters.",
  invalid_threshold: "Use a number from 0 to 1.",
  invalid_retention: "Use a whole number of days from 7 to 365.",
  invalid_name: "Use a name of 1 to 100 characters.",
  confirm_name_mismatch: "The name does not match.",
};

function errorMessage(error: unknown): string {
  const code =
    error instanceof ConvexError &&
    typeof error.data === "object" &&
    error.data !== null
      ? String(error.data.code)
      : null;
  return (code !== null && ERRORS[code]) || "Could not save. Try again.";
}

function SettingsRoute() {
  const { owner, repo } = Route.useParams();
  return (
    <RequireAuth redirectTo={`/${owner}/${repo}/settings`}>
      <AppHeader owner={owner} repo={repo} />
      <Page>
        <ProjectHeader owner={owner} repo={repo} tab="settings" />
        <SettingsAccess owner={owner} repo={repo} />
      </Page>
    </RequireAuth>
  );
}

function SettingsAccess({ owner, repo }: { owner: string; repo: string }) {
  const result = useProjectAccess(owner, repo);
  if (result.state === "loading") {
    return <SkeletonRows />;
  }
  if (result.state === "not_found") {
    return (
      <EmptyState title="Project not found.">
        The repository may not exist here, or you do not have access to it on
        GitHub.
      </EmptyState>
    );
  }
  if (!result.access.canAdmin) {
    return (
      <EmptyState title="Admins only.">
        You need admin access to this repository on GitHub to change its
        settings.
      </EmptyState>
    );
  }
  return (
    <SettingsForm
      owner={owner}
      repo={repo}
      projectId={result.access.projectId}
    />
  );
}

function SettingsForm({
  owner,
  repo,
  projectId,
}: {
  owner: string;
  repo: string;
  projectId: Id<"projects">;
}) {
  const settings = useQuery(api.projects.settings, { projectId });
  const update = useMutation(api.projects.updateSettings);
  if (!settings) {
    return <SkeletonRows />;
  }
  const save = (changes: Omit<Parameters<typeof update>[0], "projectId">) =>
    update({ projectId, ...changes });

  return (
    <div className="flex max-w-[640px] flex-col">
      <Section title="General">
        <Field label="Default branch" hint="Mirrors GitHub.">
          {() => (
            <p className="mono flex h-8 items-center text-sm">
              {settings.defaultBranch}
            </p>
          )}
        </Field>
        <TextSetting
          label="Auto-approve branches"
          hint="Comma separated globs. Builds on these branches without a PR become baselines."
          value={settings.autoApproveBranches.join(", ")}
          onSave={(value) => save({ autoApproveBranches: value.split(",") })}
        />
      </Section>
      <Section title="Diff">
        <TextSetting
          label="Threshold"
          hint="From 0 to 1. Sent to the CLI with each build."
          inputMode="decimal"
          value={String(settings.diffThreshold)}
          onSave={(value) => save({ diffThreshold: Number(value) })}
        />
        <CheckboxSetting
          label="Count anti-aliased pixels as changes"
          checked={settings.diffIncludeAA}
          onSave={(diffIncludeAA) => save({ diffIncludeAA })}
        />
      </Section>
      <Section title="Checks">
        <Field
          label="Check name"
          hint="Other build names get their own check, like stateofpixel/storybook."
        >
          {() => (
            <p className="mono flex h-8 items-center text-sm">stateofpixel</p>
          )}
        </Field>
      </Section>
      <Section title="Retention">
        <TextSetting
          label="Keep PR-only images for"
          hint="Days, from 7 to 365."
          inputMode="numeric"
          value={String(settings.prRetentionDays)}
          onSave={(value) => save({ prRetentionDays: Number(value) })}
        />
      </Section>
      <Section title="Tokens">
        <Tokens projectId={projectId} />
      </Section>
      <Section title="Danger">
        <DeleteProject owner={owner} repo={repo} projectId={projectId} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-6 border-t border-dotted border-border py-12 first:border-t-0 first:pt-0">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  status,
  children,
}: {
  label: string;
  hint?: string;
  status?: ReactNode;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {status}
      </div>
      {children(id)}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function useSaveStatus() {
  const [status, setStatus] = useState<
    { state: "saved" } | { state: "error"; message: string } | null
  >(null);
  useEffect(() => {
    if (status?.state !== "saved") {
      return;
    }
    const timer = setTimeout(() => setStatus(null), 2000);
    return () => clearTimeout(timer);
  }, [status]);
  const run = (promise: Promise<unknown>) =>
    promise.then(
      () => setStatus({ state: "saved" }),
      (error: unknown) =>
        setStatus({ state: "error", message: errorMessage(error) }),
    );
  const note =
    status === null ? null : status.state === "saved" ? (
      <span className="text-xs text-muted">Saved</span>
    ) : (
      <span role="alert" className="text-xs text-rejected">
        {status.message}
      </span>
    );
  return { run, note, invalid: status?.state === "error" };
}

function TextSetting({
  label,
  hint,
  value,
  inputMode,
  onSave,
}: {
  label: string;
  hint: string;
  value: string;
  inputMode?: "decimal" | "numeric";
  onSave: (value: string) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState(value);
  const { run, note, invalid } = useSaveStatus();
  useEffect(() => setDraft(value), [value]);
  return (
    <Field label={label} hint={hint} status={note}>
      {(id) => (
        <input
          id={id}
          value={draft}
          inputMode={inputMode}
          aria-invalid={invalid}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft.trim() !== value) {
              void run(onSave(draft.trim()));
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          className={`${INPUT_CLASS} ${inputMode ? "mono w-32" : ""}`}
        />
      )}
    </Field>
  );
}

function CheckboxSetting({
  label,
  checked,
  onSave,
}: {
  label: string;
  checked: boolean;
  onSave: (checked: boolean) => Promise<unknown>;
}) {
  const { run, note } = useSaveStatus();
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => void run(onSave(event.target.checked))}
        className="size-4 accent-[var(--color-accent)]"
      />
      {label}
      {note}
    </label>
  );
}

function Tokens({ projectId }: { projectId: Id<"projects"> }) {
  const tokens = useQuery(api.tokens.list, { projectId });
  const create = useAction(api.tokens.create);
  const revoke = useMutation(api.tokens.revoke);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{
    name: string;
    token: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        GitHub Actions signs in with OIDC and needs no token. On other CI, set
        STATEOFPIXEL_TOKEN to a project token.
      </p>
      {created !== null && (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            Copy the token for {created.name} now. It is not shown again.
          </p>
          <CodeBlock fileName="STATEOFPIXEL_TOKEN" code={created.token} />
        </div>
      )}
      <form
        className="flex items-start gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setCreating(true);
          setError(null);
          create({ projectId, name })
            .then((token) => {
              setCreated({ name: name.trim(), token });
              setName("");
            })
            .catch((reason: unknown) => setError(errorMessage(reason)))
            .finally(() => setCreating(false));
        }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <input
            value={name}
            maxLength={100}
            aria-label="Token name"
            aria-invalid={error !== null}
            placeholder="Token name, like buildkite"
            onChange={(event) => setName(event.target.value)}
            className={INPUT_CLASS}
          />
          {error && (
            <p role="alert" className="text-xs text-rejected">
              {error}
            </p>
          )}
        </div>
        <button
          type="submit"
          className={buttonClass()}
          disabled={creating || name.trim() === ""}
        >
          Create token
        </button>
      </form>
      {tokens && tokens.length > 0 && (
        <ul className="border-t border-border">
          {tokens.map((token) => (
            <li
              key={token.id}
              className="flex min-h-11 items-center gap-3 border-b border-border text-sm"
            >
              <span className="min-w-0 flex-1 truncate font-medium">
                {token.name}
              </span>
              <span className="text-xs text-muted">
                {token.lastUsedAt === null ? (
                  "Never used"
                ) : (
                  <>
                    Used <RelativeTime timestamp={token.lastUsedAt} />
                  </>
                )}
              </span>
              <button
                type="button"
                className={buttonClass("danger", "sm")}
                onClick={() => void revoke({ tokenId: token.id })}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DeleteProject({
  owner,
  repo,
  projectId,
}: {
  owner: string;
  repo: string;
  projectId: Id<"projects">;
}) {
  const remove = useMutation(api.projects.remove);
  const navigate = useNavigate();
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        remove({ projectId, confirmName })
          .then(() => navigate({ to: "/$owner", params: { owner } }))
          .catch((reason: unknown) => setError(errorMessage(reason)));
      }}
    >
      <p className="text-sm text-muted">
        Deletes every build, review and token of this project right away. If the
        repository is still in the GitHub App installation, it shows up again as
        an empty project after the next sync.
      </p>
      <Field label={`Type ${repo} to confirm`}>
        {(id) => (
          <input
            id={id}
            value={confirmName}
            aria-invalid={error !== null}
            onChange={(event) => setConfirmName(event.target.value)}
            className={`${INPUT_CLASS} mono`}
          />
        )}
      </Field>
      {error && (
        <p role="alert" className="text-xs text-rejected">
          {error}
        </p>
      )}
      <div>
        <button
          type="submit"
          className={buttonClass("danger")}
          disabled={confirmName !== repo}
        >
          Delete project
        </button>
      </div>
    </form>
  );
}
