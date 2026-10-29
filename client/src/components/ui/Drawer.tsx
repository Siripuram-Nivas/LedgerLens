import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from './Button';

const widths = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
  '2xl': 'max-w-4xl',
};

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 'lg',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: keyof typeof widths;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-fade fixed inset-0 z-50 bg-navy-950/45 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            'animate-slide-in fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-canvas shadow-float outline-none',
            widths[width],
          )}
        >
          <header className="flex items-start gap-4 border-b border-line bg-surface px-5 py-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate pr-2 text-base font-semibold text-ink">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-xs leading-relaxed text-muted">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">Detail panel</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close panel">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </header>
          <div className="scrollbar-thin flex-1 overflow-y-auto overscroll-contain">
            {children}
          </div>
          {footer ? (
            <footer className="border-t border-line bg-surface px-5 py-3.5">{footer}</footer>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
