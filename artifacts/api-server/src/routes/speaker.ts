import { Router } from "express";
import {
  getProjectSpeakers,
  getSpeakerTimeline,
  updateSpeaker,
  reprocessSpeakerJob,
} from "../controllers/speaker";

const router = Router({ mergeParams: true });

router.get("/", getProjectSpeakers);
router.get("/timeline", getSpeakerTimeline);
router.patch("/:speakerId", updateSpeaker);
router.post("/reprocess", reprocessSpeakerJob);

export default router;
