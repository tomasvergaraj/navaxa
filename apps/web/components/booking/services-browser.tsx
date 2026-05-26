"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Clock, Search } from "lucide-react";
import { Button, Input, cn } from "@navaxa/ui";
import { formatCLP, formatDuration } from "@/lib/format";

interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  price: number;
  category: string | null;
}

const OTHER = "Otros";

export function ServicesBrowser({ slug, services }: { slug: string; services: Service[] }) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("Todos");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of services) set.add(s.category || OTHER);
    return [...set];
  }, [services]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((s) => {
      const cat = s.category || OTHER;
      if (activeCat !== "Todos" && cat !== activeCat) return false;
      if (q && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [services, query, activeCat]);

  const groups = useMemo(() => {
    const map = new Map<string, Service[]>();
    for (const s of filtered) {
      const cat = s.category || OTHER;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    }
    return [...map.entries()];
  }, [filtered]);

  function toggle(cat: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      {/* Sidebar: buscador + categorías */}
      <aside className="space-y-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="¿Qué servicio buscas?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <nav className="flex gap-2 overflow-x-auto md:flex-col md:gap-0.5">
          {["Todos", ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              className={cn(
                "shrink-0 rounded-md px-3 py-2 text-left text-sm transition-colors md:w-full",
                activeCat === cat
                  ? "bg-accent/15 font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {cat}
            </button>
          ))}
        </nav>
      </aside>

      {/* Lista de servicios por categoría */}
      <div className="space-y-4">
        {groups.length === 0 && (
          <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No encontramos servicios con esa búsqueda.
          </p>
        )}
        {groups.map(([cat, items]) => {
          const isCollapsed = collapsed.has(cat);
          return (
            <div key={cat} className="overflow-hidden rounded-lg border border-border bg-card">
              <button
                onClick={() => toggle(cat)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <span className="font-medium">{cat}</span>
                <ChevronDown
                  className={cn("h-4 w-4 text-muted-foreground transition-transform", isCollapsed && "-rotate-90")}
                />
              </button>
              {!isCollapsed && (
                <div className="divide-y divide-border border-t border-border">
                  {items.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="min-w-0">
                        <p className="font-medium">{s.name}</p>
                        {s.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{s.description}</p>
                        )}
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDuration(s.durationMin)}
                          <span className="mx-1">·</span>
                          <span className="font-medium text-foreground">{formatCLP(s.price)}</span>
                        </p>
                      </div>
                      <Button size="sm" asChild>
                        <Link href={`/reservar/${slug}/agendar?service=${s.id}`}>Reservar</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
