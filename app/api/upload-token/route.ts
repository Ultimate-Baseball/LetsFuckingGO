import { NextRequest, NextResponse } from 'next/server';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';

export const runtime = 'nodejs';

const AUTH_COOKIE = 'ubt_auth_role';

function isAdmin(req: NextRequest): boolean {
  const role = req.cookies.get(AUTH_COOKIE)?.value;
  if (role === 'admin') return true;
  return !!req.cookies.get('ubt_admin_auth')?.value;
}

/**
 * POST /api/upload-token
 * Issues a short-lived Vercel Blob client upload token so the browser
 * can upload a file directly to Blob storage without routing it through
 * a Next.js function body (which would hit Vercel's 4.5 MB body limit).
 *
 * Flow:
 *  1. AdminPageClient POSTs { filename } here (tiny JSON, no file bytes).
 *  2. We return { clientToken, pathname }.
 *  3. Browser calls put(pathname, file, { access:'public', token: clientToken, abortSignal })
 *     -> file goes DIRECTLY to Vercel Blob CDN, never through a function body.
 *  4. Browser POSTs { blobUrl, filename } to /api/upload-data to process it.
 */
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN is not set on the server.' }, { status: 500 });
  }

  try {
    const { filename } = await req.json();
    const safe     = (filename ?? 'upload.xlsx').replace(/[^a-zA-Z0-9._-]/g, '_');
    const pathname = `ubt/uploads/${Date.now()}-${safe}`;
    const clientToken = await generateClientTokenFromReadWriteToken({
      token,
      pathname,
      maximumSizeInBytes: 10 * 1024 * 1024,  // 10 MB ceiling — well above typical spreadsheet size
    });
    return NextResponse.json({ clientToken, pathname });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed to generate upload token' }, { status: 500 });
  }
}
