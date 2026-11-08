/** Current deployment id; the app compares it with its own to pick up updates. */
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { build: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
