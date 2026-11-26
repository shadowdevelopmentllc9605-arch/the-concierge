// Decide whether a session notification requires blocking the current UI.
// This is a UI lifecycle decision only; server authentication is still checked.
export function authEventAction(event,sessionUserId,verifiedUserId){
 if(event==='SIGNED_OUT')return 'clear';
 if(!['SIGNED_IN','USER_UPDATED'].includes(event))return 'ignore';
 if(typeof sessionUserId!=='string'||!sessionUserId)return 'clear';
 return sessionUserId===verifiedUserId?'background':'blocking';
}
export function createAuthEpoch(){
 let version=0;
 return {advance:()=>++version,isCurrent:value=>value===version};
}
