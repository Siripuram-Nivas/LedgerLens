import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionsPage } from '../pages/TransactionsPage';
import { ToastProvider } from '../components/providers/ToastProvider';
import type { Payment } from '../types/api';

const mocks = vi.hoisted(() => ({
  useTransactions: vi.fn(),
  useTransaction: vi.fn(),
  useRunReconciliation: vi.fn(),
}));

vi.mock('../lib/queries', () => ({
  useTransactions: mocks.useTransactions,
  useTransaction: mocks.useTransaction,
  useRunReconciliation: mocks.useRunReconciliation,
}));

const payment: Payment = {
  id: 'pay_1',
  transactionRef: 'TXN-DEMO-0001',
  orderRef: 'ORD-DEMO-0001',
  customerRef: 'CUST-0001',
  amountMinor: 250_000,
  currency: 'INR',
  status: 'PAID',
  settlementStatus: 'NOT_STARTED',
  reconciliationStatus: 'MATCHED',
  refundStatus: 'NONE',
  provider: 'demo',
  providerPaymentId: 'pay_DEMO_SEED_0001',
  method: 'upi',
  attempt: 1,
  source: 'demo',
  environment: 'demo',
  lastEventAt: '2026-10-01T10:00:00.000Z',
  lastEventKey: 'demo:payment.captured:1',
  metadata: {},
  createdAt: '2026-10-01T09:59:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
};

function transactionResult(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      data: [payment],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    },
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/transactions']}>
      <ToastProvider>
        <TransactionsPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('transactions page', () => {
  beforeEach(() => {
    mocks.useTransactions.mockReturnValue(transactionResult());
    mocks.useTransaction.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    mocks.useRunReconciliation.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it('passes status filters to the query and resets paging', async () => {
    renderPage();

    expect(mocks.useTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, status: undefined, reconciliationStatus: undefined }),
    );
    expect(screen.getByText('TXN-DEMO-0001')).toBeInTheDocument();
    expect(screen.getByText('₹2,500.00')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Payment status'), { target: { value: 'PAID' } });

    await waitFor(() => {
      const filters = mocks.useTransactions.mock.calls.at(-1)?.[0];
      expect(filters).toEqual(
        expect.objectContaining({ page: 1, status: 'PAID', sortBy: 'createdAt', sortDir: 'desc' }),
      );
    });
    expect(screen.getByText('1 active')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Reconciliation status'), {
      target: { value: 'AMOUNT_MISMATCH' },
    });

    await waitFor(() => {
      const filters = mocks.useTransactions.mock.calls.at(-1)?.[0];
      expect(filters).toEqual(
        expect.objectContaining({ status: 'PAID', reconciliationStatus: 'AMOUNT_MISMATCH' }),
      );
    });
    expect(screen.getByText('2 active')).toBeInTheDocument();
  });

  it('clears every filter through the reset action', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Payment status'), { target: { value: 'FAILED' } });
    await waitFor(() => expect(screen.getByText('1 active')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Clear/ }));

    await waitFor(() => {
      const filters = mocks.useTransactions.mock.calls.at(-1)?.[0];
      expect(filters).toEqual(
        expect.objectContaining({
          status: undefined,
          settlementStatus: undefined,
          reconciliationStatus: undefined,
          refundStatus: undefined,
          q: undefined,
        }),
      );
    });
    expect(screen.getByText('0 active')).toBeInTheDocument();
  });

  it('renders a loading skeleton before the first result arrives', () => {
    mocks.useTransactions.mockReturnValue(
      transactionResult({ data: undefined, isPending: true, isFetching: true }),
    );
    renderPage();

    expect(screen.getByRole('status', { name: 'Loading rows' })).toBeInTheDocument();
  });

  it('renders the API error and retries on demand', () => {
    const refetch = vi.fn();
    mocks.useTransactions.mockReturnValue(
      transactionResult({
        data: undefined,
        isPending: false,
        isError: true,
        error: new Error('Ledger store unavailable'),
        refetch,
      }),
    );
    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent('Ledger store unavailable');
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders an empty state instead of an empty table', () => {
    mocks.useTransactions.mockReturnValue(
      transactionResult({
        data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } },
      }),
    );
    renderPage();

    expect(screen.getByText('No transactions match these filters')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
