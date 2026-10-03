import { createClientFromRequest } from "npm:@base44/sdk";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { friendUserId } = await req.json();
    if (!friendUserId) return Response.json({ error: "friendUserId is required" }, { status: 400 });

    const a = await base44.asServiceRole.entities.Friend.filter({ user_id: user.id, friend_user_id: friendUserId, status: "accepted" });
    const b = await base44.asServiceRole.entities.Friend.filter({ user_id: friendUserId, friend_user_id: user.id, status: "accepted" });
    if (!a[0] && !b[0]) return Response.json({ error: "Accepted friendship required" }, { status: 403 });

    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: friendUserId });
    if (profiles[0]?.wishlist_visibility !== "public") {
      return Response.json({ items: [], private: true });
    }

    const items = await base44.asServiceRole.entities.WishlistItem.filter({
      user_id: friendUserId,
      is_public: true,
    });
    return Response.json({ items, private: false });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
