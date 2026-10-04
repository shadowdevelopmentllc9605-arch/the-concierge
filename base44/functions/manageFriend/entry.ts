import { createClientFromRequest } from "npm:@base44/sdk";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const action = body?.action;

    if (action === "send") {
      const email = String(body?.email || "").trim().toLowerCase();
      if (!email || email === String(user.email || "").toLowerCase()) {
        return Response.json({ error: "Enter another Concierge user's email." }, { status: 400 });
      }
      // Uniform response: never reveal whether an email is registered (prevents enumeration).
      const users = await base44.asServiceRole.entities.User.filter({ email });
      const friendUser = users[0];
      if (friendUser) {
        const existingOut = await base44.asServiceRole.entities.Friend.filter({ user_id: user.id, friend_user_id: friendUser.id });
        const existingIn = await base44.asServiceRole.entities.Friend.filter({ user_id: friendUser.id, friend_user_id: user.id });
        if (!existingOut[0] && !existingIn[0]) {
          const requesterProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.id });
          // Target's name and picture are withheld until they accept the request.
          await base44.asServiceRole.entities.Friend.create({
            user_id: user.id,
            friend_user_id: friendUser.id,
            friend_name: "",
            friend_picture: "",
            requester_name: user.full_name || user.email,
            requester_picture: requesterProfiles[0]?.profile_picture || "",
            status: "pending",
          });
        }
      }
      return Response.json({ success: true });
    }

    if (action === "accept") {
      const records = await base44.asServiceRole.entities.Friend.filter({ id: body.friendId, friend_user_id: user.id });
      if (!records[0]) return Response.json({ error: "Friend request not found." }, { status: 404 });
      const accepterProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.id });
      await base44.asServiceRole.entities.Friend.update(records[0].id, {
        status: "accepted",
        friend_name: user.full_name || user.email,
        friend_picture: accepterProfiles[0]?.profile_picture || "",
      });
      return Response.json({ success: true });
    }

    if (action === "remove") {
      const records = await base44.asServiceRole.entities.Friend.filter({ id: body.friendId });
      const record = records[0];
      if (!record || (record.user_id !== user.id && record.friend_user_id !== user.id)) {
        return Response.json({ error: "Friend connection not found." }, { status: 404 });
      }
      await base44.asServiceRole.entities.Friend.delete(record.id);
      return Response.json({ success: true });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}