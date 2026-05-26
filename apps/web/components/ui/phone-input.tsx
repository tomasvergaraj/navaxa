"use client";

import { useEffect, useState } from "react";
import {
  Input,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@navaxa/ui";
import CL from "country-flag-icons/react/3x2/CL";
import AR from "country-flag-icons/react/3x2/AR";
import PE from "country-flag-icons/react/3x2/PE";
import CO from "country-flag-icons/react/3x2/CO";
import MX from "country-flag-icons/react/3x2/MX";
import BO from "country-flag-icons/react/3x2/BO";
import UY from "country-flag-icons/react/3x2/UY";
import PY from "country-flag-icons/react/3x2/PY";
import BR from "country-flag-icons/react/3x2/BR";
import EC from "country-flag-icons/react/3x2/EC";
import VE from "country-flag-icons/react/3x2/VE";
import ES from "country-flag-icons/react/3x2/ES";
import US from "country-flag-icons/react/3x2/US";

interface Country {
  code: string;
  dial: string;
  name: string;
  Flag: React.ComponentType<{ className?: string; title?: string }>;
}

// Chile primero (default); luego el resto de LatAm y comunes.
const COUNTRIES: Country[] = [
  { code: "CL", dial: "+56", name: "Chile", Flag: CL },
  { code: "AR", dial: "+54", name: "Argentina", Flag: AR },
  { code: "PE", dial: "+51", name: "Perú", Flag: PE },
  { code: "CO", dial: "+57", name: "Colombia", Flag: CO },
  { code: "MX", dial: "+52", name: "México", Flag: MX },
  { code: "BO", dial: "+591", name: "Bolivia", Flag: BO },
  { code: "UY", dial: "+598", name: "Uruguay", Flag: UY },
  { code: "PY", dial: "+595", name: "Paraguay", Flag: PY },
  { code: "BR", dial: "+55", name: "Brasil", Flag: BR },
  { code: "EC", dial: "+593", name: "Ecuador", Flag: EC },
  { code: "VE", dial: "+58", name: "Venezuela", Flag: VE },
  { code: "ES", dial: "+34", name: "España", Flag: ES },
  { code: "US", dial: "+1", name: "Estados Unidos", Flag: US },
];

const DEFAULT_CODE = "CL";

function detectCountry(value: string): string {
  if (value?.startsWith("+")) {
    // El más largo que coincida (para distinguir +59x de +5x).
    const match = [...COUNTRIES]
      .sort((a, b) => b.dial.length - a.dial.length)
      .find((c) => value.startsWith(c.dial));
    if (match) return match.code;
  }
  return DEFAULT_CODE;
}

function stripDial(value: string, dial: string): string {
  return value?.startsWith(dial) ? value.slice(dial.length) : "";
}

export function PhoneInput({
  value,
  onChange,
  id,
  placeholder = "9 1234 5678",
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
}) {
  const [code, setCode] = useState(() => detectCountry(value));
  const country = COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];
  const [local, setLocal] = useState(() => stripDial(value, country.dial));

  // Si el formulario se resetea (value vacío), limpiar el número local.
  useEffect(() => {
    if (!value) setLocal("");
  }, [value]);

  function emit(newCode: string, newLocal: string) {
    const c = COUNTRIES.find((x) => x.code === newCode) ?? COUNTRIES[0];
    const digits = newLocal.replace(/\D/g, "");
    onChange(digits ? `${c.dial}${digits}` : "");
  }

  function onCountry(newCode: string) {
    setCode(newCode);
    emit(newCode, local);
  }
  function onLocal(v: string) {
    setLocal(v);
    emit(code, v);
  }

  const SelectedFlag = country.Flag;

  return (
    <div className="flex gap-2">
      <Select value={code} onValueChange={onCountry}>
        <SelectTrigger className="w-[112px] shrink-0">
          <div className="flex items-center gap-1.5">
            <SelectedFlag className="h-3.5 w-5 shrink-0 rounded-[2px]" />
            <span className="text-sm">{country.dial}</span>
          </div>
        </SelectTrigger>
        <SelectContent>
          {COUNTRIES.map((c) => {
            const Flag = c.Flag;
            return (
              <SelectItem key={c.code} value={c.code}>
                <span className="flex items-center gap-2">
                  <Flag className="h-3.5 w-5 rounded-[2px]" />
                  <span className="text-sm">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.dial}</span>
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="numeric"
        placeholder={placeholder}
        value={local}
        onChange={(e) => onLocal(e.target.value)}
      />
    </div>
  );
}
