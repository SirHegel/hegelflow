import { cn, initials } from "@/lib/utils";

type AvatarProps = {
  name: string;
  color?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  xs: "size-6 text-[9px]",
  sm: "size-8 text-[11px]",
  md: "size-10 text-xs",
  lg: "size-12 text-sm",
};

export function Avatar({ name, color = "#6d5dfc", size = "md", className }: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white",
        sizes[size],
        className,
      )}
      style={{ backgroundColor: color ?? "#6d5dfc" }}
      title={name}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}

