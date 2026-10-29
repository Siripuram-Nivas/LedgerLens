import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventDrawer } from '../components/drawers/EventDrawer';
import { ToastProvider } from '../components/providers/ToastProvider';
import type { EventDetail, Payment } from '../types/api';

const mocks = vi.hoisted(() => ({
  useEvent: vi.fn(),
}));

vi.mock('../lib/queries', () => ({
  useEvent: mocks.useEvent,
}));

const payment: Payment = {
  id: 'pay_1',
  transactionRef: 'TXN-DEMO-0001',
  orderRef: 'ORD-DEMO-0001',
  customerRef: 'CUST-0001',
  amountMinor: 125_000,
  currency: 'INR',
  status: 'PAID',
  settlementStatus: 'NOT_STARTED',
  reconciliationStatus: 'MATCHED',
  refundStatus: 'NONE',
  provider: 'demo',
  providerPaymentId: 'pay_DEMO_EVENT_0001',
  method: 'upi',
  attempt: 1,
  source: 'demo',
  environment: 'demo',
  lastEventAt: '2026-10-01T10:00:00.000Z',
  lastEventKey: 'demo:payment.captured:EVT-1',
  metadata: {},
  createdAt: '2026-10-01T09:59:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
};

const detail: EventDetail = {
  event: {
    id: 'evt_1',
    eventKey: 'demo:payment.captured:EVT-1',
    provider: 'demo',
    providerEventId: 'evt_DEMO_EVENT_0001',
    type: 'payment.captured',
    providerStatus: 'captured',
    paymentRef: 'pay_DEMO_EVENT_0001',
    orderRef: 'ORD-DEMO-0001',
    transactionRef: 'TXN-DEMO-0001',
    amountMinor: 125_000,
    currency: 'INR',
    receivedAt: '2026-10-01T10:00:00.000Z',
    providerCreatedAt: '2026-10-01T09:59:58.000Z',
    signatureStatus: 'SIMULATED',
    processingStatus: 'PROCESSED',
    processingError: null,
    processingNote: null,
    applied: true,
    duplicateDeliveryCount: 1,
    lastDeliveryAt: '2026-10-01T10:00:03.000Z',
    reconciliationTriggered: true,
    source: 'demo',
    environment: 'demo',
    payloadSummary: {
      reference: 'pay_DEMO_EVENT_0001',
      amount: 125_000,
      currency: 'INR',
      card: '[REDACTED]',
    },
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:03.000Z',
  },
  deliveries: [
    {
      id: 'del_1',
      deliveryId: 'DLV-0001',
      eventKey: 'demo:payment.captured:EVT-1',
      receivedAt: '2026-10-01T10:00:00.000Z',
      outcome: 'ACCEPTED',
      signatureStatus: 'SIMULATED',
      source: 'demo',
      environment: 'demo',
      note: 'First delivery applied exactly once.',
    },
    {
      id: 'del_2',
      deliveryId: 'DLV-0002',
      eventKey: 'demo:payment.captured:EVT-1',
      receivedAt: '2026-10-01T10:00:03.000Z',
      outcome: 'DUPLICATE',
      signatureStatus: 'SIMULATED',
      source: 'demo',
      environment: 'demo',
      note: 'Provider retried the same idempotency key.',
    },
  ],
  transaction: payment,
  order: {
    id: 'ord_1',
    orderRef: 'ORD-DEMO-0001',
    customerRef: 'CUST-0001',
    description: 'Demo order',
    amountMinor: 125_000,
    currency: 'INR',
    source: 'demo',
    environment: 'demo',
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  },
  stages: [
    {
      stage: 'delivered',
      complete: true,
      at: '2026-10-01T10:00:00.000Z',
      detail: 'Webhook delivery recorded with a simulated demo signature.',
    },
    {
      stage: 'processed',
      complete: true,
      at: '2026-10-01T10:00:01.000Z',
      detail: 'Payment capture applied to TXN-DEMO-0001.',
    },
    {
      stage: 'reconciled',
      complete: true,
      at: '2026-10-01T10:00:02.000Z',
      detail: 'Post-event reconciliation matched the order and payment.',
    },
  ],
};

function renderDrawer() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <EventDrawer reference="demo:payment.captured:EVT-1" onClose={() => undefined} />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('event drawer', () => {
  beforeEach(() => {
    mocks.useEvent.mockReturnValue({
      data: detail,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('shows event identity, trust state, and processing counts', () => {
    renderDrawer();

    expect(screen.getByText('payment.captured')).toBeInTheDocument();
    expect(screen.getAllByText('evt_DEMO_EVENT_0001').length).toBeGreaterThan(0);
    expect(screen.getByText('Exactly once')).toBeInTheDocument();
    expect(screen.getAllByText('simulated').length).toBeGreaterThan(0);
    expect(screen.getByText('Recon triggered')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('renders derived stages and every delivery, including the duplicate', () => {
    renderDrawer();

    expect(screen.getByText('Processing stages')).toBeInTheDocument();
    expect(screen.getByText('reconciled')).toBeInTheDocument();
    expect(
      screen.getByText('Post-event reconciliation matched the order and payment.'),
    ).toBeInTheDocument();

    expect(screen.getByText('DLV-0001')).toBeInTheDocument();
    expect(screen.getByText('DLV-0002')).toBeInTheDocument();
    expect(screen.getByText('duplicate')).toBeInTheDocument();
    expect(screen.getByText('Provider retried the same idempotency key.')).toBeInTheDocument();
  });

  it('warns that duplicate deliveries were applied once and keeps the audit trail', () => {
    renderDrawer();

    expect(screen.getByText('Duplicate deliveries were recorded')).toBeInTheDocument();
    expect(
      screen.getByText(/The same idempotency key arrived 2 times/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Financial effects were applied only once/i)).toBeInTheDocument();
  });

  it('links the event to its payment and shows the sanitized payload', () => {
    renderDrawer();

    expect(
      screen.getByRole('link', { name: /Open transaction TXN-DEMO-0001/ }),
    ).toHaveAttribute('href', '/transactions?transaction=TXN-DEMO-0001');
    expect(screen.getAllByText(/ORD-DEMO-0001/).length).toBeGreaterThan(0);
    expect(screen.getByText(/\[REDACTED\]/)).toBeInTheDocument();
    expect(screen.getByText(/Demo events are marked SIMULATED/i)).toBeInTheDocument();
  });

  it('renders an error state when the event cannot be loaded', () => {
    mocks.useEvent.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('Event not found'),
      refetch: vi.fn(),
    });
    renderDrawer();

    expect(screen.getByRole('alert')).toHaveTextContent('Event not found');
  });
});
