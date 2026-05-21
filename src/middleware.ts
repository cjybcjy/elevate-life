import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

const { auth } = NextAuth(authConfig);

export default auth((req: any) => {
  const isAuth = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === '/login';

  if (!isAuth && !isLoginPage) {
    return Response.redirect(new URL('/login', req.url));
  }
  if (isAuth && isLoginPage) {
    return Response.redirect(new URL('/', req.url));
  }
});

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
