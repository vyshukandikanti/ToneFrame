import { Router } from "express";
import {
  listGlossaries,
  addGlossaryTerm,
  deleteGlossaryTerm,
} from "../controllers/translation";

const router = Router({ mergeParams: true });

router.get("/", listGlossaries);
router.post("/", addGlossaryTerm);
router.delete("/:glossaryId", deleteGlossaryTerm);

export default router;
