import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from '../components/ui/Badge';
import { ProcessingBadge, SignatureBadge } from '../components/domain/EventBadges';
import { paymentStatusMeta, refundStatusMeta, settlementStatusMeta } from '../lib/status';

describe('status badges', () => {
  it('renders payment status labels with their explanatory description', () => {
    render(<StatusBadge meta={paymentStatusMeta.PAID} />);
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(
      screen.getByTitle('Capture is confirmed by a trusted payment event.'),
    ).toBeInTheDocument();
  });

  it('keeps settlement and refund wording distinct from payment capture', () => {
    render(
      <>
        <StatusBadge meta={settlementStatusMeta.NOT_APPLICABLE} />
        <StatusBadge meta={refundStatusMeta.REQUESTED} />
      </>,
    );
    expect(screen.getByText('Not applicable')).toBeInTheDocument();
    expect(screen.getByText('Refund requested')).toBeInTheDocument();
    expect(screen.getByText('Refund requested')).not.toHaveTextContent(/refunded/i);
  });

  it('labels simulated signatures and failed processing explicitly', () => {
    render(
      <>
        <SignatureBadge status="SIMULATED" />
        <ProcessingBadge status="FAILED" />
      </>,
    );
    expect(screen.getByText('simulated')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.queryByText('verified')).not.toBeInTheDocument();
  });
});
