import { cn } from "@/lib/utils";
import { Icon } from "@/components/icons";

export function Checkbox({
  className,
  checked,
  onCheckedChange,
  id,
  label,
  description,
  disabled,
}: {
  className?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  label?: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <span className="relative mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="peer h-4.5 w-4.5 appearance-none rounded border border-border-strong bg-card transition-colors checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed"
        />
        <Icon
          name="check"
          size={12}
          strokeWidth={3}
          className="pointer-events-none absolute hidden text-white peer-checked:block"
        />
      </span>
      {(label || description) && (
        <span className="grid gap-0.5">
          {label && <span className="text-sm font-medium">{label}</span>}
          {description && (
            <span className="text-xs text-muted-foreground">{description}</span>
          )}
        </span>
      )}
    </label>
  );
}