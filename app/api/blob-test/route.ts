/**
 * GET /api/blob-test  (admin only)
 * Quick diagnostic — confirms Blob token is present and PUT/LIST work.
 */
import { NextRequest, NextResponse } from 'next/server';
import { put, list } from '@vercel/blob';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const role = req.cookies.get('ubt_auth_role')?.value;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({
      ok: false,
      error: 'BLOB_READ_WRITE_TOKEN is not set in environment variables.',
      fix: 'Go to Vercel → Storage → lets-fucking-go-blob → connect to this project, then redeploy.',
    });
  }

  try {
    // Test write
    const testPayload = JSON.stringify({ test: true, ts: new Date().toISOString() });
    const putResult = await put('ubt/_blob-test.json', testPayload, {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
    });

    // Test list
    const { blobs } = await list({ prefix: 'ubt/' });

    return NextResponse.json({
      ok: true,
      tokenPresent: true,
      putUrl: putResult.url,
      blobCount: blobs.length,
      blobs: blobs.map(b => b.pathname),
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      tokenPresent: true,
      error: err?.message ?? String(err),
    });
  }
}
