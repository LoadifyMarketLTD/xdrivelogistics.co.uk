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
export { default as WorkspacePlatformShell } from './WorkspacePlatformShell';
export { default as WorkspaceToolbar }     from './WorkspaceToolbar';
export { default as WorkspaceFilters }     from './WorkspaceFilters';
export { default as WorkspaceForm }        from './WorkspaceForm';
export { default as WorkspaceSearch }      from './WorkspaceSearch';
export { default as WorkspacePagination }  from './WorkspacePagination';
export { default as WorkspaceModal }       from './WorkspaceModal';
export { default as WorkspaceDrawer }      from './WorkspaceDrawer';
export { default as WorkspaceActions }     from './WorkspaceActions';
export type { WorkspaceAction }            from './WorkspaceActions';
export { default as WorkspaceNotifications } from './WorkspaceNotifications';

// Design tokens
export * from './tokens';
