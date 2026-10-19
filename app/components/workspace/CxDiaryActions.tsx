'use client';

import type { ReactNode } from 'react';
import type { JobSheetTab } from './CompanyJobSheetPanel';

export type DiaryActionTab = 'pod' | 'order' | 'notes' | 'history' | 'documents' | 'invoice';
export const DIARY_JOB_SHEET_TABS: Record<DiaryActionTab, JobSheetTab> = {
  pod: 'pod', order: 'agreement', notes: 'progress', history: 'event-log', documents: 'evidence', invoice: 'invoice',
};
const ACTIONS: Array<{ id: DiaryActionTab; label: string }> = [
  { id: 'pod', label: 'POD' }, { id: 'order', label: 'Order' }, { id: 'notes', label: 'Notes' },
  { id: 'history', label: 'History' }, { id: 'documents', label: 'Documents' }, { id: 'invoice', label: 'View invoice (£)' },
];

/** One action order and markup for every Diary. Callers retain authorization. */
export default function CxDiaryActions({ expanded, onToggle, onOpenTab, feedback, visibleTabs, disabledTabs = [], activeTab, labels = {}, children }: {
  expanded: boolean;
  onToggle: () => void;
  onOpenTab: (tab: DiaryActionTab) => void;
  feedback?: ReactNode;
  visibleTabs?: DiaryActionTab[];
  disabledTabs?: DiaryActionTab[];
  activeTab?: DiaryActionTab;
  labels?: Partial<Record<DiaryActionTab, string>>;
  children?: ReactNode;
}) {
  return <>
    <button type="button" className="xdrive-cx-diary-card__expander" onClick={onToggle}
      aria-expanded={expanded} aria-label={expanded ? 'Collapse booking' : 'Expand booking'}>{expanded ? '▴' : '▾'}</button>
    {feedback}
    {ACTIONS.filter(action => !visibleTabs || visibleTabs.includes(action.id)).map(action => (
      <button key={action.id} type="button" onClick={() => onOpenTab(action.id)}
        disabled={disabledTabs.includes(action.id)} data-active={expanded && activeTab === action.id ? 'true' : 'false'}>
        {labels[action.id] ?? action.label}
      </button>
    ))}
    {children}
  </>;
}
