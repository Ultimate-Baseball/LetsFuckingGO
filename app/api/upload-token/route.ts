/**
 * POST /api/upload-token
 * ADMIN ONLY — generates a short-lived Vercel Blob client token so the
 * browser can upload the Excel file directly to Blob storage, bypassing
 * Vercel's 4.5 MB serverless function request-body limit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';

export const runtime     = 'nodejs';
export const maxDuration = 60; // Vercel Pro — ensures token generation never times out

const AUTH_COOKIE = 'ubt_auth_role';

function isAdmin(req: NextRequest): boolean {
  const role = req.cookies.get(AUTH_COOKIE)?.value;
  if (role === 'admin') return true;
  return !!req.cookies.get('ubt_admin_auth')?.value;
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'BLOB_READ_WRITE_TOKEN is not set. Connect the Blob store in Vercel Dashboard → Storage.' },
      { status: 500 }
    );
  }

  try {
    const { filename } = await req.json();
    const safe     = (filename ?? 'upload.xlsx').replace(/[^a-zA-Z0-9._-]/g, '_');
    const pathname = `ubt/uploads/${Date.now()}-${safe}`;

    const clientToken = await generateClientTokenFromReadWriteToken({
      token,
      pathname,
    });

    return NextResponse.json({ clientToken, pathname });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed to generate upload token' }, { status: 500 });
  }
}
