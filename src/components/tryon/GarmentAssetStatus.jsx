import React,{useState} from 'react';
import {garmentCatalogStatus,garmentVariantOptions} from '@/lib/garmentCatalog';
export default function GarmentAssetStatus({product}){
 const [selected,setSelected]=useState('');
 const status=garmentCatalogStatus(product);
 const variants=garmentVariantOptions(product);
 const messages={unsupported_category:'This garment category is not supported by the planned renderer.',variant_review_required:'A verified catalog color variant is needed before garment image review.',asset_review_required:'The selected catalog variant requires an approved garment image and renderer support.',unavailable:'This product is not available for try-on.'};
 return <section aria-label="Garment preview availability" className="rounded-xl border border-white/10 p-4 space-y-3">
  <p className="font-medium">Virtual try-on unavailable for this item</p>
  <p className="text-sm text-white/75">{messages[status]}</p>
  {variants.length>0&&<div><label htmlFor="tryon-garment-variant" className="block text-sm mb-2">Catalog color / size reference</label><select id="tryon-garment-variant" value={variants.some(v=>v.id===selected)?selected:''} onChange={e=>setSelected(e.target.value)} className="w-full rounded-lg border border-white/20 bg-[#242424] text-white p-3"><option value="">Select a catalog variant</option>{variants.map(v=><option key={v.id} value={v.id}>{v.color}{v.size?' · '+v.size:''}</option>)}</select><p className="mt-2 text-xs text-white/60">Reference only; not a stock confirmation, size recommendation or generated preview.</p></div>}
 </section>;
}
