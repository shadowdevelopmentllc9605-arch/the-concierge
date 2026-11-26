import { base44 } from '@/api/base44Client';
import { makeStyleVote, OUTFIT_VOTE, PRODUCT_VOTE } from '@/lib/styleFeedback';
// Existing Supabase RLS also enforces ownership. Never query a different account.
export async function loadStyleVotes(userId) {
  return base44.entities.AIFeedback.filter({user_id:userId,actual_outcome:[OUTFIT_VOTE,PRODUCT_VOTE]},'-created_date',300);
}
export async function saveStyleVote(userId,target,value) {
  const current=await base44.auth.me();
  if(!userId||current?.id!==userId)throw Error('Account changed. Please reload.');
  return base44.entities.AIFeedback.create(makeStyleVote(userId,target,value));
}
