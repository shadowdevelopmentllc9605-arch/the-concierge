import React,{useState} from 'react';
import {buildOutfitPreview,changeOutfit,OUTFIT_DEFAULT,OUTFIT_PALETTES} from '@/lib/outfitPreview';
import {FITTING_PRESETS,svgPoints} from '@/lib/virtualFittingGeometry';
import GarmentLayers from '@/components/tryon/GarmentLayers';
export default function OutfitPreview(){
 const [config,setConfig]=useState(OUTFIT_DEFAULT);
 const plan=buildOutfitPreview(config);
 const f=plan.frame;
 const field=(key,label,options)=><label className="block text-sm space-y-1"><span>{label}</span><select value={config[key]} onChange={e=>setConfig(prev=>changeOutfit(prev,key,e.target.value))} className="block w-full rounded-lg bg-[#242424] text-white border border-white/20 p-2">{options.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>;
 return <section aria-label="Sample outfit builder" className="mt-5 rounded-2xl border border-white/15 bg-white/5 p-4 space-y-3">
  <p className="text-xs uppercase tracking-widest text-[#c9a962]">Illustration only · original sample clothing</p>
  <h2 className="text-lg font-medium">Build a sample outfit</h2>
  <p className="text-sm text-white/70">Combine garments and colors on a synthetic mannequin. No personal photograph or retailer image is used. This does not show actual garment fit or drape.</p>
  <div className="grid grid-cols-2 gap-3">
   {field('base','Outfit type',[['separates','Shirt + bottoms'],['dress','Dress']])}
   {config.base==='separates'&&field('bottom','Bottoms',[['trousers','Trousers'],['skirt','Skirt']])}
   {field('outer','Outer layer',[['none','None'],['jacket','Open jacket']])}
   {field('shoes','Footwear',[['none','None'],['loafers','Loafers']])}
   {field('palette','Color palette',Object.keys(OUTFIT_PALETTES).map(k=>[k,k[0].toUpperCase()+k.slice(1)]))}
   {field('preset','Mannequin',FITTING_PRESETS.map(p=>[p.id,p.label]))}
  </div>
  {plan.ok?<svg viewBox="0 0 300 390" role="img" aria-label="Synthetic mannequin wearing the selected sample outfit" className="w-full max-w-[300px] mx-auto block">
   <rect width="300" height="390" rx="18" fill="#232323"/>
   <ellipse cx={f.hipCenter.x} cy="371" rx="64" ry="7" fill="#151515"/>
   <circle cx={f.shoulderCenter.x} cy={f.shoulderCenter.y-53} r="25" fill="#aaa8a1"/>
   <path d={'M'+f.shoulderCenter.x+' '+(f.shoulderCenter.y-29)+' L'+f.shoulderCenter.x+' '+f.shoulderCenter.y} stroke="#aaa8a1" strokeWidth="21" strokeLinecap="round"/>
   <polygon points={svgPoints([f.left.shoulder,f.right.shoulder,f.right.hip,f.left.hip])} fill="#aaa8a1"/>
   {[f.left,f.right].map((arm,i)=><polyline key={i} points={svgPoints([arm.shoulder,arm.elbow,arm.wrist])} stroke="#aaa8a1" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" fill="none"/>)}
   {[f.left.hip.x+11,f.right.hip.x-11].map((x,i)=><path key={i} d={'M'+x+' '+f.hipCenter.y+' L'+x+' 352'} stroke="#aaa8a1" strokeWidth="19" strokeLinecap="round"/>)}
   {plan.paths.map(p=><path key={p.role} d={p.d} fill={p.fill} stroke="#1a1a1a" strokeWidth=".8"/>)}
   <GarmentLayers layers={plan.layers}/>
  </svg>:<p role="status">This sample combination cannot be illustrated safely. Reset and try again.</p>}
  <button type="button" onClick={()=>setConfig(OUTFIT_DEFAULT)} className="w-full rounded-xl border border-white/20 py-3 text-sm">Reset sample outfit</button>
  <p className="text-xs text-white/60">Sample garments only. No stock, purchase, fit or size claim.</p>
 </section>;
}
