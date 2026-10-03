import React, { useState } from 'react';
import { ArrowLeft, MessageCircle, HelpCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

export default function Support() {
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const retrySync = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const response = await base44.functions.invoke('retryIntegrationSyncs', {});
      const result = response?.data || response;
      const failures = result?.failures?.length || 0;
      setSyncMessage(
        failures
          ? `Retried ${result.attempted || 0} event(s): ${result.completed || 0} completed, ${failures} still pending.`
          : `Sync is healthy. ${result.completed || 0} pending event(s) were completed.`
      );
    } catch (error) {
      setSyncMessage(error?.response?.data?.error || error?.message || 'Sync retry could not run.');
    } finally {
      setSyncing(false);
    }
  };

  return <div className="min-h-screen bg-[var(--color-background)] px-6 py-6 pb-24">
    <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-[var(--color-surface)] flex items-center justify-center mb-6"><ArrowLeft className="w-5 h-5" /></button>
    <h1 className="text-3xl font-light mb-2">Support</h1>
    <p className="text-[var(--color-text-secondary)] mb-8">Get help with shopping, fit, account, or in-store experiences.</p>
    <div className="space-y-3">
      <Button variant="outline" className="w-full h-14 justify-start" onClick={() => navigate(createPageUrl('FAQ'))}><HelpCircle className="w-5 h-5 mr-3" />Read FAQs</Button>
      <Button variant="outline" className="w-full h-14 justify-start" onClick={retrySync} disabled={syncing}>
        <RefreshCw className={`w-5 h-5 mr-3 ${syncing ? 'animate-spin' : ''}`} />
        Retry Store Sync
      </Button>
      <Button className="w-full h-14 justify-start" onClick={() => navigate(createPageUrl('Feedback'))}><MessageCircle className="w-5 h-5 mr-3" />Contact Customer Service</Button>
    </div>
    {syncMessage && <p className="mt-4 text-sm text-[var(--color-text-secondary)]">{syncMessage}</p>}
  </div>;
}
