"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Tabs } from "@navaxa/ui";

/**
 * Tabs que persisten la pestaña activa en la URL (?tab=x): recargar o
 * compartir el link conserva la tab, cosa que `defaultValue` solo no logra.
 */
export function UrlTabs({
  defaultValue,
  param = "tab",
  children,
  className,
}: {
  defaultValue: string;
  param?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(param) ?? defaultValue;

  function onChange(v: string) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set(param, v);
    router.replace(`${pathname}?${sp}`, { scroll: false });
  }

  return (
    <Tabs value={value} onValueChange={onChange} className={className}>
      {children}
    </Tabs>
  );
}
