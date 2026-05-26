"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  id?: string;
  max?: number;
};

/**
 * Input de "chips": se escribe y con Enter o coma se agrega una etiqueta.
 * Backspace con el campo vacío borra la última. Normaliza a minúsculas y evita duplicados.
 */
export function TagsInput({ value, onChange, placeholder, id, max = 12 }: Props) {
  const [draft, setDraft] = useState("");

  function addTag(raw: string) {
    const t = raw.trim().toLowerCase();
    setDraft("");
    if (!t || value.includes(t) || value.length >= max) return;
    onChange([...value, t]);
  }

  function removeTag(t: string) {
    onChange(value.filter((v) => v !== t));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      removeTag(value[value.length - 1]!);
    }
  }

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      {value.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs"
        >
          {t}
          <button
            type="button"
            onClick={() => removeTag(t)}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label={`Quitar ${t}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => addTag(draft)}
        placeholder={value.length === 0 ? placeholder : ""}
        className="min-w-[8ch] flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
