import { Router } from "express";
import express from "express";
import {
  createProject,
  listProjects,
  getProject,
  renameProject,
  deleteProject,
  getUploadUrl,
  registerVideo,
  uploadVideoDirect,
} from "../controllers/projects";
import { getProjectJobs } from "../controllers/jobs";
import { requireAuth } from "../middlewares/auth";
import transcriptRouter from "./transcript";
import translationRouter from "./translation";
import glossaryRouter from "./glossary";
import emotionRouter from "./emotion";
import speakerRouter from "./speaker";
import voiceRouter from "./voice";
import lipsyncRouter from "./lipsync";
import renderingRouter from "./rendering";

const router = Router();

// Apply auth middleware to all project routes
router.use(requireAuth);

router.use("/:projectId/transcript", transcriptRouter);
router.use("/:projectId/translations", translationRouter);
router.use("/:projectId/glossaries", glossaryRouter);
router.use("/:projectId/emotions", emotionRouter);
router.use("/:projectId/speakers", speakerRouter);
router.use("/:projectId/voices", voiceRouter);
router.use("/:projectId/lipsync", lipsyncRouter);
router.use("/:projectId", renderingRouter);

router.get("/", listProjects);
router.post("/", createProject);
router.get("/:projectId", getProject);
router.get("/:projectId/jobs", getProjectJobs);
router.put("/:projectId", renameProject);
router.delete("/:projectId", deleteProject);
router.post("/:projectId/upload-url", getUploadUrl);
router.post("/:projectId/videos", registerVideo);
router.post(
  "/:projectId/videos/upload",
  express.raw({ type: "*/*", limit: "100mb" }),
  uploadVideoDirect
);

export default router;
