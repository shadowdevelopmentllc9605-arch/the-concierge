import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, ChevronLeft, ChevronRight, Heart, Sparkles } from 'lucide-react';
import { getCategoryGroup, getEffectiveSizeChart, getFitRecommendationPresentation, recommendFromSizeChart } from '@/lib/fitRecommendation';
import { parseTryOnProductId, resolveTryOnProduct, getTryOnProductState, getTryOnPriceLabel } from '@/lib/tryOnFoundation';
import TryOnDemo from '@/components/tryon/TryOnDemo';
import LocalPhotoPreparation from '@/components/tryon/LocalPhotoPreparation';

export default function TryOn() {
  const navigate=useNavigate();
  const {search}=useLocation();
  const [retry,setRetry]=useState(0);
  const [state,setState]=useState({loading:true});
  const [index,setIndex]=useState(0);
  const [showDemo,setShowDemo]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{
    let active=true;
    const {id,invalid}=parseTryOnProductId(search);
    setState({loading:true});setIndex(0);setShowDemo(false);setMessage('');
    if(invalid){setState({loading:false,error:'This product link is invalid.'});return;}
    const load=async()=>{
      try{
        const user=await base44.auth.me();
        if(!user?.id)throw Error('Sign in to continue.');
        const [catalog,requested,profiles,charts,wishes]=await Promise.all([
          base44.entities.Product.list('-created_date',50),
          id?base44.entities.Product.filter({id},'-created_date',1):Promise.resolve([]),
          base44.entities.UserProfile.filter({user_id:user.id}),
          base44.entities.BrandSizeChart.filter({active:true}),
          base44.entities.WishlistItem.filter({user_id:user.id})
        ]);
        if(!active)return;
        const exact=resolveTryOnProduct(requested,id);
        if(id&&!exact){setState({loading:false,error:'This product is no longer available in the catalog.'});return;}
        const products=catalog.filter(p=>p?.id&&p.active!==false&&p.discontinued!==true);
        const unique=[...(exact?[exact]:[]),...products.filter(p=>p.id!==exact?.id)];
        const profile=profiles[0]||null;
        // Keep only fit metadata; do not resolve, download or render body photographs.
        const fit=profile?{gender:profile.gender,birthday:profile.birthday,measurements:profile.measurements,measurement_values_cm:profile.measurement_values_cm,suggested_sizes:profile.suggested_sizes,measurement_confidence:profile.measurement_confidence,measurement_confidence_by_field:profile.measurement_confidence_by_field,measurement_validation_status:profile.measurement_validation_status}:null;
        setState({loading:false,userId:user.id,products:unique,fit,charts,wishlist:wishes});
      }catch{if(active)setState({loading:false,error:'Could not load the try-on catalog. Please try again.',retryable:true});}
    };
    load();return()=>{active=false;};
  },[search,retry]);
  const product=state.products?.[index];
  const saved=state.wishlist?.some(w=>w.product_id===product?.id);
  const status=getTryOnProductState(product);
  let size='',width='',presentation=null;
  if(product&&state.fit){
    const profile=state.fit;
    const chart=getEffectiveSizeChart(product,profile,state.charts||[]);
    const match=recommendFromSizeChart(chart.entries,profile.measurement_values_cm||{},{
      shoeSize:profile.measurements?.shoe_size,shoeWidth:profile.measurements?.shoe_width,braSize:profile.measurements?.bra_size,
      gender:profile.gender,category:product.category,categoryGroup:getCategoryGroup(product.category),
      measurementConfidence:profile.measurement_confidence,measurementConfidenceByField:profile.measurement_confidence_by_field,
      validationStatus:profile.measurement_validation_status||'estimated',
      sizeAdjustmentSteps:product.footwear_fit?.size_adjustment_steps??chart.chart?.size_adjustment_steps??0
    });
    if(match?.size&&!match.blocked&&(!product.sizes?.length||product.sizes.includes(match.size))){
      size=match.size;width=match.width||'';presentation=getFitRecommendationPresentation(chart.source,match.matchType);
    }
  }
  const toggleWishlist=async()=>{
    if(!product||!state.userId||busy)return;
    setBusy(true);setMessage('');
    try{
      const user=await base44.auth.me();
      if(user?.id!==state.userId)throw Error('Account changed.');
      let wishes=state.wishlist||[];
      if(saved){
        for(const w of wishes.filter(w=>w.product_id===product.id))await base44.entities.WishlistItem.delete(w.id);
        wishes=wishes.filter(w=>w.product_id!==product.id);
      }else{
        const row=await base44.entities.WishlistItem.create({user_id:user.id,product_id:product.id,product_name:product.name,product_image:product.images?.[0]||null,product_price:product.in_stock===true?product.price:null,vendor_id:product.vendor_id,is_public:false});
        wishes=[...wishes,row];
      }
      setState(prev=>prev.userId===user.id?{...prev,wishlist:wishes}:prev);
      setMessage(saved?'Removed from wishlist.':'Saved to wishlist.');
    }catch{setMessage('Could not update wishlist. Please try again.');}
    finally{setBusy(false);}
  };
  const browse=delta=>{setIndex(i=>(i+delta+state.products.length)%state.products.length);setMessage('');setShowDemo(false);};
  return <main className="min-h-screen bg-[#1a1a1a] text-white px-4 pt-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">
    <header className="flex items-center justify-between mb-6">
      <button type="button" onClick={()=>navigate(-1)} aria-label="Go back" className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center"><ArrowLeft className="w-5 h-5"/></button>
      <h1 className="flex items-center gap-2 text-lg"><Sparkles className="w-5 h-5 text-[#c9a962]"/>Virtual Try-On</h1>
      <button type="button" onClick={()=>navigate(createPageUrl('Shop'))} className="text-sm text-[#c9a962] py-3">Shop</button>
    </header>
    <p className="text-sm text-white/70 mb-4">Generated try-on previews are temporarily paused. Visual previews do not guarantee garment fit.</p>
    {state.loading?<p role="status" className="py-8 text-center">Loading catalog…</p>:state.error?<section className="rounded-xl bg-white/5 p-4"><p role="alert">{state.error}</p>{state.retryable&&<button type="button" onClick={()=>setRetry(n=>n+1)} className="mt-3 text-[#c9a962]">Retry</button>}<button type="button" onClick={()=>navigate(createPageUrl('Shop'))} className="block mt-3 text-[#c9a962]">Back to Shop</button></section>:product?<section className="rounded-2xl border border-white/15 bg-white/5 p-4 space-y-4">
      <div className="flex justify-between items-start gap-3"><div className="min-w-0"><p className="text-sm text-white/60">{product.brand}</p><h2 className="text-xl break-words">{product.name}</h2><p className="text-[#c9a962] mt-1">{getTryOnPriceLabel(product)}</p>{product.in_stock!==true&&<p className="text-xs text-white/60">Availability not verified</p>}</div><button type="button" disabled={busy} onClick={toggleWishlist} aria-label={saved?'Remove from wishlist':'Add to wishlist'} className="rounded-full bg-white/10 p-3 disabled:opacity-50"><Heart className={'w-5 h-5 '+(saved?'fill-[#c9a962] text-[#c9a962]':'')}/></button></div>
      <div className="rounded-xl border border-white/10 p-4 text-center"><Sparkles className="w-7 h-7 mx-auto mb-2 text-[#c9a962]"/><p className="font-medium">Virtual try-on unavailable for this item</p><p className="mt-1 text-sm text-white/70">{status==='asset_review_required'?'The garment asset still requires review and renderer support.':'No approved garment preview asset is available.'}</p></div>
      {size&&presentation&&<div className="text-sm"><p>{presentation.label}: {size}{width?' · '+width:''}</p><p className="text-xs text-white/60">{presentation.detail}</p></div>}
      <button type="button" onClick={()=>navigate(createPageUrl('ProductDetail?id='+product.id))} className="w-full rounded-xl py-3 bg-[#c9a962] text-[#1a1a1a] font-medium">View product details</button>
      {message&&<p role="status" className="text-sm">{message}</p>}
      {state.products.length>1&&<div className="flex items-center justify-between"><button type="button" disabled={busy} onClick={()=>browse(-1)} aria-label="Previous product" className="p-3 rounded-full bg-white/10"><ChevronLeft/></button><span className="text-sm text-white/60">{index+1} of {state.products.length}</span><button type="button" disabled={busy} onClick={()=>browse(1)} aria-label="Next product" className="p-3 rounded-full bg-white/10"><ChevronRight/></button></div>}
    </section>:<p role="status" className="py-4">No catalog products are available.</p>}
    {!state.loading&&!state.error&&state.userId&&<LocalPhotoPreparation key={state.userId+':'+(product?.id||'none')}/>}
    {!state.loading&&<div className="mt-5">{showDemo?<TryOnDemo/>:<button type="button" onClick={()=>setShowDemo(true)} className="w-full rounded-xl border border-white/20 py-3 text-sm">Open sample mannequin demonstration</button>}</div>}
  </main>;
}
