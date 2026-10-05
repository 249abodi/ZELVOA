import { cn } from "@/lib/utils";

export const ZELVOA_MARK_GRADIENT = ["#6d28d9", "#2563eb"] as const;

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
      viewBox="0 0 100 100"
      fill="none"
      className={cn("shrink-0", className)}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
    >
      <defs>
        <linearGradient id="zelvoa-mark-purple" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={ZELVOA_MARK_GRADIENT[0]} />
          <stop offset="1" stopColor="#4f13b5" />
        </linearGradient>
        <linearGradient id="zelvoa-mark-blue" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#18b7f5" />
          <stop offset="1" stopColor={ZELVOA_MARK_GRADIENT[1]} />
        </linearGradient>
      </defs>
      <path d="M4 21 29 1l35 11-16 14-20-7L4 34z" fill="url(#zelvoa-mark-blue)" />
      <path d="M64 12 84 1v25L61 48 45 40z" fill="url(#zelvoa-mark-purple)" />
      <path d="m29 19 19 7-18 21 23 8-15 16-22-11L4 53 25 31z" fill="#2563eb" />
      <path d="m4 34 21-3-21 22z" fill="#18b7f5" />
      <path d="m38 71 15-16 31 10v23L61 77 35 99 4 87l17-21z" fill="url(#zelvoa-mark-purple)" />
      <path d="m53 55 8-7 23-22v25L53 78z" fill="url(#zelvoa-mark-blue)" />
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
