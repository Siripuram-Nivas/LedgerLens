import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../providers/ToastProvider';
import { cn } from '../../lib/cn';

export function CopyButton({
  value,
  label = 'Copy reference',
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
      toast({ title: 'Copied to clipboard', description: value, tone: 'success', duration: 2_000 });
    } catch {
      toast({
        title: 'Clipboard unavailable',
        description: 'Select the reference text and copy it manually.',
        tone: 'warning',
      });
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-light transition hover:bg-surface-sunken hover:text-ink',
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
