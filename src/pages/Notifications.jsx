import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Bell, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);

  const load = async () => {
    const user = await base44.auth.me();
    const rows = await base44.entities.AppNotification.filter({ user_id: user.id });
    setItems([...rows].sort((a,b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime()));
  };
  useEffect(() => { load().catch(console.error); }, []);

  const markRead = async item => {
    if (item.read_at) return;
    const read_at = new Date().toISOString();
    await base44.entities.AppNotification.update(item.id, { read_at });
    setItems(prev => prev.map(row => row.id === item.id ? { ...row, read_at } : row));
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-24">
      <div className="sticky top-0 bg-[var(--color-background)]/95 backdrop-blur z-30 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-[var(--color-surface)] flex items-center justify-center"><ArrowLeft className="w-5 h-5" /></button>
        <div><h1 className="text-2xl font-light">Notifications</h1><p className="text-sm text-[var(--color-text-secondary)]">Store updates, offers, and purchase activity</p></div>
      </div>
      <div className="px-6 space-y-3">
        {items.map(item => (
          <button key={item.id} onClick={() => markRead(item)} className={`w-full text-left p-4 rounded-2xl border ${item.read_at ? 'bg-[var(--color-surface)] border-[var(--color-border-light)]' : 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30'}`}>
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center">
                {item.read_at ? <Check className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              </div>
              <div className="flex-1">
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">{item.message}</p>
                {item.coupon_code && <p className="text-sm font-medium mt-2">Code: {item.coupon_code}</p>}
                {item.created_date && <p className="text-xs text-[var(--color-text-muted)] mt-2">{new Date(item.created_date).toLocaleString()}</p>}
              </div>
            </div>
          </button>
        ))}
        {items.length === 0 && <p className="text-center py-16 text-[var(--color-text-secondary)]">No notifications yet.</p>}
      </div>
    </div>
  );
}
