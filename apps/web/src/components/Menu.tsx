import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

const MenuContext = createContext<() => void>(() => {});

export function Menu({
  label,
  trigger,
  triggerClassName,
  align = "start",
  width = "w-56",
  children,
}: {
  label: string;
  trigger: ReactNode;
  triggerClassName: string;
  align?: "start" | "end";
  width?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        className={triggerClassName}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={id}
          className={`absolute top-full z-40 mt-1.5 flex animate-fade flex-col rounded-control bg-surface p-1 text-sm shadow-menu ring-1 ring-border ${width} ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          <MenuContext.Provider value={() => setOpen(false)}>
            {children}
          </MenuContext.Provider>
        </div>
      )}
    </div>
  );
}

export function useCloseMenu() {
  return useContext(MenuContext);
}

export const menuItemClass =
  "flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-text transition-colors duration-100 hover:bg-hover";

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-7 items-center px-2 text-2xs font-medium text-muted">
      {children}
    </div>
  );
}

export function MenuSeparator() {
  return <div className="-mx-1 my-1 h-px bg-border" />;
}
