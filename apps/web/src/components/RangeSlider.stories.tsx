import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { RangeSlider } from "./RangeSlider";

function Demo() {
  const [value, setValue] = useState(250);
  return (
    <label className="flex w-80 flex-col gap-3 text-sm">
      <span className="flex items-baseline justify-between">
        <span className="text-muted">Stories or pages</span>
        <span className="font-medium tabular-nums">{value}</span>
      </span>
      <RangeSlider
        min={10}
        max={2000}
        step={10}
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        className="w-full"
      />
    </label>
  );
}

const meta = {
  title: "Primitives/RangeSlider",
  component: Demo,
} satisfies Meta<typeof Demo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Light: Story = {};

export const Dark: Story = {
  parameters: { theme: "dark" },
};
