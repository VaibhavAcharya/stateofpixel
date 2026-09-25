import { EmptyState } from "../ui";

export function BuildNotFound({ title }: { title: string }) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 max-sm:px-4">
      <EmptyState title={title}>
        It may not exist, or you do not have access to the repository on GitHub.
      </EmptyState>
    </div>
  );
}
