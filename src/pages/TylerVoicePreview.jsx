import React, { useState } from 'react';
import ConciergeIntro from '@/components/onboarding/ConciergeIntro';
import ConciergeGuide from '@/components/onboarding/ConciergeGuide';
import { Button } from '@/components/ui/button';

// Isolated read-only narration QA: never creates or modifies user profiles.
export default function TylerVoicePreview() {
  const [page, setPage] = useState(0);
  const [concierge, setConcierge] = useState(null);
  const [key, setKey] = useState(0);
  return <div className="min-h-screen bg-gradient-to-b from-[#faf8f5] to-[#f5f0ea] p-6 pt-12">
    <div className="max-w-md mx-auto">
      <p className="text-sm text-[#6b7280] mb-5">Voice preview only — no account changes or saved information.</p>
      {page === 0 ? <ConciergeIntro key={key} user={null} onSelectConcierge={setConcierge} onComplete={() => setPage(1)} /> :
        <div className="pt-12">
          <ConciergeGuide key={key} concierge={concierge} message="Perfect! Let's start with the basics. Tell me a bit about yourself." />
          <h1 className="text-4xl text-[#2d2d2d] mt-8 mb-3">Let's get to know you</h1>
          <p className="text-[#6b7280] mb-8">This is a safe narration preview of the second onboarding page.</p>
          <Button onClick={() => setKey(n => n + 1)} className="w-full mb-4">Replay voice prompt</Button>
          <Button variant="outline" onClick={() => { window.speechSynthesis?.cancel(); setPage(0); setConcierge(null); setKey(n => n + 1); }} className="w-full">Back to welcome</Button>
        </div>}
    </div>
  </div>;
}
