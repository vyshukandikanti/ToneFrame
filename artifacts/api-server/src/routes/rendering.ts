import { Router } from "express";
import {
  listProjectRenders,
  triggerRender,
  reprocessRender,
  getRenderedAssets,
  listProjectExports,
  triggerExport,
  getExportAssets,
} from "../controllers/rendering";

const router = Router({ mergeParams: true });

// Renders
router.get("/renders", listProjectRenders);
router.post("/renders", triggerRender);
router.post("/renders/reprocess", reprocessRender);
router.get("/renders/assets", getRenderedAssets);

// Exports
router.get("/exports", listProjectExports);
router.post("/exports", triggerExport);
router.get("/exports/assets", getExportAssets);

export default router;
