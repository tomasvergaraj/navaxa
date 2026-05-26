import * as React from "react";
import { cn } from "../lib/utils";

interface LogoMarkProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  variant?: "default" | "mono" | "inverse";
}

export function LogoMark({
  size = 32,
  variant = "default",
  className,
  ...props
}: LogoMarkProps) {
  const bg = variant === "inverse" ? "#FAFAF7" : "#0A0B0E";
  const fg = variant === "inverse" ? "#0A0B0E" : "#FAFAF7";
  const accent = variant === "mono" ? fg : "#C9A961";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="navaxa"
      {...props}
    >
      <rect width="100" height="100" rx="18" fill={bg} />
      <rect x="22" y="22" width="9" height="56" fill={fg} />
      <rect x="69" y="22" width="9" height="56" fill={fg} />
      <polygon points="31,22 40,22 78,78 69,78" fill={accent} />
    </svg>
  );
}

interface LogoWordmarkProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
  showMark?: boolean;
  variant?: "default" | "mono" | "inverse";
}

export function Logo({
  size = 32,
  showMark = true,
  variant = "default",
  className,
  ...props
}: LogoWordmarkProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)} {...props}>
      {showMark && <LogoMark size={size} variant={variant} />}
      <span
        className="font-display text-2xl font-medium tracking-tight"
        style={{ letterSpacing: "-0.025em", lineHeight: 1 }}
      >
        navaxa
      </span>
    </div>
  );
}
