import { Router } from "express";
import {
  ingestRepo,
  getRepoById,
  getAllRepos,
  deleteRepo,
  resyncRepo,
  checkStaleness,
} from "../controllers/repo.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// All repo routes are protected — user must be authenticated
router.post(   "/ingest",              authMiddleware, ingestRepo          );
router.get(    "/",                    authMiddleware, getAllRepos          );
router.get(    "/:repoId",             authMiddleware, getRepoById             );
router.delete( "/:repoId",             authMiddleware, deleteRepo          );
router.post(   "/:repoId/resync",      authMiddleware, resyncRepo          );
router.get(    "/:repoId/staleness",   authMiddleware, checkStaleness  );

export default router;