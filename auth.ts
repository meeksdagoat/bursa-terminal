import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  trustHost: true,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, trigger, session }) {
      if (trigger === "update" && session && typeof session.nickname === "string") {
        token.nickname = session.nickname;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.nickname = typeof token.nickname === "string" ? token.nickname : null;
      }
      return session;
    },
  },
});
