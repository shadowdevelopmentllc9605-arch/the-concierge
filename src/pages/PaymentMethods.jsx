import { authClient } from '@/api/authClient';
import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, CreditCard, MapPin, Trash2, Loader2, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function PaymentMethods() {
  const navigate = useNavigate();
  const [methods, setMethods] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');

  const load = async () => {
    try {
      const user = await authClient.me();
      const [paymentRows, addressRows] = await Promise.all([
        base44.entities.PaymentMethod.filter({ user_id: user.id }),
        base44.entities.ShippingAddress.filter({ user_id: user.id }),
      ]);
      setMethods(paymentRows);
      setAddresses(addressRows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load().catch(console.error); }, []);

  const removeMethod = async (id) => {
    setWorkingId(id);
    try {
      const response = await base44.functions.invoke('removeSavedPaymentMethod', { paymentMethodId: id });
      const result = response?.data || response;
      if (!result?.success) throw new Error(result?.error || 'Payment method could not be removed.');
      await load();
    } catch (error) {
      alert(error?.response?.data?.error || error?.message || 'Payment method could not be removed.');
    } finally {
      setWorkingId('');
    }
  };

  const removeAddress = async (id) => {
    if (!confirm('Remove this saved shipping address?')) return;
    await base44.entities.ShippingAddress.delete(id);
    await load();
  };

  const setDefaultAddress = async (id) => {
    await Promise.all(addresses.map(address =>
      base44.entities.ShippingAddress.update(address.id, { is_default: address.id === id })
    ));
    await load();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]"><Loader2 className="w-7 h-7 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-24">
      <div className="sticky top-0 z-30 bg-[var(--color-background)]/95 backdrop-blur px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-[var(--color-surface)] flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-light">Payment & Shipping</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Saved after a secure Stripe checkout when you opt in</p>
        </div>
      </div>

      <div className="px-6 space-y-8">
        <section>
          <h2 className="font-medium mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4" /> Saved cards</h2>
          <div className="space-y-3">
            {methods.map(method => (
              <Card key={method.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium capitalize">{method.card_type || 'Card'} •••• {method.card_last_four}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Expires {String(method.expiry_month || '').padStart(2, '0')}/{method.expiry_year || ''}
                      {method.is_default ? ' • Default' : ''}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="text-red-500" disabled={workingId === method.id} onClick={() => removeMethod(method.id)}>
                    {workingId === method.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </Button>
                </CardContent>
              </Card>
            ))}
            {methods.length === 0 && (
              <p className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface)] rounded-2xl p-4 border border-[var(--color-border-light)]">
                No card is stored here. Stripe stores the reusable payment credential; The Concierge only keeps the card brand, last four digits, and expiration date for display.
              </p>
            )}
          </div>
        </section>

        <section>
          <h2 className="font-medium mb-3 flex items-center gap-2"><MapPin className="w-4 h-4" /> Saved shipping addresses</h2>
          <div className="space-y-3">
            {addresses.map(address => (
              <Card key={address.id}>
                <CardContent className="p-4 flex gap-3">
                  <MapPin className="w-5 h-5 mt-0.5 text-[var(--color-accent)]" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{address.name || 'Shipping address'}</p>
                      {address.is_default && <Star className="w-4 h-4 fill-current text-[var(--color-accent)]" />}
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                      {address.line1}{address.line2 ? `, ${address.line2}` : ''}<br />
                      {address.city}, {address.state} {address.postal_code}
                    </p>
                    {!address.is_default && (
                      <button className="text-xs text-[var(--color-accent)] mt-2" onClick={() => setDefaultAddress(address.id)}>Make default</button>
                    )}
                  </div>
                  <Button size="icon" variant="ghost" className="text-red-500" onClick={() => removeAddress(address.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            {addresses.length === 0 && (
              <p className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface)] rounded-2xl p-4 border border-[var(--color-border-light)]">
                No shipping address saved yet. You can choose “Save shipping address” during checkout.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
