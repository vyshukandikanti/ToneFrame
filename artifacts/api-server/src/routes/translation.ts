import { Router } from "express";
import {
  listTranslations,
  getTranslationByLanguage,
  createTranslationJob,
  reprocessTranslationJob,
  deleteTranslation,
} from "../controllers/translation";

const router = Router({ mergeParams: true });

router.get("/", listTranslations);
router.post("/", createTranslationJob);
router.post("/retranslate", reprocessTranslationJob);
router.get("/:language", getTranslationByLanguage);
router.delete("/:language", deleteTranslation);

export default router;
