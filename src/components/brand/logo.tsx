import { cn } from "@/lib/utils";

/**
 * ZELVOA brand mark geometry.
 * Path data is the exact artwork from src/app/icon.svg — do not redraw.
 */
export const ZELVOA_MARK_PATH = "M10 9h12l-12 14h12";
export const ZELVOA_MARK_GRADIENT = ["#7c63f7", "#2563eb"] as const;

export interface ZelvoaMarkProps {
  size?: number;
  className?: string;
  label?: string;
  decorative?: boolean;
}

export function ZelvoaMark({
  size = 32,
  className,
  label = "ZELVOA",
  decorative = false,
}: ZelvoaMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn("shrink-0", className)}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
    >
      <defs>
        <linearGradient
          id="zelvoa-brand-gradient"
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={ZELVOA_MARK_GRADIENT[0]} />
          <stop offset="1" stopColor={ZELVOA_MARK_GRADIENT[1]} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#zelvoa-brand-gradient)" />
      <path
        d={ZELVOA_MARK_PATH}
        stroke="#ffffff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface ZelvoaWordmarkProps {
  className?: string;
  as?: "span" | "h1" | "h2" | "h3" | "div";
}

export function ZelvoaWordmark({
  className,
  as: Tag = "span",
}: ZelvoaWordmarkProps) {
  return (
    <Tag
      className={cn(
        "select-none font-bold tracking-tight text-brand-foreground",
        className
      )}
    >
      ZELVOA
    </Tag>
  );
}

export type ZelvoaLogoVariant = "full" | "compact" | "mark" | "wordmark";

export interface ZelvoaLogoProps {
  variant?: ZelvoaLogoVariant;
  size?: number;
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}

/**
 * Reusable ZELVOA logo. The mark preserves the approved aspect ratio
 * (1:1 viewBox) — it is never stretched or squeezed by this component.
 */
export function ZelvoaLogo({
  variant = "full",
  size = 32,
  className,
  markClassName,
  wordmarkClassName,
}: ZelvoaLogoProps) {
  if (variant === "mark") {
    return <ZelvoaMark size={size} className={markClassName} />;
  }

  if (variant === "wordmark") {
    return <ZelvoaWordmark className={wordmarkClassName} />;
  }

  const isFull = variant === "full";
  const markSize = isFull ? size : Math.round(size * 0.9);

  return (
    <span
      className={cn("inline-flex items-center", isFull ? "gap-2.5" : "gap-2", className)}
    >
      <ZelvoaMark size={markSize} decorative className={markClassName} />
      <ZelvoaWordmark
        className={cn(isFull ? "text-xl" : "text-base", wordmarkClassName)}
      />
    </span>
  );
}