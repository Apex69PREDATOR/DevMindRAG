import { Router } from "express";
import {
  askQuestion,
  getChatHistory,
  deleteChatHistory,
} from "../controllers/chat.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// All chat routes are protected
router.post(   "/",                      authMiddleware, askQuestion      );
router.get(    "/:repoId/history",       authMiddleware, getChatHistory   );
router.delete( "/:repoId/history",       authMiddleware, deleteChatHistory );

export default router;