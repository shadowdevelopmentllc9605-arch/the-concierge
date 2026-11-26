import React,{useEffect,useRef,useState} from 'react';
import {checkPhotoFile,checkPhotoDimensions,inspectPhotoHeader,PHOTO_MESSAGES} from '@/lib/tryOnPhoto';
import {photoJobGate,previewDimensions} from '@/lib/tryOnMobile';

export default function LocalPhotoPreparation(){
 const [consent,setConsent]=useState(false);
 const [preview,setPreview]=useState(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const current=useRef({generation:0,url:null});
 const input=useRef(null);
 function release(){
  current.current.generation++;
  if(current.current.url)URL.revokeObjectURL(current.current.url);
  current.current.url=null;
 }
 function clear(){
  release();setPreview(null);setBusy(false);setMessage('');
  if(input.current)input.current.value='';
 }
 useEffect(()=>{
  const record=current.current;
  const leave=()=>{
   record.generation++;
   if(record.url)URL.revokeObjectURL(record.url);
   record.url=null;
   setPreview(null);setBusy(false);setMessage('');setConsent(false);
   if(input.current)input.current.value='';
  };
  window.addEventListener('pagehide',leave);
  return ()=>{
   window.removeEventListener('pagehide',leave);
   record.generation++;
   if(record.url)URL.revokeObjectURL(record.url);
   record.url=null;
  };
 },[]);
 async function choose(event){
  const file=event.target.files?.[0];
  event.target.value='';
  if(!file||!consent)return;
  clear();
  const generation=current.current.generation;
  const active=()=>current.current.generation===generation;
  const reject=reason=>{if(active())setMessage(PHOTO_MESSAGES[reason]||PHOTO_MESSAGES.invalid_image);};
  const initial=checkPhotoFile(file);
  if(!initial.ok){reject(initial.reason);return;}
  const unlock=photoJobGate.acquire();
  if(!unlock){setMessage('The previous photo check is still finishing. Choose your photo again shortly.');return;}
  setBusy(true);
  let bitmap,canvas;
  try{
   const header=inspectPhotoHeader(new Uint8Array(await file.arrayBuffer()),file.type);
   if(!active())return;
   if(!header.ok){reject(header.reason);return;}
   if(typeof createImageBitmap!=='function'){reject('invalid_image');return;}
   bitmap=await createImageBitmap(file.slice(0,file.size,header.type),{imageOrientation:'from-image'});
   if(!active())return;
   const dims=checkPhotoDimensions(bitmap.width,bitmap.height);
   if(!dims.ok){reject(dims.reason);return;}
   if(!((bitmap.width===header.width&&bitmap.height===header.height)||(bitmap.width===header.height&&bitmap.height===header.width))){reject('invalid_image');return;}
   const target=previewDimensions(bitmap.width,bitmap.height);
   if(!target)throw Error('Invalid preview dimensions');
   canvas=document.createElement('canvas');
   canvas.width=target.width;canvas.height=target.height;
   const ctx=canvas.getContext('2d');
   if(!ctx)throw Error('Canvas unavailable');
   ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
   const width=bitmap.width,height=bitmap.height;
   bitmap.close();bitmap=null;
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.85));
   if(!active())return;
   if(!blob)throw Error('Preview unavailable');
   const url=URL.createObjectURL(blob);
   current.current.url=url;
   setPreview({url,width,height});
   setMessage('Basic file checks passed. Pose, lighting and fit have not been assessed.');
  }catch{reject('invalid_image');}
  finally{
   try{bitmap?.close();if(canvas){canvas.width=0;canvas.height=0;}}
   finally{unlock();if(active())setBusy(false);}
  }
 }
 return <section aria-label="Private photo preparation" className="mt-5 rounded-2xl border border-white/15 bg-white/5 p-4 space-y-3">
  <h2 className="text-lg font-medium">Prepare your photo</h2>
  <p className="text-sm text-white/75">Optional, device-only preview. No photo is uploaded, saved to your profile or sent to a rendering service. Real garment previews are not available yet.</p>
  <p className="text-sm text-white/75">Use a well-lit photo of yourself, fully clothed, standing facing the camera with your arms relaxed. Choose a still JPEG or PNG (up to 10 MB).</p>
  <label className="flex gap-3 items-start text-sm"><input type="checkbox" checked={consent} onChange={e=>{clear();setConsent(e.target.checked);}} className="mt-1 accent-[#c9a962]"/><span>I agree to open my own photo on this device for this temporary preview only.</span></label>
  <label className="block text-sm font-medium" htmlFor="tryon-local-photo">Choose photo</label>
  <input id="tryon-local-photo" ref={input} type="file" accept="image/jpeg,image/png" disabled={!consent||busy} onChange={choose} className="block w-full min-h-11 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#c9a962] file:px-3 file:py-2 file:text-[#1a1a1a] disabled:opacity-50"/>
  {busy&&<p role="status" className="text-sm">Checking photo on this device…</p>}
  {preview&&<div className="space-y-2"><img src={preview.url} alt="Your temporary local photo preview" className="mx-auto max-h-80 max-w-full rounded-xl object-contain"/><p className="text-xs text-white/70">{preview.width} × {preview.height} pixels · Local preview only</p></div>}
  {message&&<p role="status" className="text-sm text-white/80">{message}</p>}
  {(busy||preview||message)&&<button type="button" onClick={clear} className="w-full min-h-11 rounded-xl border border-white/30 py-3 text-sm">{busy?'Cancel photo check':'Remove photo'}</button>}
  <p className="text-xs text-white/60">Leaving this screen or withdrawing consent clears the app preview. Your original photo stays on your device.</p>
 </section>;
}
