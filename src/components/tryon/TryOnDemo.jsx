import React, { useState } from 'react';
import { DEMO_GARMENTS } from '@/lib/tryOnFoundation';

export default function TryOnDemo() {
  const [selected,setSelected]=useState('demo-shirt');
  const garment=DEMO_GARMENTS.find(item=>item.id===selected)||DEMO_GARMENTS[0];
  return <section className="rounded-2xl border border-white/15 bg-white/5 p-4 space-y-3" aria-label="Virtual try-on demonstration">
    <div>
      <p className="text-xs uppercase tracking-widest text-[#c9a962]">Illustrative demo · not a catalog item</p>
      <h2 className="text-lg text-white mt-1">Explore the preview</h2>
      <p className="text-sm text-white/70 mt-1">A generic mannequin and original sample clothing. No personal photograph is used. This is a schematic, not a realistic fitting simulation.</p>
    </div>
    <div className="flex flex-wrap gap-2">{DEMO_GARMENTS.map(item=><button key={item.id} type="button" aria-pressed={selected===item.id} onClick={()=>setSelected(item.id)} className={'rounded-xl px-4 py-2 text-sm border border-white/20 '+(selected===item.id?'bg-[#c9a962] text-[#1a1a1a]':'bg-white/5 text-white')}>{item.label}</button>)}</div>
    <svg viewBox="0 0 300 390" role="img" aria-label={'Generic mannequin wearing '+garment.label.toLowerCase()} className="w-full max-w-[270px] mx-auto block">
      <rect x="1" y="1" width="298" height="388" rx="18" fill="#232323"/>
      <ellipse cx="150" cy="371" rx="62" ry="7" fill="#151515"/>
      <circle cx="150" cy="51" r="26" fill="#aaa8a1"/>
      <path d="M137 74 L137 87 L112 94 Q99 96 89 114 L63 207 Q61 217 69 220 Q76 223 81 210 L109 155 L116 222 L109 354 L136 362 L150 245 L164 362 L191 354 L184 222 L191 155 L219 210 Q224 223 231 220 Q239 217 237 207 L211 114 Q201 96 188 94 L163 87 L163 74 Z" fill="#aaa8a1"/>
      <path d="M116 217 L184 217 L191 354 L164 362 L150 245 L136 362 L109 354 Z" fill="#45484d" stroke="#5c6066"/>
      {selected==='demo-shirt'?<g>
        <path d="M111 93 L132 85 Q150 111 168 85 L189 93 L214 109 L203 145 L187 137 L183 218 L117 218 L113 137 L97 145 L86 109 Z" fill={garment.color} stroke="#d4d9df" strokeWidth="1.5"/>
        <path d="M132 86 Q150 112 168 86" fill="none" stroke="#485f79" strokeWidth="4"/>
        <path d="M117 209 H183" stroke="#63788f"/>
      </g>:<g>
        <path d="M111 93 L133 85 L150 109 L167 85 L189 93 L211 108 L237 207 L219 213 L190 145 L190 228 L110 228 L110 145 L81 213 L63 207 L89 108 Z" fill={garment.color} stroke="#d7c9b6" strokeWidth="1.5"/>
        <path d="M133 85 L126 113 L143 132 L150 109 L157 132 L174 113 L167 85 M150 110 V228 M117 170 H137 M163 170 H183" fill="none" stroke="#6f5f4b" strokeWidth="2"/>
        <circle cx="154" cy="155" r="2.5" fill="#6f5f4b"/><circle cx="154" cy="185" r="2.5" fill="#6f5f4b"/>
      </g>}
    </svg>
    <p className="text-xs text-white/60 text-center">Sample garment only. No stock, price, size or fit claim.</p>
  </section>;
}
