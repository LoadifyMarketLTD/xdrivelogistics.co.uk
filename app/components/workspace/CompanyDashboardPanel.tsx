import type { ReactNode } from 'react';

export default function CompanyDashboardPanel({
  title, icon, iconClassName, panel, action, children,
}: {
  title: ReactNode;
  icon: string;
  iconClassName?: string;
  panel: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return <div className={'xd-dash-panel ' + panel}>
    <div className="xd-dash-panel-head">
      <h2><span className={iconClassName} aria-hidden="true">{icon}</span>{'  '}{title}</h2>
      {action}
    </div>
    {children}
  </div>;
}
