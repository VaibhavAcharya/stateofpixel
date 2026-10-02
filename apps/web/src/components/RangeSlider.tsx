import type { ComponentProps, CSSProperties } from "react";

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
  className = "",
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
      className={`range-slider ${className}`}
      style={{ "--range-fill": `${fill}%`, ...style } as CSSProperties}
    />
  );
}
