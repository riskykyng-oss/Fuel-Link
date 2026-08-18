import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "../icons";
import type { IconName } from "../icons";
import { cn } from "../cn";

export type ButtonVariant = "primary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  icon?: IconName;
  children: ReactNode;
}

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-control px-4 min-h-11 text-sm font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-text";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-lime text-lime-ink hover:bg-lime/90 focus-visible:outline-lime-ink",
  ghost: "border border-border bg-transparent text-text hover:bg-surface",
  danger: "bg-danger text-base hover:bg-danger/90 focus-visible:outline-lime-ink",
};

/** Action button. lime = primary only; decline/back actions use ghost. */
export function Button({
  variant = "primary",
  fullWidth = false,
  icon,
  children,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(BASE, VARIANTS[variant], fullWidth && "w-full", className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}

interface MoneyProps {
  amountUsd: number;
}

/** Always used for USD amounts; tabular figures for stable columns. */
export function Money({ amountUsd }: MoneyProps) {
  return <span className="tabular-nums">${amountUsd.toFixed(2)}</span>;
}
