import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeProvider, useRealtime } from '../components/providers/RealtimeProvider';
import { ToastProvider } from '../components/providers/ToastProvider';
import { queryClient } from '../lib/queryClient';
import type { RealtimeEvent } from '../components/providers/RealtimeProvider';

const socketState = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const socket = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    off: vi.fn(() => handlers.clear()),
    disconnect: vi.fn(),
    io: { engine: { transport: { name: 'websocket' } } },
  };
  return { handlers, socket };
});

const meta = {
  environment: 'demo' as const,
  realtime: { namespace: '/realtime', path: '/socket.io' },
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => socketState.socket),
}));

vi.mock('../lib/queries', () => ({
  useMeta: () => ({ data: meta }),
}));

function Probe() {
  const realtime = useRealtime();
  return (
    <div>
      <span data-testid="status">{realtime.status}</span>
      <span data-testid="last-event">{realtime.lastEvent?.id ?? 'none'}</span>
      <span data-testid="event-count">{realtime.events.length}</span>
    </div>
  );
}

function event(overrides: Partial<RealtimeEvent> = {}): RealtimeEvent {
  return {
    id: 'evt_realtime_1',
    type: 'transaction.updated',
    environment: 'demo',
    occurredAt: '2026-10-01T10:00:00.000Z',
    data: { transactionRef: 'TXN-DEMO-0001' },
    ...overrides,
  };
}

describe('realtime provider', () => {
  beforeEach(() => {
    socketState.handlers.clear();
    socketState.socket.on.mockClear();
    socketState.socket.disconnect.mockClear();
  });

  it('invalidates once per event id and ignores replayed duplicates', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    render(
      <ToastProvider>
        <RealtimeProvider>
          <Probe />
        </RealtimeProvider>
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(socketState.handlers.has('ledger:event')).toBe(true);
    });

    const handler = socketState.handlers.get('ledger:event');
    expect(handler).toBeTypeOf('function');

    act(() => {
      handler?.(event());
    });

    expect(screen.getByTestId('last-event')).toHaveTextContent('evt_realtime_1');
    expect(screen.getByTestId('event-count')).toHaveTextContent('1');
    expect(invalidate).toHaveBeenCalledTimes(2);

    act(() => {
      handler?.(event());
    });

    expect(screen.getByTestId('event-count')).toHaveTextContent('1');
    expect(invalidate).toHaveBeenCalledTimes(2);

    act(() => {
      handler?.(event({ id: 'evt_realtime_2', type: 'settlement.updated' }));
    });

    expect(screen.getByTestId('last-event')).toHaveTextContent('evt_realtime_2');
    expect(screen.getByTestId('event-count')).toHaveTextContent('2');
    expect(invalidate).toHaveBeenCalledTimes(5);
  });

  it('marks the connection state from socket lifecycle events', async () => {
    render(
      <ToastProvider>
        <RealtimeProvider>
          <Probe />
        </RealtimeProvider>
      </ToastProvider>,
    );

    await waitFor(() => expect(socketState.handlers.has('connect')).toBe(true));

    act(() => {
      socketState.handlers.get('connect')?.();
    });
    expect(screen.getByTestId('status')).toHaveTextContent('connected');

    act(() => {
      socketState.handlers.get('disconnect')?.();
    });
    expect(screen.getByTestId('status')).toHaveTextContent('disconnected');
  });
});
