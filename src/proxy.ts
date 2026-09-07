import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

const { auth } = NextAuth(authConfig);

export const proxy = auth(req => {
  const isAuth = Boolean(req.auth?.user?.id);
  const { pathname } = req.nextUrl;
  const authRoutes = ['/login', '/register'];
  const isAuthRoute = authRoutes.includes(pathname);
  const isApiRoute = pathname.startsWith('/api/');
  const isCronRoute = pathname.startsWith('/api/cron/');
  const publicRoutes = ['/privacy', '/support', '/account-deletion', '/terms'];
  const isPublicRoute = publicRoutes.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isPublicReleaseAsset =
    pathname === '/manifest.webmanifest' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/offline.html' ||
    pathname.startsWith('/.well-known/');

  if (isPublicReleaseAsset || isPublicRoute || isCronRoute) {
    return;
  }

  if (!isAuth && !isAuthRoute) {
    if (isApiRoute) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return Response.redirect(new URL('/login', req.url));
  }
  if (isAuth && isAuthRoute) {
    return Response.redirect(new URL('/', req.url));
  }
});

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|privacy|support|account-deletion|terms|manifest\\.webmanifest|manifest\\.json|sw\\.js|offline\\.html|\\.well-known|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$|.*\\.svg$|.*\\.ico$).*)',
  ],
};
