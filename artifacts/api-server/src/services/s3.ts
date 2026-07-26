import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";

const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "dubverse-assets";
const S3_REGION = process.env.S3_REGION || "auto";

// Allowed formats
export const ALLOWED_EXTENSIONS = [".mp4", ".mov", ".mkv", ".avi"];
export const ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-matroska",
  "video/x-msvideo",
];
export const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB

let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: S3_ENDPOINT,
      region: S3_REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID || "dummy-key",
        secretAccessKey: S3_SECRET_ACCESS_KEY || "dummy-secret",
      },
      // For local testing (like Minio/Localstack) or Cloudflare R2
      forcePathStyle: true,
    });
  }
  return s3Client;
}

export function validateFileConstraints(fileName: string, fileSize: number, contentType: string): { valid: boolean; error?: string } {
  // 1. Size check
  if (fileSize > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds the limit of 5GB (provided: ${(fileSize / (1024 * 1024 * 1024)).toFixed(2)}GB)` };
  }

  // 2. Extension check
  const ext = path.extname(fileName).toLowerCase();
  if (ext && !ALLOWED_EXTENSIONS.includes(ext) && ext !== ".webm" && ext !== ".3gp" && ext !== ".flv") {
    return { valid: false, error: `Unsupported file extension: ${ext}. Supported: ${ALLOWED_EXTENSIONS.join(", ")}, .webm` };
  }

  return { valid: true };
}

export async function generatePresignedUploadUrl(
  projectId: string,
  fileName: string,
  contentType: string
): Promise<{ uploadUrl: string; s3Key: string }> {
  const client = getS3Client();
  const ext = path.extname(fileName);
  const fileId = crypto.randomUUID();
  const s3Key = `projects/${projectId}/videos/${fileId}${ext}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
    ContentType: contentType,
  });

  // URL valid for 30 minutes
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 1800 });

  return { uploadUrl, s3Key };
}

export const s3Manager = {
  async generatePresignedDownloadUrl(s3Key: string): Promise<string> {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
    });

    // URL valid for 1 hour
    return await getSignedUrl(client, command, { expiresIn: 3600 });
  },

  async uploadTextAsset(
    s3Key: string,
    content: string,
    contentType: string
  ): Promise<void> {
    const client = getS3Client();
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
      Body: content,
      ContentType: contentType,
    });
    await client.send(command);
  },

  async uploadAudioBuffer(
    s3Key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<void> {
    const client = getS3Client();
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
    });
    await client.send(command);
  }
};

export async function generatePresignedDownloadUrl(s3Key: string): Promise<string> {
  return s3Manager.generatePresignedDownloadUrl(s3Key);
}

export async function uploadTextAsset(s3Key: string, content: string, contentType: string): Promise<void> {
  return s3Manager.uploadTextAsset(s3Key, content, contentType);
}

export async function uploadAudioBuffer(s3Key: string, buffer: Buffer, contentType: string): Promise<void> {
  return s3Manager.uploadAudioBuffer(s3Key, buffer, contentType);
}
