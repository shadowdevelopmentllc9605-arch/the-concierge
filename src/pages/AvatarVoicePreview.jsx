import React, { useState, useEffect } from 'react';
import ConciergeIntro from '@/components/onboarding/ConciergeIntro';
import ConciergeGuide from '@/components/onboarding/ConciergeGuide';
import { Button } from '@/components/ui/button';
import { stopOnboardingSpeech } from '@/lib/onboardingVoices';
import prompts from '@/lib/avatarVoicePrompts.json';

const labels = { profile: 'Profile setup', measurements: 'Body measurements (deferred)', review: 'Measurement review (deferred)', style: 'Style preferences', closet: 'Digital closet', friends: 'Connecting with friends' };
export default function AvatarVoicePreview() {
  const [concierge, setConcierge] = useState(null);
  const [page, setPage] = useState('welcome');
  const [key, setKey] = useState(0);
  useEffect(() => () => stopOnboardingSpeech(), []);
  return <main className="min-h-screen bg-gradient-to-b from-[#faf8f5] to-[#f5f0ea] p-6 pt-12"><div className="max-w-md mx-auto">
    <p className="text-sm text-[#6b7280] mb-5">Voice preview only — no account changes or saved information. Body-scan narration is an audio audition, not activation of the paused feature.</p>
    {page === 'welcome' ? <ConciergeIntro key={key} user={null} onSelectConcierge={setConcierge} onComplete={() => setPage('profile')} /> : concierge && <div>
      <h1 className="text-2xl font-medium text-[#2d2d2d] mb-4">{concierge.name}: {labels[page]}</h1>
      <ConciergeGuide key={page + key} concierge={concierge} message={prompts[concierge.id][page]} autoPlay={false} />
      <div className="grid grid-cols-1 gap-2 my-6">
        {Object.entries(labels).map(([id, label]) => <Button key={id} variant={page === id ? 'default' : 'outline'} onClick={() => { stopOnboardingSpeech(); setPage(id); }}>{label}</Button>)}
      </div>
      <Button variant="outline" onClick={() => { stopOnboardingSpeech(); setPage('welcome'); setConcierge(null); setKey(n => n + 1); }} className="w-full">Back to avatar selection</Button>
    </div>}
  </div></main>;
}
