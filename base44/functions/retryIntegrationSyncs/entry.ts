import { createClientFromRequest } from "npm:@base44/sdk";

const PRO_APP_ID = "69a25fa908ebd18cd4723d7c";

async function getToken(base44: any) {
  const rows = await base44.asServiceRole.entities.IntegrationConfig.filter({ key: "cross_app_sync", enabled: true });
  return rows[0]?.token || null;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const token = await getToken(base44);
    if (!token) return Response.json({ error: "Integration is not configured" }, { status: 409 });

    const jobs = await base44.asServiceRole.entities.IntegrationSyncJob.filter({
      owner_user_id: user.id,
      direction: "to_pro",
    });

    const pending = jobs
      .filter((job: any) => job.status !== "completed")
      .slice(0, 25);

    let completed = 0;
    const failures: any[] = [];

    for (const job of pending) {
      try {
        const response = await fetch(`https://base44.app/api/apps/${PRO_APP_ID}/functions/receiveCustomerEvent`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-concierge-sync-secret": token,
          },
          body: job.payload_json,
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result?.error || `Sync failed (${response.status})`);

        await base44.asServiceRole.entities.IntegrationSyncJob.update(job.id, {
          status: "completed",
          attempts: Number(job.attempts || 0) + 1,
          last_error: "",
          last_attempt_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });

        if (job.action === "onlinePurchase" && String(job.event_key || "").startsWith("onlinePurchase:")) {
          const orderId = String(job.event_key).split(":")[1];
          const allUserJobs = await base44.asServiceRole.entities.IntegrationSyncJob.filter({
            owner_user_id: user.id,
            direction: "to_pro",
          });
          const orderJobs = allUserJobs.filter((row: any) =>
            String(row.event_key || "").startsWith(`onlinePurchase:${orderId}:`)
          );
          const allComplete = orderJobs.every((row: any) =>
            row.id === job.id || row.status === "completed"
          );
          const orders = await base44.asServiceRole.entities.Order.filter({ id: orderId, user_id: user.id });
          if (orders[0]) {
            await base44.asServiceRole.entities.Order.update(orders[0].id, {
              pro_sync_status: allComplete ? "completed" : "partial",
              sync_error: allComplete ? "" : orders[0].sync_error || "",
            });
          }
        }

        completed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sync failed";
        await base44.asServiceRole.entities.IntegrationSyncJob.update(job.id, {
          status: "pending",
          attempts: Number(job.attempts || 0) + 1,
          last_error: message,
          last_attempt_at: new Date().toISOString(),
        });
        failures.push({ eventKey: job.event_key, error: message });
      }
    }

    return Response.json({ success: true, attempted: pending.length, completed, failures });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
