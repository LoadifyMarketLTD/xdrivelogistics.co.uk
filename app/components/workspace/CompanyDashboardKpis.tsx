import type { ReactNode } from 'react';

type DashboardMetric = {
  label: string;
  value: ReactNode;
  sub: string;
  icon: string;
  color: string;
  onSelect: () => void;
  selected?: boolean;
};

export default function CompanyDashboardKpis({ metrics }: { metrics: DashboardMetric[] }) {
  return <div className="xd-dashboard-kpis">
    {metrics.map(metric => <button type="button" key={metric.label}
      className={'xd-kpi ' + metric.color} onClick={metric.onSelect} aria-pressed={metric.selected}>
      <span className="xd-kpi-icon" aria-hidden="true">{metric.icon}</span>
      <span className="xd-kpi-content">
        <strong>{metric.label}</strong><b>{metric.value}</b><small>{metric.sub}</small>
      </span>
    </button>)}
  </div>;
}
