import { GitBranchIcon, GitPullRequestIcon } from "@phosphor-icons/react/ssr";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, userEvent, within } from "storybook/test";
import { withMenuRoom } from "../lib/storyFixtures";
import {
  FilterChip,
  ListToolbar,
  MultiSelectMenu,
  SearchField,
  SelectMenu,
} from "./ListControls";
import { buttonClass } from "./ui";

const meta = {
  title: "App/List controls",
  component: ListToolbar,
  args: { children: null },
} satisfies Meta<typeof ListToolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

const STATES = [
  { value: "to_review", label: "To review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "no_changes", label: "No changes" },
  { value: "pending", label: "Pending" },
  { value: "expired", label: "Expired" },
  { value: "error", label: "Error" },
];

const DEFAULT_STATES = [
  "to_review",
  "approved",
  "rejected",
  "pending",
  "error",
];

function BuildFilters({ states }: { states: string[] }) {
  return (
    <ListToolbar>
      <MultiSelectMenu
        label="Filter"
        values={states}
        options={STATES}
        defaultValues={DEFAULT_STATES}
        onChange={fn()}
      />
      <FilterChip
        icon={<GitBranchIcon size={14} />}
        label="Branch"
        value="feat/billing"
        mono
        onClear={fn()}
      />
      <FilterChip
        icon={<GitPullRequestIcon size={14} />}
        label="Pull request"
        value="#88"
        onClear={fn()}
      />
      <button type="button" className={buttonClass("ghost")}>
        Clear filters
      </button>
    </ListToolbar>
  );
}

export const Builds: Story = {
  render: () => <BuildFilters states={DEFAULT_STATES} />,
};

export const BuildsFilterOpen: Story = {
  decorators: [withMenuRoom],
  render: () => <BuildFilters states={["to_review", "rejected"]} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Filter" }),
    );
  },
};

export const BuildsFilterAll: Story = {
  render: () => <BuildFilters states={STATES.map((state) => state.value)} />,
};

function Baselines({ query }: { query: string }) {
  return (
    <ListToolbar>
      <SearchField
        value={query}
        placeholder="Name starts with"
        onChange={fn()}
      />
      <SelectMenu
        label="Suite"
        value="web"
        options={[
          { value: undefined, label: "All" },
          { value: "web", label: "web" },
          { value: "storybook", label: "storybook" },
        ]}
        onChange={fn()}
      />
    </ListToolbar>
  );
}

export const Search: Story = { render: () => <Baselines query="" /> };

export const SearchFilled: Story = {
  render: () => <Baselines query="Button/" />,
};

export const SuiteMenuOpen: Story = {
  decorators: [withMenuRoom],
  render: () => <Baselines query="" />,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Suite" }),
    );
  },
};

export const Dark: Story = {
  ...BuildsFilterOpen,
  parameters: { theme: "dark" },
};
