import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Environment } from '../../types/api';
import { useMeta } from '../../lib/queries';
import { invalidateLedgerData, queryClient, queryKeys } from '../../lib/queryClient';
import { useToast } from './ToastProvider';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface RealtimeEvent {
  id: string;
  type: string;
  environment: Environment;
  occurredAt: string;
  data: Record<string, unknown>;
}

interface RealtimeContextValue {
  status: ConnectionStatus;
  transport: string | null;
  lastEvent: RealtimeEvent | null;
  events: RealtimeEvent[];
  serverTime: string | null;
  error: string | null;
}

const disconnectedValue: RealtimeContextValue = {
  status: 'disconnected',
  transport: null,
  lastEvent: null,
  events: [],
  serverTime: null,
  error: null,
};

const RealtimeContext = createContext<RealtimeContextValue>(disconnectedValue);

function eventSummary(event: RealtimeEvent): { title: string; description: string; tone: 'info' | 'success' | 'warning' | 'danger' } | null {
  const data = event.data;
  switch (event.type) {
    case 'exception.updated':
      return {
        title: 'Reconciliation exception updated',
        description: `${String(data.exceptionRef ?? 'Exception')} is now ${String(data.status ?? 'updated').replaceAll('_', ' ').toLowerCase()}.`,
        tone: data.status === 'RESOLVED' ? 'success' : 'warning',
      };
    case 'reconciliation.completed':
      // Operators already get a run summary from the mutation response. Avoid a
      // second toast for the realtime echo; other clients still refresh data.
      return null;
    case 'settlement.updated':
      return {
        title: 'Settlement updated',
        description: `${String(data.settlementRef ?? 'Settlement')} is now ${String(data.status ?? 'updated').toLowerCase()}.`,
        tone: data.status === 'SETTLED' ? 'success' : 'info',
      };
    case 'refund.updated':
      return {
        title: 'Refund updated',
        description: `${String(data.refundRef ?? 'Refund')} is now ${String(data.status ?? 'updated').replaceAll('_', ' ').toLowerCase()}.`,
        tone: data.status === 'REFUNDED' ? 'success' : 'info',
      };
    case 'demo.reset':
      return {
        title: 'Demo dataset reset',
        description: 'Only records tagged environment=demo were removed and reseeded.',
        tone: 'warning',
      };
    default:
      return null;
  }
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { data: meta } = useMeta();
  const { toast } = useToast();
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [transport, setTransport] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [serverTime, setServerTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seen = useRef(new Set<string>());
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!meta) return;
    setStatus('connecting');
    const socket = io(meta.realtime.namespace, {
      path: meta.realtime.path,
      auth: { environment: meta.environment },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 8_000,
      timeout: 10_000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connected');
      setError(null);
      setTransport(socket.io.engine?.transport?.name ?? 'socket.io');
      void invalidateLedgerData();
    });

    socket.on('disconnect', () => {
      setStatus('disconnected');
      setTransport(null);
    });

    socket.on('connect_error', (connectError: Error) => {
      setStatus('error');
      setError(
        connectError.message === 'ENVIRONMENT_MISMATCH'
          ? 'The realtime namespace rejected this environment.'
          : 'Realtime connection unavailable. Falling back to 15-second polling.',
      );
    });

    socket.on(
      'ledger:ready',
      (payload: { serverTime?: string; transport?: string }) => {
        if (payload.serverTime) setServerTime(payload.serverTime);
        if (payload.transport) setTransport(payload.transport);
      },
    );

    socket.on('ledger:event', (event: RealtimeEvent) => {
      if (!event || typeof event.id !== 'string' || seen.current.has(event.id)) return;
      seen.current.add(event.id);
      if (seen.current.size > 300) {
        const oldest = seen.current.values().next().value;
        if (oldest) seen.current.delete(oldest);
      }

      setLastEvent(event);
      setEvents((current) => [event, ...current].slice(0, 40));

      const summary = eventSummary(event);
      if (summary) toast({ ...summary, duration: 5_000 });

      switch (event.type) {
        case 'transaction.updated':
          void queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
          void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
          break;
        case 'event.processed':
          void queryClient.invalidateQueries({ queryKey: queryKeys.events });
          void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
          break;
        case 'exception.updated':
          void queryClient.invalidateQueries({ queryKey: queryKeys.exceptions });
          void queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
          void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
          break;
        case 'reconciliation.completed':
          void queryClient.invalidateQueries({ queryKey: queryKeys.exceptions });
          void queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
          void queryClient.invalidateQueries({ queryKey: queryKeys.runs });
          void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
          break;
        case 'settlement.updated':
          void queryClient.invalidateQueries({ queryKey: queryKeys.settlements });
          void queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
          void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
          break;
        case 'refund.updated':
          void queryClient.invalidateQueries({ queryKey: queryKeys.refunds });
          void queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
          void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
          break;
        case 'demo.reset':
        case 'demo.scenario':
          void invalidateLedgerData();
          break;
        default:
          void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      }
    });

    return () => {
      socket.off();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [meta, toast]);

  // Documented fallback: poll only while the socket is not connected.
  useEffect(() => {
    if (status === 'connected') return;
    const timer = window.setInterval(() => {
      void invalidateLedgerData();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [status]);

  const value = useMemo<RealtimeContextValue>(
    () => ({ status, transport, lastEvent, events, serverTime, error }),
    [status, transport, lastEvent, events, serverTime, error],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}
