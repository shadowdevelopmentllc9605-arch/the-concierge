import React, { useState, useMemo, useEffect } from 'react';
import { buildWardrobeOutfits, OUTFIT_OCCASIONS } from '@/lib/wardrobeOutfits';

import { buildStyleFeedback, outfitVoteValue } from '@/lib/styleFeedback';
import { loadStyleVotes, saveStyleVote } from '@/lib/styleFeedbackService';

export default function OutfitBuilder({items, onAddItem, userId}) {
  const [occasion,setOccasion]=useState('casual');
  const [rows,setRows]=useState([]);
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{
    let active=true;setRows([]);setReady(false);setMessage('');
    if(userId)loadStyleVotes(userId).then(data=>{if(active){setRows(data);setReady(true);}}).catch(()=>{if(active)setMessage('Style feedback unavailable. You can still build outfits.');});
    return ()=>{active=false;};
  },[userId]);
  const model=useMemo(()=>buildStyleFeedback(rows,userId),[rows,userId]);
  const result=useMemo(()=>buildWardrobeOutfits(items,occasion,model),[items,occasion,model]);
  const vote=async(outfit,value)=>{
    if(busy||!ready)return;
    const ids=outfit.items.map(i=>String(i.id));
    const previous=outfitVoteValue(model,outfit.occasion,ids);
    setBusy(true);setMessage('');
    try{
      const row=await saveStyleVote(userId,{kind:'outfit',occasion:outfit.occasion,itemIds:ids},previous===value?0:value);
      setRows(prev=>[row,...prev].slice(0,300));
      setMessage(previous===value?'Rating cleared.':'Saved. Future outfit suggestions will use your feedback.');
    }catch{setMessage('Could not save feedback. Please try again.');}
    finally{setBusy(false);}
  };
  return <section className="rounded-2xl border border-[var(--color-border)] p-4 mb-6 space-y-4" aria-label="Outfit builder">
    <div><h2 className="text-lg font-medium text-[var(--color-text-primary)]">Build an outfit</h2>
    <p className="text-xs text-[var(--color-text-secondary)] mt-1">Coordinate pieces in your wardrobe by occasion and color. Suggestions are not a guarantee of fit or weather suitability.</p></div>
    <div className="flex flex-wrap gap-2">{OUTFIT_OCCASIONS.map(style=><button type="button" key={style} aria-pressed={occasion===style} onClick={()=>setOccasion(style)} className={'capitalize px-3 py-2 rounded-lg text-sm border '+(occasion===style?'bg-black text-white':'bg-[var(--color-surface)] text-[var(--color-text-primary)]')}>{style}</button>)}</div>
    <button type="button" onClick={onAddItem} className="w-full rounded-xl border border-[var(--color-border)] py-3 text-sm font-medium text-[var(--color-text-primary)]">Add clothing details (no photo needed)</button>
    {message&&<p role="status" className="text-xs text-[var(--color-text-secondary)]">{message}</p>}
    {result.outfits.length===0?<div role="status" className="text-sm text-[var(--color-text-secondary)]">Not enough compatible saved clothing yet. {result.missing.length?'Add '+result.missing.join(' and ')+'.':'Try another occasion or edit the clothing details.'}</div>:result.outfits.map((outfit,index)=><article key={outfit.id} className="rounded-xl bg-[var(--color-surface)] p-3 border border-[var(--color-border-light)]">
      <h3 className="font-medium text-[var(--color-text-primary)]">Look {index+1} · {outfit.complete?'Suggested outfit':'Partial outfit'}</h3>
      <ul className="mt-2 space-y-2">{outfit.items.map(item=><li key={item.id} className="flex items-center gap-3 text-sm text-[var(--color-text-primary)]">{item.image?<img src={item.image} alt="" className="w-12 h-12 rounded-md object-cover"/>:<div className="w-12 h-12 rounded-md bg-[var(--color-placeholder)] flex items-center justify-center text-[10px]">No photo</div>}<span>{item.item_type}{item.color?' · '+item.color:''}</span></li>)}</ul>
      {outfit.missing.length>0&&<p className="text-xs text-[var(--color-text-secondary)] mt-2">Still needed: {outfit.missing.join(', ')}</p>}
      <div className="flex gap-2 mt-3">{[[1,'Like this look'],[-1,'Not my style']].map(([value,label])=><button key={value} type="button" disabled={!ready||busy} aria-pressed={outfitVoteValue(model,outfit.occasion,outfit.items.map(i=>String(i.id)))===value} onClick={()=>vote(outfit,value)} className={'flex-1 rounded-lg border py-2 text-xs font-medium disabled:opacity-50 '+(outfitVoteValue(model,outfit.occasion,outfit.items.map(i=>String(i.id)))===value?'bg-black text-white':'text-[var(--color-text-primary)]')}>{label}</button>)}</div>
    </article>)}
  </section>;
}
