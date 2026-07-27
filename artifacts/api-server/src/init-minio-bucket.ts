import { S3Client, CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  endpoint: "https://minio-production-c792.up.railway.app",
  region: "us-east-1",
  credentials: {
    accessKeyId: "minioadmin",
    secretAccessKey: "minioadminpassword",
  },
  forcePathStyle: true,
});

const bucketName = "dubverse-assets";

async function main() {
  try {
    // Check if bucket exists
    try {
      await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
      console.log(`Bucket "${bucketName}" already exists.`);
    } catch (err: any) {
      if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
        console.log(`Bucket "${bucketName}" not found. Creating...`);
        await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
        console.log(`Bucket "${bucketName}" created successfully.`);
      } else {
        throw err;
      }
    }

    // Set public read policy for signed URLs fallback
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "PublicRead",
          Effect: "Allow",
          Principal: "*",
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${bucketName}/*`],
        },
      ],
    };

    await s3.send(new PutBucketPolicyCommand({
      Bucket: bucketName,
      Policy: JSON.stringify(policy),
    }));
    console.log("Public read policy ensured on bucket.");

    // Set CORS configuration
    const corsConfiguration = {
      CORSRules: [
        {
          AllowedHeaders: ["*"],
          AllowedMethods: ["PUT", "GET", "POST", "HEAD"],
          AllowedOrigins: ["*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3000,
        },
      ],
    };

    await s3.send(new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: corsConfiguration,
    }));
    console.log("CORS configuration ensured on bucket.");

  } catch (error) {
    console.error("Error initializing MinIO bucket:", error);
    process.exit(1);
  }
}

main();
