import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

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
  const data = await s3.send(new ListBucketsCommand({}));
  console.log("BUCKETS:", JSON.stringify(data.Buckets, null, 2));
}
main();
