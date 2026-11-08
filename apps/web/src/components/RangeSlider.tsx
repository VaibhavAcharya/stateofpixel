import type { ComponentProps, CSSProperties } from "react";
import { cn } from "uiofcraft";

type RangeSliderProps = Omit<
  ComponentProps<"input">,
  "type" | "value" | "min" | "max"
> & {
  value: number;
  min: number;
  max: number;
};

export function RangeSlider({
  value,
  min,
  max,
  className,
  style,
  ...props
}: RangeSliderProps) {
  const fill = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <input
      {...props}
      type="range"
      value={value}
      min={min}
      max={max}
      className={cn(
        "range-slider [&::-moz-range-thumb]:box-border [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-input [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-xs/5 [&::-webkit-slider-thumb]:box-border [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-input [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:bg-clip-padding [&::-webkit-slider-thumb]:shadow-xs/5 focus-visible:[&::-moz-range-thumb]:outline-none focus-visible:[&::-moz-range-thumb]:ring-[3px] focus-visible:[&::-moz-range-thumb]:ring-ring/24 focus-visible:[&::-webkit-slider-thumb]:outline-none focus-visible:[&::-webkit-slider-thumb]:ring-[3px] focus-visible:[&::-webkit-slider-thumb]:ring-ring/24 dark:[&::-moz-range-thumb]:border-background dark:[&::-webkit-slider-thumb]:border-background",
        className,
      )}
      style={{ "--range-fill": `${fill}%`, ...style } as CSSProperties}
    />
  );
}
