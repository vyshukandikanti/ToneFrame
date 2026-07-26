import { Router } from "express";
import {
  listProjectVoices,
  generateVoices,
  updateVoiceProfile,
  getVoiceAssets,
} from "../controllers/voice";

const router = Router({ mergeParams: true });

router.get("/", listProjectVoices);
router.post("/generate", generateVoices);
router.patch("/:voiceProfileId", updateVoiceProfile);
router.get("/assets", getVoiceAssets);

export default router;
