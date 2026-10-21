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

  if (!expected || submitted !== expected) {
    return redirect('/travel/login?error=1');
  }

  cookies.set('private-auth', hash(expected), {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 90, // 90 days
  });

  const next = form.get('next')?.toString() ?? '';
  const destination = next.startsWith('/') && !next.startsWith('//') ? next : '/travel';
  return redirect(destination);
};
