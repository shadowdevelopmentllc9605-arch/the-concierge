import React, { useState, useMemo } from 'react';
import { buildWardrobeOutfits, OUTFIT_OCCASIONS } from '@/lib/wardrobeOutfits';

export default function OutfitBuilder({items, onAddItem}) {
  const [occasion,setOccasion]=useState('casual');
  const result=useMemo(()=>buildWardrobeOutfits(items,occasion),[items,occasion]);
  return <section className="rounded-2xl border border-[var(--color-border)] p-4 mb-6 space-y-4" aria-label="Outfit builder">
    <div><h2 className="text-lg font-medium text-[var(--color-text-primary)]">Build an outfit</h2>
    <p className="text-xs text-[var(--color-text-secondary)] mt-1">Coordinate pieces in your wardrobe by occasion and color. Suggestions are not a guarantee of fit or weather suitability.</p></div>
    <div className="flex flex-wrap gap-2">{OUTFIT_OCCASIONS.map(style=><button type="button" key={style} aria-pressed={occasion===style} onClick={()=>setOccasion(style)} className={'capitalize px-3 py-2 rounded-lg text-sm border '+(occasion===style?'bg-black text-white':'bg-[var(--color-surface)] text-[var(--color-text-primary)]')}>{style}</button>)}</div>
    <button type="button" onClick={onAddItem} className="w-full rounded-xl border border-[var(--color-border)] py-3 text-sm font-medium text-[var(--color-text-primary)]">Add clothing details (no photo needed)</button>
    {result.outfits.length===0?<div role="status" className="text-sm text-[var(--color-text-secondary)]">Not enough compatible saved clothing yet. {result.missing.length?'Add '+result.missing.join(' and ')+'.':'Try another occasion or edit the clothing details.'}</div>:result.outfits.map((outfit,index)=><article key={outfit.id} className="rounded-xl bg-[var(--color-surface)] p-3 border border-[var(--color-border-light)]">
      <h3 className="font-medium text-[var(--color-text-primary)]">Look {index+1} · {outfit.complete?'Suggested outfit':'Partial outfit'}</h3>
      <ul className="mt-2 space-y-2">{outfit.items.map(item=><li key={item.id} className="flex items-center gap-3 text-sm text-[var(--color-text-primary)]">{item.image?<img src={item.image} alt="" className="w-12 h-12 rounded-md object-cover"/>:<div className="w-12 h-12 rounded-md bg-[var(--color-placeholder)] flex items-center justify-center text-[10px]">No photo</div>}<span>{item.item_type}{item.color?' · '+item.color:''}</span></li>)}</ul>
      {outfit.missing.length>0&&<p className="text-xs text-[var(--color-text-secondary)] mt-2">Still needed: {outfit.missing.join(', ')}</p>}
    </article>)}
  </section>;
}
