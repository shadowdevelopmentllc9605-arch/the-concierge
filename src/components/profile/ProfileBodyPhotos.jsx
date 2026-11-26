import React,{lazy,Suspense,useState} from 'react';
import {base44} from '@/api/base44Client';
import LocalPhotoPreparation from '@/components/tryon/LocalPhotoPreparation';
const BodyScan=lazy(()=>import('@/components/onboarding/BodyScan'));
const privateScansEnabled=import.meta.env.VITE_PRIVATE_UPLOADS_ENABLED==='true'&&import.meta.env.VITE_BODY_SCANS_ENABLED==='true';
const scanFields=['body_scan_front','body_scan_side','body_scan_back','measurement_values_cm','measurement_scan_values_cm','measurement_protocol_version','measurement_reference_standard','measurement_unit','measurement_confidence','measurement_confidence_by_field','measurement_sources','measurement_validation_status','measurement_scan_diagnostics','measurement_method','measurement_updated_at','measurements','suggested_sizes'];
export default function ProfileBodyPhotos({profile,userId,onSaved}){
 const [mode,setMode]=useState(null);
 const [notice,setNotice]=useState('');
 const eligible=Boolean(userId&&profile?.id&&profile.user_id===userId);
 async function saveScan(data){
  if(!Object.keys(data||{}).length){setMode(null);return;}
  if(!privateScansEnabled||!eligible)throw Error('Body scan unavailable');
  const user=await base44.auth.me();
  if(user?.id!==userId)throw Error('Account changed');
  const rows=await base44.entities.UserProfile.filter({user_id:userId});
  const owned=rows.find(row=>row.id===profile.id&&row.user_id===userId);
  if(!owned)throw Error('Profile unavailable');
  const patch=Object.fromEntries(scanFields.filter(k=>Object.hasOwn(data,k)).map(k=>[k,data[k]]));
  if(!['body_scan_front','body_scan_side','body_scan_back'].every(k=>typeof patch[k]==='string'&&patch[k].startsWith('concierge-sensitive/'+userId+'/')))throw Error('Private scan ownership could not be verified');
  await base44.entities.UserProfile.update(owned.id,patch);
  onSaved({...owned,...patch});
  setNotice('Body scan and reviewed measurements saved.');setMode(null);
 }
 if(!eligible)return null;
 return <section aria-label="Body photos" className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-light)] p-4 space-y-3">
  <h2 className="font-medium text-[var(--color-text-primary)]">Body Photos</h2>
  <p className="text-sm text-[var(--color-text-secondary)]">Return here any time after creating your profile to prepare a photo or revisit your fit scan.</p>
  <p className="text-sm text-[var(--color-text-secondary)]">{privateScansEnabled?'Front, side and back scans can be reviewed and retaken. Confirming the scan replaces the previous fit measurements.':'Saving front, side and back body photos is currently paused. You can still test a temporary photo on your device.'}</p>
  <button type="button" aria-expanded={mode==='local'} disabled={mode==='scan'} onClick={()=>{setNotice('');setMode(mode==='local'?null:'local');}} className="w-full min-h-12 rounded-xl bg-[#1a1a1a] text-white px-3">{mode==='local'?'Close temporary photo preview':'Prepare or test a photo'}</button>
  {privateScansEnabled&&<button type="button" disabled={mode==='scan'} onClick={()=>{setNotice('');setMode('consent');}} className="w-full min-h-12 rounded-xl border border-[var(--color-border-light)] text-[var(--color-text-primary)]">Add or retake body scan photos</button>}
  {mode==='local'&&<div className="rounded-xl bg-[#1a1a1a] text-white p-3"><LocalPhotoPreparation/></div>}
  {mode==='consent'&&<div className="space-y-3"><p className="text-sm text-[var(--color-text-primary)]">Opening the fit scan allows private storage of body photos. Only continue if you want to update your fit profile. Review the measurements before saving.</p><button type="button" onClick={()=>setMode('scan')} className="w-full min-h-12 rounded-xl bg-[#1a1a1a] text-white">Agree and open body scan</button><button type="button" onClick={()=>setMode(null)} className="w-full min-h-11 text-[var(--color-text-primary)]">Cancel</button></div>}
  {mode==='scan'&&privateScansEnabled&&<div className="bg-[#faf8f5] text-[#2d2d2d] rounded-xl p-3"><Suspense fallback={<p role="status">Loading fit scan…</p>}><BodyScan profile={profile} onComplete={saveScan}/></Suspense></div>}
  {notice&&<p role="status" className="text-sm text-[var(--color-text-primary)]">{notice}</p>}
 </section>;
}
