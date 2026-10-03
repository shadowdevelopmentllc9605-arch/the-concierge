import React from 'react';
import { ArrowLeft, MessageCircle, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';

export default function Support() {
  const navigate = useNavigate();
  return <div className="min-h-screen bg-[var(--color-background)] px-6 py-6 pb-24">
    <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-[var(--color-surface)] flex items-center justify-center mb-6"><ArrowLeft className="w-5 h-5" /></button>
    <h1 className="text-3xl font-light mb-2">Support</h1>
    <p className="text-[var(--color-text-secondary)] mb-8">Get help with shopping, fit, account, or in-store experiences.</p>
    <div className="space-y-3">
      <Button variant="outline" className="w-full h-14 justify-start" onClick={() => navigate(createPageUrl('FAQ'))}><HelpCircle className="w-5 h-5 mr-3" />Read FAQs</Button>
      <Button className="w-full h-14 justify-start" onClick={() => navigate(createPageUrl('Feedback'))}><MessageCircle className="w-5 h-5 mr-3" />Contact Customer Service</Button>
    </div>
  </div>;
}
