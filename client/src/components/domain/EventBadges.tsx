import { Badge } from '../ui/Badge';
import type { SignatureStatus } from '../../types/api';

const signatureTone = {
  VERIFIED: 'success',
  SIMULATED: 'info',
  INVALID: 'danger',
  NOT_AVAILABLE: 'neutral',
} as const;

export function SignatureBadge({ status }: { status: SignatureStatus }) {
  return (
    <Badge tone={signatureTone[status]} dot>
      {status.replaceAll('_', ' ').toLowerCase()}
    </Badge>
  );
}

export function ProcessingBadge({ status }: { status: string }) {
  const tone = status === 'PROCESSED' ? 'success' : status === 'FAILED' ? 'danger' : 'info';
  return <Badge tone={tone}>{status.toLowerCase()}</Badge>;
}

export function RefundStatusPill({ status }: { status: string }) {
  if (status === 'NONE') return <span className="text-[11px] text-muted-light">—</span>;
  const tone =
    status === 'REFUNDED'
      ? 'success'
      : status === 'FAILED'
        ? 'danger'
        : status === 'PARTIALLY_REFUNDED'
          ? 'violet'
          : status === 'PROCESSING'
            ? 'warning'
            : 'info';
  return <Badge tone={tone}>{status.replaceAll('_', ' ').toLowerCase()}</Badge>;
}
