import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, UserPlus, Check, Trash2, Gift, Loader2, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Friends() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [relations, setRelations] = useState([]);
  const [email, setEmail] = useState('');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [wishlists, setWishlists] = useState({});

  const load = async () => {
    const current = await base44.auth.me();
    setUser(current);
    const [outgoing, incoming] = await Promise.all([
      base44.entities.Friend.filter({ user_id: current.id }),
      base44.entities.Friend.filter({ friend_user_id: current.id })
    ]);
    const unique = new Map([...outgoing, ...incoming].map(row => [row.id, row]));
    setRelations(Array.from(unique.values()));
  };

  useEffect(() => { load().catch(console.error); }, []);

  const call = async (action, payload = {}) => {
    setWorking(true);
    setMessage('');
    try {
      const response = await base44.functions.invoke('manageFriend', { action, ...payload });
      const result = response?.data || response;
      if (!result?.success) throw new Error(result?.error || 'Friend action failed.');
      setEmail('');
      await load();
    } catch (error) {
      setMessage(error?.response?.data?.error || error?.message || 'Friend action failed.');
    } finally {
      setWorking(false);
    }
  };

  const viewWishlist = async (relation) => {
    const friendUserId = relation.user_id === user.id ? relation.friend_user_id : relation.user_id;
    try {
      const response = await base44.functions.invoke('friendWishlist', { friendUserId });
      const result = response?.data || response;
      setWishlists(prev => ({ ...prev, [relation.id]: result }));
    } catch (error) {
      setWishlists(prev => ({ ...prev, [relation.id]: { items: [], private: true, error: error?.message } }));
    }
  };

  const display = relation => relation.user_id === user?.id
    ? { name: relation.friend_name, picture: relation.friend_picture, incoming: false }
    : { name: relation.requester_name || 'Concierge user', picture: relation.requester_picture, incoming: true };

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-24">
      <div className="sticky top-0 z-30 bg-[var(--color-background)]/95 backdrop-blur px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-[var(--color-surface)] flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-light">Friends</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Connect and share public wishlists</p>
        </div>
      </div>

      <div className="px-6 space-y-6">
        <Card>
          <CardContent className="p-4">
            <p className="font-medium mb-3">Add a friend by email</p>
            <div className="flex gap-2">
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="friend@example.com" type="email" />
              <Button disabled={!email || working} onClick={() => call('send', { email })}>
                {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              </Button>
            </div>
            {message && <p className="text-sm text-red-600 mt-2">{message}</p>}
          </CardContent>
        </Card>

        <div className="space-y-3">
          {relations.map(relation => {
            const info = display(relation);
            const incomingPending = info.incoming && relation.status === 'pending';
            const wishlist = wishlists[relation.id];
            return (
              <Card key={relation.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {info.picture
                      ? <img src={info.picture} alt="" className="w-12 h-12 rounded-full object-cover" />
                      : <div className="w-12 h-12 rounded-full bg-[var(--color-background-secondary)]" />
                    }
                    <div className="flex-1">
                      <p className="font-medium">{info.name}</p>
                      <p className="text-xs text-[var(--color-text-secondary)] capitalize">{relation.status}</p>
                    </div>
                    {incomingPending && (
                      <Button size="sm" onClick={() => call('accept', { friendId: relation.id })}>
                        <Check className="w-4 h-4 mr-1" /> Accept
                      </Button>
                    )}
                    {relation.status === 'accepted' && (
                      <Button size="sm" variant="outline" onClick={() => viewWishlist(relation)}>
                        <Gift className="w-4 h-4 mr-1" /> Wishlist
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="text-red-500" onClick={() => call('remove', { friendId: relation.id })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {wishlist && (
                    <div className="mt-4 border-t pt-4">
                      {wishlist.private ? (
                        <p className="text-sm text-[var(--color-text-secondary)] flex items-center gap-2">
                          <EyeOff className="w-4 h-4" /> This wishlist is private.
                        </p>
                      ) : wishlist.items?.length ? (
                        <div className="grid grid-cols-2 gap-2">
                          {wishlist.items.map(item => (
                            <div key={item.id} className="rounded-xl bg-[var(--color-background-secondary)] p-2">
                              {item.product_image && <img src={item.product_image} alt="" className="w-full aspect-square object-cover rounded-lg mb-2" />}
                              <p className="text-sm font-medium truncate">{item.product_name}</p>
                              <p className="text-xs">${Number(item.product_price || 0).toFixed(2)}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--color-text-secondary)]">No public wishlist items yet.</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {relations.length === 0 && <p className="text-center py-10 text-[var(--color-text-secondary)]">No friend connections yet.</p>}
        </div>
      </div>
    </div>
  );
}
