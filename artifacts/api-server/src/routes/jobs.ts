import { Router } from "express";
import {
  listJobs,
  getJob,
  getProjectJobs,
  cancelJobHandler,
  retryJobHandler,
} from "../controllers/jobs";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// Require auth for all job endpoints
router.use(requireAuth);

router.get("/", listJobs);
router.get("/:jobId", getJob);
router.get("/project/:projectId", getProjectJobs); // GET /api/jobs/project/:projectId
router.post("/:jobId/cancel", cancelJobHandler);
router.post("/:jobId/retry", retryJobHandler);

export default router;
