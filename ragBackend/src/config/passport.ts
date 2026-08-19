import passport from "passport";
import  { Strategy as GitHubStrategy } from "passport-github2";
import prisma from "./prisma";
import dotenv from "dotenv";
dotenv.config();

passport.use(
    new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID as string,
        clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
        callbackURL: process.env.GITHUB_CALLBACK_URL as string,
        scope: ["user:email","repo"],
    },
    async (accessToken: string, refreshToken: string, profile: Record<any, any>, done: Function) => {
        try {
            const user = await prisma.user.upsert({
                where: { githubId: profile.id },
                update: {
                    email: profile.emails?.[0]?.value ?? "",
                    avatarUrl: profile.photos?.[0]?.value,
                    oAuth:true,
                },
                create: {
                    githubId: profile.id,
                    username: profile.displayName || profile.username || "DevMind User",
                    email: profile.emails?.[0]?.value ?? "",
                    avatarUrl: profile.photos?.[0]?.value,
                    provider: "github",
                    oAuth:true,
                },
            });
            return done(null, {accessToken, user});
        } catch (error) {
            return done(error);
        }
    }
));

export default passport;