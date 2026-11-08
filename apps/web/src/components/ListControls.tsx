import {
  CaretDownIcon,
  MagnifyingGlassIcon,
  XIcon,
} from "@phosphor-icons/react/ssr";
import { type ReactNode, useEffect, useState } from "react";
import {
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  MenuCheckboxItem,
  MenuRadioGroup,
  MenuRadioItem,
} from "uiofcraft";
import { Menu, MenuSeparator } from "./Menu";

const SEARCH_DELAY_MS = 200;

export function ListToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (draft === value) {
      return;
    }
    const timer = setTimeout(() => onChange(draft), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, value, onChange]);

  return (
    <InputGroup className="w-64 max-sm:w-full">
      <InputGroupAddon>
        <MagnifyingGlassIcon size={14} />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setDraft("");
            onChange("");
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {draft !== "" && (
        <InputGroupAddon align="inline-end">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Clear search"
            onClick={() => {
              setDraft("");
              onChange("");
            }}
          >
            <XIcon size={12} />
          </Button>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}

export function FilterChip({
  icon,
  label,
  value,
  mono = false,
  onClear,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input bg-background pr-1 pl-2.5 text-xs shadow-xs/5 sm:h-8 dark:bg-input/32">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className={`max-w-60 truncate ${mono ? "mono" : "font-medium"}`}>
        {value}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Clear ${label.toLowerCase()} filter`}
        onClick={onClear}
      >
        <XIcon size={12} />
      </Button>
    </span>
  );
}

export function SelectMenu<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value | undefined;
  options: { value: Value | undefined; label: string }[];
  onChange: (value: Value | undefined) => void;
}) {
  const current = options.find((option) => option.value === value);
  return (
    <Menu
      label={label}
      width="w-48"
      triggerRender={<Button variant="outline" />}
      triggerClassName={value === undefined ? undefined : "text-foreground"}
      trigger={
        <>
          <span className="text-muted-foreground">{label}</span>
          {current?.label}
          <CaretDownIcon size={12} className="text-muted-foreground" />
        </>
      }
    >
      <MenuRadioGroup
        value={current?.label}
        onValueChange={(selected: string) =>
          onChange(options.find((option) => option.label === selected)?.value)
        }
      >
        {options.map((option) => (
          <MenuRadioItem key={option.label} value={option.label} closeOnClick>
            {option.label}
          </MenuRadioItem>
        ))}
      </MenuRadioGroup>
    </Menu>
  );
}

export function MultiSelectMenu<Value extends string>({
  label,
  values,
  options,
  defaultValues,
  onChange,
}: {
  label: string;
  values: Value[];
  options: { value: Value; label: string }[];
  defaultValues: Value[];
  onChange: (values: Value[]) => void;
}) {
  const labels = (selected: Value[]) =>
    options
      .filter((option) => selected.includes(option.value))
      .map((option) => option.label);
  const isDefault =
    values.length === defaultValues.length &&
    defaultValues.every((value) => values.includes(value));
  const isAll = values.length === options.length;
  const selectedLabels = labels(values);
  const summary = isDefault
    ? "Default"
    : isAll
      ? "All"
      : selectedLabels.length <= 4
        ? selectedLabels.join(", ")
        : `${selectedLabels.length} selected`;
  const defaultLabel = `Default (${labels(defaultValues).join(", ")})`;
  return (
    <Menu
      label={label}
      width="w-64"
      triggerRender={<Button variant="outline" />}
      triggerClassName="max-w-80 text-foreground"
      trigger={
        <>
          <span className="text-muted-foreground">{label}</span>
          <span className="min-w-0 truncate">{summary}</span>
          <CaretDownIcon size={12} className="shrink-0 text-muted-foreground" />
        </>
      }
    >
      <MenuRadioGroup
        value={isDefault ? "default" : isAll ? "all" : null}
        onValueChange={(selected: "default" | "all") =>
          onChange(
            selected === "default"
              ? defaultValues
              : options.map((option) => option.value),
          )
        }
      >
        <MenuRadioItem
          value="default"
          title={defaultLabel}
          className="grid-cols-[.75rem_minmax(0,1fr)]"
        >
          <span className="block truncate">{defaultLabel}</span>
        </MenuRadioItem>
        <MenuRadioItem value="all">All</MenuRadioItem>
      </MenuRadioGroup>
      <MenuSeparator />
      {options.map((option) => {
        const checked = values.includes(option.value);
        return (
          <MenuCheckboxItem
            key={option.value}
            checked={checked}
            disabled={checked && values.length === 1}
            onCheckedChange={() =>
              onChange(
                checked
                  ? values.filter((value) => value !== option.value)
                  : options
                      .map((item) => item.value)
                      .filter(
                        (value) =>
                          value === option.value || values.includes(value),
                      ),
              )
            }
          >
            {option.label}
          </MenuCheckboxItem>
        );
      })}
    </Menu>
  );
}
