import { Router } from "express";
import {
  getProjectLipSync,
  generateLipSync,
  getLipSyncAssets,
  reprocessLipSync,
} from "../controllers/lipsync";

const router = Router({ mergeParams: true });

router.get("/", getProjectLipSync);
router.post("/generate", generateLipSync);
router.get("/assets", getLipSyncAssets);
router.post("/reprocess", reprocessLipSync);

export default router;
