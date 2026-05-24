'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLabNotifications } from '../hooks/use-lab-notifications';
import { useAuthStore } from '@/store/auth-store';
import { useRouter } from 'next/navigation';

export function LabNotificationBell() {
  const user = useAuthStore((s) => s.user);
  const { notifications, isLoading, markRead, unreadCount } = useLabNotifications(user?.id);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleClick = async (id: string, orderId: string) => {
    await markRead(id);
    setOpen(false);
    router.push(`/doctor/laboratory?orderId=${encodeURIComponent(orderId)}`);
  };

  return (
    <div className="relative">
      <Button variant="ghost" onClick={() => setOpen((v) => !v)}>
        <Bell />
        {unreadCount > 0 && <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs bg-red-600 text-white rounded-full">{unreadCount}</span>}
      </Button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border rounded shadow">
          <div className="p-2">
            {isLoading && <div className="text-sm text-muted-foreground">Loading...</div>}
            {!isLoading && notifications.length === 0 && <div className="text-sm text-muted-foreground">No notifications</div>}
            {!isLoading && notifications.map((n) => (
              <div key={n.id} className={`p-2 cursor-pointer ${n.isRead ? 'opacity-60' : ''}`} onClick={() => handleClick(n.id, n.labOrderId)}>
                <div className="text-sm font-medium">{n.message}</div>
                <div className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
