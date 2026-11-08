import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useState,
} from "react";
import { MenuPopup, Menu as MenuRoot, MenuTrigger } from "uiofcraft";

const MenuContext = createContext<() => void>(() => {});

export function Menu({
  label,
  trigger,
  triggerClassName,
  triggerRender,
  align = "start",
  width = "w-56",
  children,
}: {
  label: string;
  trigger: ReactNode;
  triggerClassName?: string;
  triggerRender?: ReactElement;
  align?: "start" | "end";
  width?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <MenuRoot open={open} onOpenChange={setOpen}>
      <MenuTrigger
        aria-label={label}
        className={triggerClassName}
        render={triggerRender}
      >
        {trigger}
      </MenuTrigger>
      <MenuPopup align={align} className={`text-sm ${width}`}>
        <MenuContext.Provider value={() => setOpen(false)}>
          {children}
        </MenuContext.Provider>
      </MenuPopup>
    </MenuRoot>
  );
}

export function useCloseMenu() {
  return useContext(MenuContext);
}

export const menuItemClass =
  "flex min-h-8 w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-base text-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground sm:min-h-7 sm:text-sm";

export {
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuLinkItem,
  MenuSeparator,
} from "uiofcraft";
