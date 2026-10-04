import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const fileUrl = body?.file_url;
    if (!fileUrl || typeof fileUrl !== 'string') {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: "Analyze this clothing item. Identify the type of clothing, color, style category (business/casual/nightlife/trendy), and any notable features.",
      file_urls: [fileUrl],
      response_json_schema: {
        type: "object",
        properties: {
          item_type: { type: "string" },
          color: { type: "string" },
          style_category: { type: "string" },
          description: { type: "string" }
        }
      }
    });

    return Response.json({
      item_type: analysis.item_type || '',
      color: analysis.color || '',
      style_category: analysis.style_category || '',
      description: analysis.description || ''
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}