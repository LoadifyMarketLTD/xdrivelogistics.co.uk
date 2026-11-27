import type { ReactNode } from 'react';
import CompanyDashboardPanel from './CompanyDashboardPanel';

type DashboardAction = {
  label: string;
  value: ReactNode;
  color: string;
  selected?: boolean;
  onSelect: () => void;
};

export default function CompanyDashboardActions({
  actions, total, description,
}: {
  actions: DashboardAction[];
  total?: number;
  description?: string;
}) {
  return <CompanyDashboardPanel panel="xd-attention" icon="⚠" iconClassName="xd-orange" title={<>Action Required{total !== undefined && ` (${total})`}</>}>
    {description && <p className="xd-dashboard-disclaimer">{description}</p>}
    {actions.map(action => <button type="button" className="xd-action-row" key={action.label}
      onClick={action.onSelect} aria-pressed={action.selected}>
      <span>{action.label}</span><b className={action.color}>{action.value}</b><strong aria-hidden="true">›</strong>
    </button>)}
  </CompanyDashboardPanel>;
}
