import React from 'react';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FAQS = [
  ['How are my measurements estimated?', 'The Concierge uses your measured height plus front, side, and back photos for on-device pose and silhouette analysis. The scan checks pose, orientation, framing, and view consistency before producing measurements. Photo measurements are estimates and should be reviewed before fit decisions.'],
  ['Why can my size differ by brand?', 'Brands use different size charts and ease. When a retailer supplies a product size chart, The Concierge compares your measurements with that specific chart.'],
  ['Who can see my wishlist?', 'Your wishlist is private unless you choose to make it public. Accepted friends can only view public wishlist items when your overall wishlist visibility is public.'],
  ['What happens when I check in at a store?', 'For participating linked stores, your check-in can share store-specific wishlist and profile information with Concierge Pro so an employee can assist you.'],
  ['Can the app charge my card yet?', 'Card processing is only enabled when a production payment provider is connected. The app never marks an unsupported card payment successful.'],
  ['Can I correct or verify a body scan?', 'Yes. Review scan results before continuing, or open Profile → My Measurements later. You can correct any estimate in metric or imperial units and mark measurements you actually checked with a tape or ruler as verified. Verified measurements receive higher confidence in fit recommendations.'],
];

export default function FAQ() {
  const navigate = useNavigate();
  return <div className="min-h-screen bg-[var(--color-background)] pb-24">
    <div className="px-6 py-4 flex items-center gap-4"><button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-[var(--color-surface)] flex items-center justify-center"><ArrowLeft className="w-5 h-5" /></button><h1 className="text-2xl font-light">FAQ</h1></div>
    <div className="px-6 space-y-3">
      {FAQS.map(([q,a]) => <div key={q} className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border-light)]"><div className="flex gap-2 items-start"><HelpCircle className="w-5 h-5 mt-0.5 text-[var(--color-accent)]" /><div><h2 className="font-medium">{q}</h2><p className="text-sm text-[var(--color-text-secondary)] mt-2 leading-relaxed">{a}</p></div></div></div>)}
    </div>
  </div>;
}
