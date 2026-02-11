import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username as string;
        const password = credentials?.password as string;

        if (!username || !password) return null;

        const adminUsername = process.env.ADMIN_USERNAME;
        if (!adminUsername || username !== adminUsername) return null;

        // Support both bcrypt hash and plain text password
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (adminPasswordHash) {
          // Bcrypt hash comparison
          const { compare } = await import("bcryptjs");
          const isValid = await compare(password, adminPasswordHash);
          if (!isValid) return null;
        } else if (adminPassword) {
          // Plain text comparison
          if (password !== adminPassword) return null;
        } else {
          return null;
        }

        return {
          id: "1",
          name: adminUsername,
          email: `${adminUsername}@local`,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      if (nextUrl.pathname.startsWith("/admin")) {
        return !!auth?.user;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
