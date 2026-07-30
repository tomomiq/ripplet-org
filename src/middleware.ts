import { defineMiddleware } from 'astro:middleware';

async function hash(password: string) {
  const data = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (!pathname.startsWith('/travel')) return next();
  if (pathname === '/travel/login') return next();
  if (pathname === '/api/login') return next();
  if (pathname === '/api/logout') return next();

  const password = import.meta.env.SITE_PRIVATE_PASSWORD;
  const cookie = context.cookies.get('private-auth')?.value;

  if (!password || cookie !== await hash(password)) {
    return context.redirect('/travel/login');
  }

  return next();
});
