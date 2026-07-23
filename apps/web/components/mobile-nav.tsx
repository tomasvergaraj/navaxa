"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { MobileNavDrawer } from "./mobile-nav-drawer";

export function MobileNav({
  isBarber = false,
  isManager = false,
}: {
  isBarber?: boolean;
  isManager?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        aria-label="Abrir menú"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Menu className="h-5 w-5" />
      </button>
      <MobileNavDrawer
        open={open}
        onOpenChange={setOpen}
        isBarber={isBarber}
        isManager={isManager}
      />
    </div>
  );
}
