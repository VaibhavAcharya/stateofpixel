import {
  CheckCircleIcon,
  CircleIcon,
  GitPullRequestIcon,
} from "@phosphor-icons/react/ssr";
import { buttonClass } from "../ui";

const CHECKS: { name: string; title: string; done: boolean }[] = [
  { name: "ci/lint", title: "Successful in 41s", done: true },
  { name: "ci/test", title: "Successful in 2m", done: true },
  {
    name: "stateofpixel/playwright",
    title: "5 changes to review",
    done: false,
  },
];

export function HeroChecks() {
  return (
    <div className="w-[560px] overflow-hidden rounded-lg bg-surface shadow-[0_8px_32px_#11151a18,0_1px_4px_#11151a0a] ring-1 ring-border">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <GitPullRequestIcon size={18} className="text-approved" />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">
            Tighten pricing cards <span className="text-muted">#412</span>
          </span>
          <span className="block text-xs text-muted">
            <span className="mono">pricing-cards</span> into{" "}
            <span className="mono">main</span>
          </span>
        </span>
      </div>
      <ul className="divide-y divide-border">
        {CHECKS.map((check) => (
          <li key={check.name} className="flex items-center gap-3 px-4 py-3">
            {check.done ? (
              <CheckCircleIcon
                size={18}
                weight="fill"
                className="text-approved"
              />
            ) : (
              <CircleIcon size={18} weight="bold" className="text-pending" />
            )}
            <span className="min-w-0 flex-1 text-sm">
              <span className="font-medium">{check.name}</span>
              <span className="text-muted"> {check.title}</span>
            </span>
            {!check.done && <span className="text-xs text-link">Review</span>}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3 border-t border-border bg-bg px-4 py-3">
        <span className="text-xs text-muted">
          Merges when every change is approved
        </span>
        <span className={`${buttonClass("primary")} ml-auto opacity-45`}>
          Merge
        </span>
      </div>
    </div>
  );
}
