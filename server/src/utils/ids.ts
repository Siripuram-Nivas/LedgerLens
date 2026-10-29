import { randomBytes, randomUUID } from 'node:crypto';

export function createId(): string {
  return randomUUID();
}

function suffix(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

export function createRef(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${suffix()}`;
}

export function createDemoRef(prefix: string): string {
  return `${prefix}-DEMO-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export const newTransactionRef = () => createRef('TXN');
export const newOrderRef = () => createRef('ORD');
export const newEventKey = () => `evt_DEMO_${randomBytes(10).toString('hex')}`;
export const newExceptionRef = () => createRef('REC');export const newRunRef = () => createRef('RUN');
export const newSettlementRef = () => createRef('SET');
export const newRefundRef = () => createRef('REF');
export const newAuditRef = () => createRef('AUD');
export const newDeliveryId = () => createRef('DLV');
