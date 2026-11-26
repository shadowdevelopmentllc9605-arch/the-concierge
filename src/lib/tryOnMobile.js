// One decode/encode job at a time across mounts of the local photo UI.
// Cancellation invalidates results but does not release the lock early.
export function createPhotoJobGate(){
 let owner=null;
 return Object.freeze({
  acquire(){
   if(owner)return null;
   const token={};owner=token;
   return ()=>{if(owner===token)owner=null;};
  },
  isBusy(){return owner!==null;}
 });
}
export const photoJobGate=createPhotoJobGate();
export function previewDimensions(width,height,maxSide=1200){
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||!Number.isSafeInteger(maxSide)||maxSide<1||maxSide>1200)return null;
 const scale=Math.min(1,maxSide/Math.max(width,height));
 return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
