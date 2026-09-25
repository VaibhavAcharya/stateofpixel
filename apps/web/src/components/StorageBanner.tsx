import { WarningIcon } from "@phosphor-icons/react/ssr";
import {
  formatGigabytes,
  graceEndsAt,
  type StorageUsage,
  storageState,
} from "@stateofpixel/backend/storage";
import { SUPPORT_EMAIL } from "../lib/supportEmail";

export function StorageBanner({ storage }: { storage: StorageUsage }) {
  const now = Date.now();
  const state = storageState(storage, now);
  if (state === "ok") {
    return null;
  }
  const limit = formatGigabytes(storage.storageLimitBytes);
  const message =
    state === "warning"
      ? `${formatGigabytes(storage.storageBytes)} of ${limit} storage used.`
      : state === "grace"
        ? `Storage limit of ${limit} reached. From ${new Date(
            graceEndsAt(storage.overLimitSince ?? now),
          ).toLocaleDateString("en-US", {
            dateStyle: "medium",
          })}, new images are not stored and changes are not compared.`
        : `Storage limit of ${limit} reached. New images are not stored and changes are not compared.`;
  return (
    <p
      className={`mb-6 flex min-h-9 items-center gap-2 rounded-md px-3 py-2 text-sm ${
        state === "warning" ? "bg-changed-bg" : "bg-failed-bg"
      }`}
    >
      <WarningIcon
        size={16}
        className={`shrink-0 ${state === "warning" ? "text-changed" : "text-failed"}`}
      />
      <span>
        {message} Lower retention in project settings to free space, or write to{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="font-medium text-link"
          data-umami-event="Email"
        >
          {SUPPORT_EMAIL}
        </a>{" "}
        for a bigger plan.
      </span>
    </p>
  );
}
