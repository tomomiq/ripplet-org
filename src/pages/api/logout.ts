import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = ({ cookies, redirect }) => {
  cookies.delete('private-auth', { path: '/' });
  return redirect('/travel/login');
};
