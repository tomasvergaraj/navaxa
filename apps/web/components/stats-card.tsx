import { Card } from "@navaxa/ui";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: string;
  trend?: { value: string; positive?: boolean };
  icon?: LucideIcon;
  className?: string;
}

export function StatsCard({ label, value, trend, icon: Icon, className }: StatsCardProps) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex min-h-8 items-start justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-xl font-medium tabular-nums tracking-tight sm:text-2xl">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "shrink-0 text-xs font-medium",
              trend.positive
                ? "text-green-700 dark:text-green-400"
                : "text-red-700 dark:text-red-400",
            )}
          >
            {trend.value}
          </span>
        )}
      </div>
    </Card>
  );
}
