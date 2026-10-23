import { NextRequest, NextResponse } from 'next/server';
import { AdminNotConfiguredError, getAdminAuth, getAdminDb, hasAdminCredentials } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ErrorCode = 'bad_request' | 'unauthorized' | 'forbidden' | 'self_delete' | 'not_configured' | 'server_error';

function fail(status: number, code: ErrorCode, message: string) {
  return NextResponse.json({ error: message, code }, { status });
}

/**
 * Permanently deletes a user: their Firestore profile + all sub-collections, then the Auth account.
 * Caller must send `Authorization: Bearer <Firebase ID token>` and have `role: "admin"` in their profile.
 */
export async function POST(req: NextRequest) {
  if (!hasAdminCredentials()) {
    return fail(503, 'not_configured', 'Server is missing Firebase Admin credentials (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).');
  }

  let body: { uid?: unknown; idToken?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return fail(400, 'bad_request', 'Invalid JSON body');
  }

  const uid = typeof body.uid === 'string' ? body.uid.trim() : '';
  if (!uid || uid.length > 128 || uid.includes('/')) return fail(400, 'bad_request', 'Missing or invalid uid');

  const header = req.headers.get('authorization') ?? '';
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const idToken = bearer || (typeof body.idToken === 'string' ? body.idToken : '');
  if (!idToken) return fail(401, 'unauthorized', 'Missing ID token');

  try {
    const adminAuth = getAdminAuth();
    const db = getAdminDb();

    let callerUid: string;
    try {
      callerUid = (await adminAuth.verifyIdToken(idToken)).uid;
    } catch {
      return fail(401, 'unauthorized', 'Invalid or expired ID token');
    }

    const callerSnap = await db.collection('users').doc(callerUid).get();
    const caller = callerSnap.data();
    if (!callerSnap.exists || caller?.role !== 'admin' || caller?.blocked) {
      return fail(403, 'forbidden', 'Admin role required');
    }
    if (callerUid === uid) return fail(403, 'self_delete', 'Admins cannot delete their own account here');

    // Firestore: the profile document and everything nested under it.
    await db.recursiveDelete(db.collection('users').doc(uid));

    // Auth account (may already be gone).
    try {
      await adminAuth.deleteUser(uid);
    } catch (err) {
      if ((err as { code?: string })?.code !== 'auth/user-not-found') throw err;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AdminNotConfiguredError) return fail(503, 'not_configured', err.message);
    console.error('[delete-user API]', err);
    return fail(500, 'server_error', 'Failed to delete user');
  }
}
