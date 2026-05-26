"use client";

import { useCallback, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@navaxa/ui";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

/**
 * Confirmación con UI propia (reemplaza window.confirm).
 * Uso:
 *   const { confirm, confirmDialog } = useConfirm();
 *   if (!(await confirm({ title: "…", destructive: true }))) return;
 *   ...
 *   return (<>{confirmDialog} …</>);
 */
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<{ fn: (v: boolean) => void } | null>(null);

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setOpts(o);
        setResolver({ fn: resolve });
      }),
    [],
  );

  const close = (value: boolean) => {
    resolver?.fn(value);
    setResolver(null);
    setOpts(null);
  };

  const confirmDialog = (
    <Dialog open={!!opts} onOpenChange={(o) => { if (!o) close(false); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{opts?.title}</DialogTitle>
          {opts?.description && <DialogDescription>{opts.description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)}>
            {opts?.cancelText ?? "Cancelar"}
          </Button>
          <Button variant={opts?.destructive ? "destructive" : "default"} onClick={() => close(true)}>
            {opts?.confirmText ?? "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm, confirmDialog };
}
