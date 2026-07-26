import { Router } from "express";
import {
  getProjectEmotions,
  getEmotionTimeline,
  reprocessEmotionJob,
} from "../controllers/emotion";

const router = Router({ mergeParams: true });

router.get("/", getProjectEmotions);
router.get("/timeline", getEmotionTimeline);
router.post("/reprocess", reprocessEmotionJob);

export default router;
