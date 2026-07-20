'use client';
import type { ReactNode } from 'react';
import { PageFrame, PageHeader, StatusBadge } from '../../components/workspace/WorkspaceUI';

export default function DriverWorkspaceShell({children,subtitle,headerActions,driverName,availabilityLabel,personaLabel}:{children:ReactNode;subtitle?:string;headerActions?:ReactNode;driverName?:string;availabilityLabel?:string;personaLabel?:string}){
  return <PageFrame maxWidth={1180}>
    {(driverName||subtitle||availabilityLabel||personaLabel||headerActions)&&<PageHeader eyebrow={personaLabel??'Driver workspace'} title={driverName??'My Work'} description={subtitle} actions={<>{availabilityLabel&&<StatusBadge value={availabilityLabel}/>} {headerActions}</>}/>} 
    {children}
  </PageFrame>;
}
