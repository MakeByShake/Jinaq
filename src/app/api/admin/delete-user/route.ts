import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { uid, idToken } = await req.json();

    if (!uid || !idToken) {
      return NextResponse.json({ error: 'Missing uid or idToken' }, { status: 400 });
    }

    const adminAuth = getAdminAuth();

    // Verify the requester's token and check they are admin
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!decoded.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete the user from Firebase Auth
    await adminAuth.deleteUser(uid);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[delete-user API]', err);
    return NextResponse.json({ error: err.message ?? 'Failed to delete user' }, { status: 500 });
  }
}
