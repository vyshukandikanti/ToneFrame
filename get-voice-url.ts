import { db, voiceAssetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  endpoint: "https://minio-production-c792.up.railway.app",
  region: "us-east-1",
  credentials: {
    accessKeyId: "minioadmin",
    secretAccessKey: "minioadminpassword",
  },
  forcePathStyle: true,
});

async function main() {
  const assets = await db.select().from(voiceAssetsTable).where(eq(voiceAssetsTable.projectId, "9b6e5752-3cb5-4033-943b-15e2acefeb57"));
  for (const asset of assets) {
    const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: "dubverse-assets", Key: asset.s3Key }), { expiresIn: 3600 });
    console.log(`ASSET ${asset.format}:`, url);
  }
}
main();
