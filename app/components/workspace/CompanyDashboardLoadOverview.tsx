import type { ReactNode } from 'react';
import CompanyDashboardPanel from './CompanyDashboardPanel';

export default function CompanyDashboardLoadOverview({
  metrics, description,
}: {
  description?: string;
  metrics: { label: string; value: ReactNode }[];
}) {
  return <CompanyDashboardPanel panel="xd-overview" icon="▣" title={<>Load Overview <small>(Last 7 Days)</small></>}>
    {description && <p className="xd-dashboard-disclaimer">{description}</p>}
    <div className="xd-overview-metrics">
      {metrics.map(metric => <div key={metric.label}><small>{metric.label}</small><b>{metric.value}</b></div>)}
    </div>
  </CompanyDashboardPanel>;
}
