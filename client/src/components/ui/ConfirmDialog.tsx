import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './Button';

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  loading = false,
  confirmDisabled = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-fade fixed inset-0 z-[60] bg-[#1b2333]/40 backdrop-blur-[3px]" />
        <Dialog.Content className="animate-enter clay-panel-lifted fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[1.75rem] p-6 outline-none">
          <Dialog.Title className="text-base font-semibold tracking-tight text-ink">
            {title}
          </Dialog.Title>
          {description ? (
            <Dialog.Description className="mt-2 text-xs leading-relaxed text-muted">
              {description}
            </Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">Confirmation required</Dialog.Description>
          )}
          {children ? <div className="mt-4">{children}</div> : null}
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary" disabled={loading}>
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button
              variant={tone === 'danger' ? 'danger' : 'primary'}
              loading={loading}
              disabled={confirmDisabled}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
