import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/app/components/Icons";

const PANEL =
  "absolute z-20 overflow-hidden rounded-xl border border-edge bg-surface shadow-lg shadow-black/50";

/**
 * Click-outside backdrop + positioned panel for action menus and pickers.
 * @param open - Whether the menu is shown.
 * @param onClose - Called when the backdrop is clicked.
 * @param className - Positioning / size classes on the panel (e.g. `right-0 top-8 min-w-40`).
 * @param children - Usually `MenuItem`s or custom picker content.
 */
export function Menu({
  open,
  onClose,
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className={[PANEL, className].filter(Boolean).join(" ")}>
        {children}
      </div>
    </>
  );
}

const ITEM =
  "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-background disabled:opacity-40";

type ItemCommon = {
  icon?: IconName;
  destructive?: boolean;
  className?: string;
  children: ReactNode;
};

type ItemButton = ItemCommon &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };

type ItemLink = ItemCommon &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> & {
    href: string;
  };

/**
 * Menu row — button by default, or link when `href` is set.
 * @param icon - Optional leading icon name.
 * @param destructive - Styles the row in blood red.
 */
export function MenuItem(props: ItemButton | ItemLink) {
  const {
    icon,
    destructive,
    className = "",
    children,
  } = props;
  const classes = [
    ITEM,
    destructive ? "text-blood" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const content = (
    <>
      {icon && <Icon name={icon} className="size-4" />}
      {children}
    </>
  );

  if ("href" in props && props.href != null) {
    const {
      icon: _i,
      destructive: _d,
      className: _c,
      children: _ch,
      ...anchorProps
    } = props;
    // internal routes get client-side nav, mirroring Button's href handling
    if (props.href.startsWith("/")) {
      return (
        <Link {...anchorProps} href={props.href} className={classes}>
          {content}
        </Link>
      );
    }
    return (
      <a {...anchorProps} className={classes}>
        {content}
      </a>
    );
  }

  const {
    icon: _i,
    destructive: _d,
    className: _c,
    children: _ch,
    href: _h,
    ...btnProps
  } = props as ItemButton;
  return (
    <button type="button" {...btnProps} className={classes}>
      {content}
    </button>
  );
}
