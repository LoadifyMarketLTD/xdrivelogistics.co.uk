import type { ReactNode } from 'react';

export type PlatformEntityType =
  | 'job'
  | 'company'
  | 'user'
  | 'driver'
  | 'vehicle'
  | 'invoice'
  | 'pod'
  | 'ticket'
  | 'dispute'
  | 'notification'
  | 'health_check'
  | 'case';

export type PlatformEntityField = {
  key: string;
  label: string;
  value: ReactNode;
  copyValue?: string | null;
  tone?: 'default' | 'muted' | 'success' | 'warning' | 'danger';
};

export type PlatformEntitySection = {
  id: string;
  title: string;
  description?: string;
  fields?: PlatformEntityField[];
  content?: ReactNode;
  unavailable?: boolean;
  unavailableReason?: string;
};

export type PlatformSemanticAction = {
  id: string;
  label: string;
  description: string;
  tone?: 'primary' | 'secondary' | 'warning' | 'danger';
  requiresReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  confirmLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
  onExecute: (reason: string) => Promise<void> | void;
};

export type PlatformAuditEntry = {
  id: string;
  action: string;
  actorLabel: string;
  createdAt: string;
  reason?: string | null;
  before?: ReactNode;
  after?: ReactNode;
  correlationId?: string | null;
};

export type PlatformCaseSeverity = 'P0' | 'P1' | 'P2' | 'P3';
export type PlatformCaseStatus = 'open' | 'acknowledged' | 'investigating' | 'waiting' | 'resolved' | 'closed';

export type PlatformCaseSummary = {
  id: string;
  reference: string;
  title: string;
  description?: string | null;
  severity: PlatformCaseSeverity;
  status: PlatformCaseStatus;
  entityType: PlatformEntityType;
  entityId: string;
  entityLabel: string;
  assignedToLabel?: string | null;
  detectedAt: string;
  updatedAt: string;
};
