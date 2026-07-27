const { S3Client, PutBucketCorsCommand } = require("@aws-sdk/client-s3");
const s3 = new S3Client({
  endpoint: "https://minio-production-c792.up.railway.app",
  region: "us-east-1",
  credentials: {
    accessKeyId: "minioadmin",
    secretAccessKey: "minioadminpassword",
  },
  forcePathStyle: true,
});

s3.middlewareStack.removeByTag("flexibleChecksums");

async function run() {
  try {
    await s3.send(new PutBucketCorsCommand({
      Bucket: "dubverse-assets",
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ["*"],
            AllowedMethods: ["PUT", "GET", "POST", "HEAD"],
            AllowedOrigins: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3000,
          }
        ]
      }
    }));
    console.log("CORS SUCCESS!");
  } catch (err) {
    console.error("CORS ERROR:", err);
  }
}
run();
