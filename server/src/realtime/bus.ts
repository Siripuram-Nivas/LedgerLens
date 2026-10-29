import type { Environment } from '../domain/types';

export type RealtimeEventType =
  | 'transaction.updated'
  | 'event.processed'
  | 'reconciliation.completed'
  | 'exception.updated'
  | 'settlement.updated'
  | 'refund.updated'
  | 'demo.reset'
  | 'demo.scenario';

export interface RealtimeEvent {
  id: string;
  type: RealtimeEventType;
  environment: Environment;
  occurredAt: string;
  data: Record<string, unknown>;
}

type Listener = (event: RealtimeEvent) => void;

export class RealtimeBus {
  private listeners = new Set<Listener>();

  publish(type: RealtimeEventType, environment: Environment, data: Record<string, unknown>): void {
    const event: RealtimeEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      type,
      environment,
      occurredAt: new Date().toISOString(),
      data,
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // A failed listener must not break financial state transitions.
      }
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
