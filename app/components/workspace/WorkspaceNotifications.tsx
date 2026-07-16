'use client';

import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';

export default function WorkspaceNotifications() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return;
    let active = true;
    const loadCount = async () => {
      const { count: nextCount } = await supabase
        .from('notification_events')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_user_id', user.id)
        .eq('status', 'pending');
      if (active) setCount(nextCount ?? 0);
    };
    void loadCount();
    const timer = window.setInterval(() => void loadCount(), 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [user?.id]);

  return (
    <div className="workspace-notifications">
      <button className="workspace-icon-action" type="button" onClick={() => setOpen((value) => !value)} aria-label="Notifications" aria-expanded={open}>
        <Bell size={17} />
        {count > 0 && <span>{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <div className="workspace-notifications-panel" role="status">
          <strong>Notifications</strong>
          <p>{count > 0 ? `${count} operational update${count === 1 ? '' : 's'} waiting.` : 'You are all caught up.'}</p>
        </div>
      )}
    </div>
  );
}
