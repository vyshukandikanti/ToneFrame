import { exec } from "child_process";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

// Initialize S3 client from environment
const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "minioadmin",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "minioadminpassword",
  },
  endpoint: process.env.AWS_ENDPOINT_URL_S3 || undefined,
  forcePathStyle: !!process.env.AWS_ENDPOINT_URL_S3,
});

const bucketName = process.env.S3_BUCKET || "dubverse-bucket";
const backupDir = "./backups";

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

export async function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const sqlFilename = `backup-${timestamp}.sql`;
  const sqlPath = path.join(backupDir, sqlFilename);

  const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:password123@localhost:5432/dubverse";

  console.log(`[Backup] Starting PostgreSQL backup database snapshot...`);

  // Run pg_dump (expects pg_dump to be installed in the runtime environment)
  return new Promise<void>((resolve, reject) => {
    exec(`pg_dump "${dbUrl}" -f "${sqlPath}"`, async (error, stdout, stderr) => {
      if (error) {
        console.error(`[Backup] pg_dump failed:`, stderr || error.message);
        return reject(error);
      }

      console.log(`[Backup] Database snapshot saved locally to ${sqlPath}`);

      try {
        // Read file content
        const fileContent = fs.readFileSync(sqlPath);

        // Upload to S3
        const s3Key = `backups/${sqlFilename}`;
        console.log(`[Backup] Uploading database snapshot to S3 bucket ${bucketName} under key ${s3Key}...`);

        await s3.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
            Body: fileContent,
            ContentType: "application/sql",
          })
        );

        console.log(`[Backup] Backup snapshot successfully uploaded to S3!`);

        // Cleanup local file
        fs.unlinkSync(sqlPath);
        console.log(`[Backup] Local temporary file cleaned up.`);
        resolve();
      } catch (uploadErr) {
        console.error(`[Backup] S3 upload failed:`, uploadErr);
        reject(uploadErr);
      }
    });
  });
}

// Support executing directly if run from CLI
if (import.meta.url.endsWith(process.argv[1])) {
  runBackup()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
