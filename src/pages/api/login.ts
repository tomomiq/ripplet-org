import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';

function hash(password: string) {
  return createHash('sha256').update(password).digest('hex');
}

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const submitted = form.get('password')?.toString() ?? '';
  const expected = process.env.SITE_PRIVATE_PASSWORD;

  console.log('[login debug] expected defined:', !!expected, '| expected length:', expected?.length ?? 0, '| submitted length:', submitted.length);

  if (!expected || submitted !== expected) {
    return redirect('/travel/login?error=1');
  }

  cookies.set('private-auth', hash(expected), {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 90, // 90 days
  });

  return redirect('/travel');
};
