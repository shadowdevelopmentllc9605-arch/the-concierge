import React,{useCallback,useEffect,useState} from 'react';
import {BODY_PHOTO_VIEWS,BODY_PHOTO_SETUP} from '@/lib/bodyPhotoViews';
import LocalPhotoPreparation from '@/components/tryon/LocalPhotoPreparation';
export default function GuidedBodyPhotoPreparation(){
 const [consent,setConsent]=useState(false);
 const [selected,setSelected]=useState('front');
 const [ready,setReady]=useState({});
 const onReady=useCallback((id,value)=>setReady(prev=>prev[id]===value?prev:{...prev,[id]:value}),[]);
 const count=BODY_PHOTO_VIEWS.filter(view=>ready[view.id]).length;
 useEffect(()=>{
  const clear=()=>{setConsent(false);setReady({});setSelected('front');};
  window.addEventListener('pagehide',clear);
  return ()=>window.removeEventListener('pagehide',clear);
 },[]);
 return <section aria-label="Guided body photo preparation" className="rounded-xl bg-[#1a1a1a] text-white p-4 space-y-4">
  <h2 className="text-lg font-medium">Prepare your body photos</h2>
  <p className="text-sm text-white/80">Capture or select three full-body views. Photos stay on this device temporarily; they are not saved to your profile, uploaded or used for measurement analysis.</p>
  <p className="text-sm text-white/80">{BODY_PHOTO_SETUP}</p>
  <label className="flex gap-3 items-start text-sm"><input type="checkbox" checked={consent} onChange={e=>{setReady({});setConsent(e.target.checked);}} className="mt-1 accent-[#c9a962]"/><span>I agree to open my own photos on this device for temporary previews only.</span></label>
  <p role="status" className="text-sm">{count} of 3 photos prepared · Basic file checks only</p>
  <div className="grid grid-cols-3 gap-2" aria-label="Photo views">
   {BODY_PHOTO_VIEWS.map(view=><button key={view.id} type="button" aria-pressed={selected===view.id} onClick={()=>setSelected(view.id)} className={'min-h-12 rounded-lg border border-white/30 text-sm px-1 py-2 '+(selected===view.id?'bg-white text-[#1a1a1a]':'bg-[#242424] text-white')}>{view.label}{ready[view.id]&&<span className="block text-xs">Ready</span>}</button>)}
  </div>
  {consent?BODY_PHOTO_VIEWS.map(view=><div key={view.id} hidden={selected!==view.id}><LocalPhotoPreparation view={view} embedded sharedConsent={consent} onReady={onReady}/></div>):<p className="text-sm text-white/80">{BODY_PHOTO_VIEWS.find(view=>view.id===selected)?.instruction} Agree above to enable the camera and gallery controls.</p>}
  {count===3&&<p role="status" className="text-sm text-white">All three temporary photos are prepared. Pose, lighting, orientation and measurements have not been assessed.</p>}
  <p className="text-xs text-white/70">Switching views keeps the temporary previews. Closing this panel, leaving the page or withdrawing consent clears them. Your original photos remain on your device.</p>
 </section>;
}
