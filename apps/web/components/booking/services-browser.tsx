"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
    <div className="space-y-5">
      {/* Buscador centrado */}
      <div className="relative mx-auto max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          type="search"
          aria-label="Buscar servicio"
          placeholder="¿Qué servicio buscas?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Categorías en chips horizontales */}
      <nav className="flex flex-wrap justify-center gap-2">
        {["Todos", ...categories].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCat(cat)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition-colors",
              activeCat === cat
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {cat}
          </button>
        ))}
      </nav>

      {/* Lista de servicios por categoría */}
      <div className="space-y-6">
        {groups.length === 0 && (
          <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No encontramos servicios con esa búsqueda.
          </p>
        )}
        {groups.map(([cat, items]) => {
          const isCollapsed = collapsed.has(cat);
          return (
            <div key={cat} className="space-y-3">
              <button
                onClick={() => toggle(cat)}
                aria-expanded={!isCollapsed}
                className="flex w-full items-center justify-between border-b border-border pb-2 text-left"
              >
                <span className="font-medium">{cat}</span>
                <ChevronDown
                  className={cn("h-4 w-4 text-muted-foreground transition-transform", isCollapsed && "-rotate-90")}
                />
              </button>
              {!isCollapsed && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((s) => (
                    <ServiceCard key={s.id} service={s} slug={slug} />
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

function ServiceCard({ service: s, slug }: { service: Service; slug: string }) {
  const descRef = useRef<HTMLParagraphElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Solo se ofrece "Ver más" si la descripción realmente se recorta a 2 líneas.
  useEffect(() => {
    const el = descRef.current;
    if (el) setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [s.description]);

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card p-4">
      <p className="font-medium">{s.name}</p>
      {s.description && (
        <>
          <p
            ref={descRef}
            className={cn(
              "mt-1 text-xs leading-relaxed text-muted-foreground",
              !expanded && "line-clamp-2",
            )}
          >
            {s.description}
          </p>
          {overflowing && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 self-start text-xs font-medium text-foreground hover:underline"
            >
              {expanded ? "Ver menos" : "Ver más"}
            </button>
          )}
        </>
      )}
      <div className="mt-auto flex items-end justify-between gap-3 pt-3">
        <div className="min-w-0">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDuration(s.durationMin)}
          </span>
          <span className="mt-0.5 block font-medium tabular-nums">{formatCLP(s.price)}</span>
        </div>
        <Button size="sm" asChild>
          <Link href={`/reservar/${slug}/agendar?service=${s.id}`}>Reservar</Link>
        </Button>
      </div>
    </div>
  );
}
