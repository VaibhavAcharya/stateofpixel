import {
  CaretDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  XIcon,
} from "@phosphor-icons/react/ssr";
import { type ReactNode, useEffect, useState } from "react";
import { Menu, MenuSeparator, menuItemClass, useCloseMenu } from "./Menu";
import { buttonClass } from "./ui";

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
    <label className="relative flex w-64 items-center max-sm:w-full">
      <MagnifyingGlassIcon
        size={14}
        className="pointer-events-none absolute left-2.5 text-subtle"
      />
      <input
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
        className="h-8 w-full rounded-md bg-surface pr-8 pl-8 text-sm shadow-[inset_0_0_0_1px_var(--color-border)] transition-shadow duration-250 ease-standard outline-none placeholder:text-subtle hover:shadow-[inset_0_0_0_1px_var(--color-field-border)] focus:shadow-field-focus [&::-webkit-search-cancel-button]:hidden"
      />
      {draft !== "" && (
        <button
          type="button"
          aria-label="Clear search"
          className={`absolute right-1 ${buttonClass("ghost", "icon-sm")}`}
          onClick={() => {
            setDraft("");
            onChange("");
          }}
        >
          <XIcon size={12} />
        </button>
      )}
    </label>
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
    <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-surface pr-1 pl-2.5 text-xs shadow-[inset_0_0_0_1px_var(--color-border)]">
      <span className="text-muted">{icon}</span>
      <span className="text-muted">{label}</span>
      <span className={`max-w-60 truncate ${mono ? "mono" : "font-medium"}`}>
        {value}
      </span>
      <button
        type="button"
        aria-label={`Clear ${label.toLowerCase()} filter`}
        className={buttonClass("ghost", "icon-sm")}
        onClick={onClear}
      >
        <XIcon size={12} />
      </button>
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
      triggerClassName={`${buttonClass()} ${value === undefined ? "" : "text-text"}`}
      trigger={
        <>
          <span className="text-muted">{label}</span>
          {current?.label}
          <CaretDownIcon size={12} className="text-muted" />
        </>
      }
    >
      {options.map((option) => (
        <SelectMenuItem
          key={option.label}
          selected={option.value === value}
          onSelect={() => onChange(option.value)}
        >
          {option.label}
        </SelectMenuItem>
      ))}
    </Menu>
  );
}

function SelectMenuItem({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  const close = useCloseMenu();
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      className={menuItemClass}
      onClick={() => {
        onSelect();
        close();
      }}
    >
      <span className="flex-1">{children}</span>
      {selected && <CheckIcon size={14} className="text-muted" />}
    </button>
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
      triggerClassName={`${buttonClass()} max-w-80 text-text`}
      trigger={
        <>
          <span className="text-muted">{label}</span>
          <span className="min-w-0 truncate">{summary}</span>
          <CaretDownIcon size={12} className="shrink-0 text-muted" />
        </>
      }
    >
      <button
        type="button"
        role="menuitemradio"
        aria-checked={isDefault}
        title={defaultLabel}
        className={menuItemClass}
        onClick={() => onChange(defaultValues)}
      >
        <span className="min-w-0 flex-1 truncate">{defaultLabel}</span>
        {isDefault && <CheckIcon size={14} className="shrink-0 text-muted" />}
      </button>
      <button
        type="button"
        role="menuitemradio"
        aria-checked={isAll}
        className={menuItemClass}
        onClick={() => onChange(options.map((option) => option.value))}
      >
        <span className="flex-1">All</span>
        {isAll && <CheckIcon size={14} className="text-muted" />}
      </button>
      <MenuSeparator />
      {options.map((option) => {
        const checked = values.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            role="menuitemcheckbox"
            aria-checked={checked}
            disabled={checked && values.length === 1}
            className={`${menuItemClass} disabled:opacity-45`}
            onClick={() =>
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
            <span className="flex-1">{option.label}</span>
            {checked && <CheckIcon size={14} className="text-muted" />}
          </button>
        );
      })}
    </Menu>
  );
}
