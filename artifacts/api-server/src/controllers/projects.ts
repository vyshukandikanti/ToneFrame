import { Response, NextFunction } from "express";
import { db, projectsTable, uploadedVideosTable } from "@workspace/db";
import {
  CreateProjectBody,
  RenameProjectBody,
  GetUploadUrlBody,
  AddVideoToProjectBody,
} from "@workspace/api-zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { AuthenticatedRequest } from "../middlewares/auth";
import {
  validateFileConstraints,
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  getS3Client,
} from "../services/s3";
import { extractVideoMetadata } from "../services/metadata";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import path from "path";
import crypto from "crypto";

// 1. Create Project
export async function createProject(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const parseResult = CreateProjectBody.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: "Validation failed", details: parseResult.error.format() });
      return;
    }

    const { name } = parseResult.data;

    const [project] = await db
      .insert(projectsTable)
      .values({
        name,
        userId: req.user.id,
      })
      .returning();

    res.status(201).json({
      id: project.id,
      userId: project.userId,
      name: project.name,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

// 2. List Projects (with dashboard stats)
export async function listProjects(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Query projects with count of videos
    const projects = await db
      .select({
        id: projectsTable.id,
        name: projectsTable.name,
        createdAt: projectsTable.createdAt,
        updatedAt: projectsTable.updatedAt,
        videoCount: sql<number>`count(${uploadedVideosTable.id})::int`,
      })
      .from(projectsTable)
      .leftJoin(uploadedVideosTable, eq(projectsTable.id, uploadedVideosTable.projectId))
      .where(eq(projectsTable.userId, req.user.id))
      .groupBy(projectsTable.id)
      .orderBy(desc(projectsTable.updatedAt));

    const formattedProjects = projects.map((p) => ({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      videoCount: p.videoCount,
    }));

    res.status(200).json(formattedProjects);
  } catch (err) {
    next(err);
  }
}

// 3. Get Project Details
export async function getProject(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const projectId = req.params.projectId as string;

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user.id)))
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const videos = await db
      .select()
      .from(uploadedVideosTable)
      .where(eq(uploadedVideosTable.projectId, projectId))
      .orderBy(desc(uploadedVideosTable.createdAt));

    const formattedVideos = await Promise.all(
      videos.map(async (v) => {
        let downloadUrl = v.s3Key;
        if (v.s3Key && !v.s3Key.startsWith("http://") && !v.s3Key.startsWith("https://")) {
          try {
            downloadUrl = await generatePresignedDownloadUrl(v.s3Key);
          } catch (err) {
            console.warn("Could not generate presigned download URL:", err);
          }
        }
        return {
          id: v.id,
          projectId: v.projectId,
          fileName: v.fileName,
          s3Key: v.s3Key,
          downloadUrl,
          durationSeconds: v.durationSeconds,
          fileSize: v.fileSize,
          resolution: v.resolution || "unknown",
          mimeType: v.mimeType,
          width: v.width || undefined,
          height: v.height || undefined,
          fps: v.fps || undefined,
          codec: v.codec || undefined,
          bitrate: v.bitrate || undefined,
          createdAt: v.createdAt.toISOString(),
        };
      })
    );

    res.status(200).json({
      id: project.id,
      userId: project.userId,
      name: project.name,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      videos: formattedVideos,
    });
  } catch (err) {
    next(err);
  }
}

// 4. Rename Project
export async function renameProject(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const projectId = req.params.projectId as string;

    const parseResult = RenameProjectBody.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: "Validation failed", details: parseResult.error.format() });
      return;
    }

    const { name } = parseResult.data;

    // Verify ownership
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user.id)))
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const [updated] = await db
      .update(projectsTable)
      .set({
        name,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, projectId))
      .returning();

    res.status(200).json({
      id: updated.id,
      userId: updated.userId,
      name: updated.name,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

// 5. Delete Project
export async function deleteProject(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const projectId = req.params.projectId as string;

    // Verify ownership
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user.id)))
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // Cascade deletes other records automatically due to schema definitions
    await db.delete(projectsTable).where(eq(projectsTable.id, projectId));

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

// 6. Get Upload URL
export async function getUploadUrl(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const projectId = req.params.projectId as string;

    // Verify project ownership
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user.id)))
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // Validate body
    const parseResult = GetUploadUrlBody.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: "Validation failed", details: parseResult.error.format() });
      return;
    }

    const { fileName, fileSize, contentType } = parseResult.data;

    // File check constraints
    const validation = validateFileConstraints(fileName, fileSize, contentType);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    // Generate S3 presigned PUT URL
    const uploadUrlDetails = await generatePresignedUploadUrl(projectId, fileName, contentType);

    res.status(200).json(uploadUrlDetails);
  } catch (err) {
    next(err);
  }
}

// 7. Register Video & Auto Extract Metadata
export async function registerVideo(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const projectId = req.params.projectId as string;

    // Verify project ownership
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user.id)))
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // Validate body
    const parseResult = AddVideoToProjectBody.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: "Validation failed", details: parseResult.error.format() });
      return;
    }

    const { fileName, s3Key, durationSeconds, fileSize, mimeType } = parseResult.data;

    let metadata = {
      width: 0,
      height: 0,
      fps: "unknown",
      codec: "unknown",
      durationSeconds: durationSeconds,
      bitrate: 0,
      resolution: "unknown",
    };

    // Auto extract metadata from S3 using presigned GET url and ffprobe
    try {
      const downloadUrl = await generatePresignedDownloadUrl(s3Key);
      const extracted = await extractVideoMetadata(downloadUrl);
      metadata = {
        ...extracted,
        // Override duration if successfully extracted, otherwise keep request duration
        durationSeconds: extracted.durationSeconds || durationSeconds,
      };
    } catch (metaErr: any) {
      console.warn("Could not automatically extract video metadata via ffprobe:", metaErr.message);
    }

    // Save video info
    const [video] = await db
      .insert(uploadedVideosTable)
      .values({
        projectId,
        fileName,
        s3Key,
        durationSeconds: metadata.durationSeconds,
        fileSize,
        resolution: metadata.resolution || "unknown",
        mimeType,
        width: metadata.width,
        height: metadata.height,
        fps: metadata.fps,
        codec: metadata.codec,
        bitrate: metadata.bitrate,
      })
      .returning();

    // Update project's updatedAt timestamp
    await db
      .update(projectsTable)
      .set({ updatedAt: new Date() })
      .where(eq(projectsTable.id, projectId));

    res.status(201).json({
      id: video.id,
      projectId: video.projectId,
      fileName: video.fileName,
      s3Key: video.s3Key,
      durationSeconds: video.durationSeconds,
      fileSize: video.fileSize,
      resolution: video.resolution || "unknown",
      mimeType: video.mimeType,
      width: video.width || undefined,
      height: video.height || undefined,
      fps: video.fps || undefined,
      codec: video.codec || undefined,
      bitrate: video.bitrate || undefined,
      createdAt: video.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

// 8. Direct Video Upload (Bypasses browser CORS by proxying through backend)
export async function uploadVideoDirect(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const projectId = req.params.projectId as string;

    // Verify project ownership
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user.id)))
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const fileBuffer = req.body;
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
      res.status(400).json({ error: "No video file body received" });
      return;
    }

    const fileName = (req.headers["x-file-name"] as string) || "video.mp4";
    const contentType = (req.headers["content-type"] as string) || "video/mp4";

    // Validate size and extension constraints
    const validation = validateFileConstraints(fileName, fileBuffer.length, contentType);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    // Generate keys & upload to S3/MinIO
    const ext = path.extname(fileName) || ".mp4";
    const fileId = crypto.randomUUID();
    const s3Key = `projects/${projectId}/videos/${fileId}${ext}`;

    const s3Client = getS3Client();
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME || "dubverse-assets",
        Key: s3Key,
        Body: fileBuffer,
        ContentType: contentType,
      })
    );

    // Insert video into database
    const [video] = await db
      .insert(uploadedVideosTable)
      .values({
        projectId,
        fileName,
        s3Key,
        durationSeconds: 60, // default placeholder
        fileSize: fileBuffer.length,
        resolution: "unknown",
        mimeType: contentType,
      })
      .returning();

    // Update project's updatedAt timestamp
    await db
      .update(projectsTable)
      .set({ updatedAt: new Date() })
      .where(eq(projectsTable.id, projectId));

    // Resolve download URL
    let downloadUrl = s3Key;
    try {
      downloadUrl = await generatePresignedDownloadUrl(s3Key);
    } catch (err) {
      console.warn("Could not generate presigned download URL:", err);
    }

    res.status(201).json({
      id: video.id,
      projectId: video.projectId,
      fileName: video.fileName,
      s3Key: video.s3Key,
      downloadUrl,
      durationSeconds: video.durationSeconds,
      fileSize: video.fileSize,
      resolution: video.resolution || "unknown",
      mimeType: video.mimeType,
      createdAt: video.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
