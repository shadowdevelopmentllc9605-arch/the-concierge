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

    // Only images stored in this app's own storage may be analyzed —
    // arbitrary external URLs would let any user run the paid AI service on content they don't own.
    const isOwnStorage = (url: string): boolean => {
      if (url.startsWith('mp/private/')) return true;
      try {
        const parsed = new URL(url);
        if (parsed.origin !== 'https://base44.app') return false;
        return /^\/api\/apps\/[a-f0-9]+\/files\/mp\/public\//.test(parsed.pathname);
      } catch {
        return false;
      }
    };
    if (!isOwnStorage(fileUrl)) {
      return Response.json({ error: 'Only images uploaded through the app can be analyzed' }, { status: 403 });
    }

    // Private storage references need a short-lived signed URL before the AI can fetch them.
    let imageUrl = fileUrl;
    if (fileUrl.startsWith('mp/private/')) {
      try {
        const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: fileUrl });
        imageUrl = signed_url;
      } catch {
        return Response.json({ error: 'Image could not be resolved' }, { status: 403 });
      }
    }

    const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: "Analyze this clothing item. Identify the type of clothing, color, style category (business/casual/nightlife/trendy), and any notable features.",
      file_urls: [imageUrl],
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