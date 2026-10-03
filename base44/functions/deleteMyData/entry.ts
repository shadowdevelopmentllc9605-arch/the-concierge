import { createClientFromRequest } from "npm:@base44/sdk";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const entityQueries = [
      ["ClosetItem", { user_id: user.id }],
      ["WishlistItem", { user_id: user.id }],
      ["CartItem", { user_id: user.id }],
      ["Purchase", { user_id: user.id }],
      ["StoreCheckin", { user_id: user.id }],
      ["PaymentMethod", { user_id: user.id }],
      ["PushSubscription", { user_id: user.id }],
      ["AppNotification", { user_id: user.id }],
      ["ProductReview", { user_id: user.id }],
      ["AIFeedback", { user_id: user.id }],
      ["ShoppingExperience", { user_id: user.id }],
    ];

    for (const [entityName, query] of entityQueries) {
      try {
        const entity = (base44.asServiceRole.entities as any)[entityName];
        const rows = await entity.filter(query);
        for (const row of rows) await entity.delete(row.id);
      } catch (error) {
        console.warn(`Could not clean ${entityName}`, error);
      }
    }

    const outgoing = await base44.asServiceRole.entities.Friend.filter({ user_id: user.id });
    const incoming = await base44.asServiceRole.entities.Friend.filter({ friend_user_id: user.id });
    const friendIds = new Set([...outgoing, ...incoming].map((row: any) => row.id));
    for (const id of friendIds) await base44.asServiceRole.entities.Friend.delete(id);

    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.id });
    for (const profile of profiles) await base44.asServiceRole.entities.UserProfile.delete(profile.id);

    await base44.asServiceRole.entities.User.delete(user.id);

    return Response.json({
      success: true,
      authAccountDeleted: true,
      uploadedFilesDeleted: false,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
