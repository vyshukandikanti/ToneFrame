async function main() {
  const url = "https://minio-production-c792.up.railway.app/dubverse-assets/projects/9b6e5752-3cb5-4033-943b-15e2acefeb57/voices/outputs/combined-1.wav";
  const res = await fetch(url);
  console.log("STATUS:", res.status);
  console.log("CONTENT-TYPE:", res.headers.get("content-type"));
  console.log("CONTENT-LENGTH:", res.headers.get("content-length"));
}
main();
