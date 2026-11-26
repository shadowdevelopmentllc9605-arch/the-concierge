import React,{useState} from 'react';
import {DEMO_GARMENTS} from '@/lib/tryOnFoundation';
import {FITTING_PRESETS,syntheticPose,alignGarment,svgPoints} from '@/lib/virtualFittingGeometry';

export default function TryOnDemo(){
  const [selected,setSelected]=useState('demo-shirt');
  const [preset,setPreset]=useState('balanced');
  const [landmarks,setLandmarks]=useState(false);
  const garment=DEMO_GARMENTS.find(item=>item.id===selected)||DEMO_GARMENTS[0];
  const pose=syntheticPose(preset);
  const fit=alignGarment(pose,300,390,garment.id);
  const f=fit.frame;
  const button=(active)=>'rounded-xl px-3 py-2 text-sm border border-white/20 '+(active?'bg-[#c9a962] text-[#1a1a1a]':'bg-white/5 text-white');
  return <section className="rounded-2xl border border-white/15 bg-white/5 p-4 space-y-3" aria-label="Virtual fitting demonstration">
    <div>
      <p className="text-xs uppercase tracking-widest text-[#c9a962]">Illustrative demo · not a catalog item</p>
      <h2 className="text-lg text-white mt-1">Proportional garment alignment</h2>
      <p className="text-sm text-white/70 mt-1">No personal photograph is used. Change the synthetic body proportions and pose to see the sample garment align to shoulder, hip and arm landmarks. This is a 2-D schematic, not a realistic fitting simulation.</p>
    </div>
    <div className="flex flex-wrap gap-2" aria-label="Sample garment">{DEMO_GARMENTS.map(item=><button key={item.id} type="button" aria-pressed={selected===item.id} onClick={()=>setSelected(item.id)} className={button(selected===item.id)}>{item.label}</button>)}</div>
    <div className="flex flex-wrap gap-2" aria-label="Synthetic body proportions">{FITTING_PRESETS.map(p=><button key={p.id} type="button" aria-pressed={preset===p.id} onClick={()=>setPreset(p.id)} className={button(preset===p.id)}>{p.label}</button>)}</div>
    <button type="button" aria-pressed={landmarks} onClick={()=>setLandmarks(v=>!v)} className={button(landmarks)}>{landmarks?'Hide':'Show'} landmarks</button>
    {fit.ok?<svg viewBox="0 0 300 390" role="img" aria-label={'Synthetic mannequin wearing '+garment.label.toLowerCase()} className="w-full max-w-[280px] mx-auto block">
      <rect width="300" height="390" rx="18" fill="#232323"/>
      <ellipse cx={f.hipCenter.x} cy="371" rx="62" ry="7" fill="#151515"/>
      <circle cx={f.shoulderCenter.x} cy={f.shoulderCenter.y-53} r="25" fill="#aaa8a1"/>
      <path d={'M'+f.shoulderCenter.x+' '+(f.shoulderCenter.y-29)+' L'+f.shoulderCenter.x+' '+f.shoulderCenter.y} stroke="#aaa8a1" strokeWidth="21" strokeLinecap="round"/>
      <polygon points={svgPoints([f.left.shoulder,f.right.shoulder,f.right.hip,f.left.hip])} fill="#aaa8a1"/>
      {[f.left,f.right].map((arm,i)=><polyline key={i} points={svgPoints([arm.shoulder,arm.elbow,arm.wrist])} stroke="#aaa8a1" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" fill="none"/>)}
      <polygon points={svgPoints([f.left.hip,f.right.hip,{x:f.right.hip.x+6,y:356},{x:f.hipCenter.x+13,y:362},{x:f.hipCenter.x,y:f.hipCenter.y+28},{x:f.hipCenter.x-13,y:362},{x:f.left.hip.x-6,y:356}])} fill="#45484d" stroke="#5c6066"/>
      {[fit.leftSleeve,fit.rightSleeve,fit.body].map((points,i)=><polygon key={i} points={svgPoints(points)} fill={garment.color} stroke="#d4d9df" strokeWidth="1.1" strokeLinejoin="round"/>)}
      <polyline points={svgPoints(fit.neck)} stroke="#4c5661" strokeWidth="2.5" strokeLinejoin="round" fill="none"/>
      <polyline points={svgPoints(fit.hem)} stroke="#4c5661" strokeWidth="1" fill="none"/>
      {selected==='demo-jacket'&&<polyline points={svgPoints(fit.seam)} stroke="#6f5f4b" strokeWidth="2" fill="none"/>}
      {landmarks&&[f.left,f.right].map((arm,i)=><g key={i}>{[arm.shoulder,arm.elbow,arm.wrist,arm.hip].map((p,j)=><circle key={j} cx={p.x} cy={p.y} r="4" fill="#ffcf70" stroke="#151515" strokeWidth="1"/>)}</g>)}
    </svg>:<p role="status" className="p-4 text-white/80">This pose cannot be aligned safely. Select a different sample.</p>}
    <p className="text-xs text-white/60 text-center">Sample garment only. No stock, price, size or fit claim.</p>
  </section>;
}
