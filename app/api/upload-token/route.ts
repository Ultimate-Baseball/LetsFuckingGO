import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

const AUTH_COOKIE = 'ubt_auth_role';

function isAdmin(req: NextRequest): boolean {
  const role = req.cookies.get(AUTH_COOKIE)?.value;
  if (role === 'admin') return true;
  return !!req.cookies.get('ubt_admin_auth')?.value;
}

/**
 * POST /api/upload-token
 * Handles the two-step Vercel Blob client-upload protocol used by AdminPageClient:
 *  1. Browser sends { type: 'blob.generate-client-token', payload: { pathname } }
 *     -> we validate admin auth and return a signed client token.
 *  2. After the file is stored, Vercel Blob may POST { type: 'blob.upload-completed' }
 *     -> no-op; the browser calls /api/upload-data with the blob URL directly.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  // Only require admin auth on the token-generation step.
  // The upload-completed callback comes from Vercel's infrastructure, not the browser.
  if (body.type === 'blob.generate-client-token' && !isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, _clientPayload, _multipart) => ({
        allowedContentTypes: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'application/octet-stream',
        ],
        addRandomSuffix: false,
        maximumSizeInBytes: 20 * 1024 * 1024, // 20 MB ceiling
      }),
      // onUploadCompleted intentionally omitted -- the browser calls
      // /api/upload-data with the blob URL as soon as upload() resolves.
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
