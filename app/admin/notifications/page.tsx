'use client';

import {useAuth} from '../../components/AuthContext';
import WorkspaceNotificationInbox from '../../components/workspace/WorkspaceNotificationInbox';

export default function Page() {
  const {user}=useAuth();
  return <WorkspaceNotificationInbox role="admin" key={user?.id??"unresolved"} />;
}
