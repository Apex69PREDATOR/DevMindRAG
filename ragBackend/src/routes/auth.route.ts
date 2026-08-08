import { Router } from "express";
import passport from "../config/passport";
import { githubCallback,getMe,logout } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
const router = Router();

router.get("/github", passport.authenticate("github",{session: false}));

router.get("/github/callback", passport.authenticate("github",{session: false}), githubCallback);

router.get("/me", authMiddleware, getMe);
router.get("/logout", authMiddleware, logout);

export default router; 