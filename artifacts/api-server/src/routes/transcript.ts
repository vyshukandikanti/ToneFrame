import { Router } from "express";
import {
  getTranscript,
  getTranscriptSegments,
  getTranscriptWords,
  reprocessTranscript,
} from "../controllers/transcript";

// mergeParams: true allows accessing :projectId param from parent router
const router = Router({ mergeParams: true });

router.get("/", getTranscript);
router.get("/segments", getTranscriptSegments);
router.get("/words", getTranscriptWords);
router.post("/reprocess", reprocessTranscript);

export default router;
