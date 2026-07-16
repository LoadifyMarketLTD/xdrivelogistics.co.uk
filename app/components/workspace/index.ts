// Barrel export for the workspace shared component library.
// Every Group B dashboard page imports from here.

export { default as WorkspaceShell }       from './WorkspaceShell';
export { default as WorkspaceAside }       from './WorkspaceAside';
export { default as WorkspaceMain }        from './WorkspaceMain';
export { default as WorkspaceHeader }      from './WorkspaceHeader';
export { default as WorkspaceTabs }        from './WorkspaceTabs';
export type { WorkspaceTab }               from './WorkspaceTabs';
export { default as WorkspaceContent }     from './WorkspaceContent';
export { default as WorkspaceCard }        from './WorkspaceCard';
export { default as WorkspaceMetricCard }  from './WorkspaceMetricCard';
export { default as WorkspaceTable,
         WorkspaceTableTr,
         WorkspaceTableTd }                from './WorkspaceTable';
export type { WorkspacePaginationProps }   from './WorkspaceTable';
export { default as WorkspaceStatusBadge } from './WorkspaceStatusBadge';
export { default as WorkspaceFieldLabel }  from './WorkspaceFieldLabel';
export { default as LoadingCard }          from './LoadingCard';
export { default as EmptyCard }            from './EmptyCard';
export { default as ErrorBanner }          from './ErrorBanner';

// Design tokens
export * from './tokens';
