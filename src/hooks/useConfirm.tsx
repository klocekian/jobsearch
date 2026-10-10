import { useCallback, useState, type ReactNode } from "react";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";

export interface ConfirmOptions {
  title: string;
  description: string;
  actionLabel: string;
}

/**
 * An awaitable confirmation, in place of window.confirm():
 * `if (!(await confirm({...}))) return;`. Render `dialog` once in the component.
 */
export function useConfirm(): { confirm: (options: ConfirmOptions) => Promise<boolean>; dialog: ReactNode } {
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ options, resolve })),
    [],
  );
  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const dialog = (
    <AlertDialog
      isOpen={pending !== null}
      onOpenChange={(open) => { if (!open) settle(false); }}
      title={pending?.options.title ?? ""}
      description={pending?.options.description ?? ""}
      actionLabel={pending?.options.actionLabel ?? "OK"}
      onAction={() => settle(true)}
    />
  );
  return { confirm, dialog };
}
