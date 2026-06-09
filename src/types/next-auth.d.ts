import 'next-auth';

declare module 'next-auth' {
  interface User {
    username: string;
    derivedKey?: string;
  }
  interface Session {
    user: {
      id: string;
      username: string;
      derivedKey: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    username: string;
    derivedKey: string;
  }
}
