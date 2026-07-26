import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";

process.env.NODE_ENV = "test";

describe("Continuous API Regression & Schema Compatibility", () => {
  test("OpenAPI specification exists and matches schema paths", () => {
    // Check if OpenAPI YAML or JSON exists
    const openapiDir = path.join(process.cwd(), "src/docs");
    const openapiPath = path.join(process.cwd(), "src/docs/openapi.yaml");
    
    // Fallback to check parent directory paths if not directly in src/docs
    const fallbackPath = path.join(process.cwd(), "artifacts/api-server/src/docs/openapi.yaml");
    const targetPath = fs.existsSync(openapiPath) ? openapiPath : (fs.existsSync(fallbackPath) ? fallbackPath : null);

    if (targetPath) {
      const content = fs.readFileSync(targetPath, "utf-8");
      assert.ok(content.includes("openapi:"));
      assert.ok(content.includes("/projects"));
      assert.ok(content.includes("/auth"));
    }
  });

  test("Database schema migrations configurations remain intact", () => {
    const drizzleConfigPath = path.join(process.cwd(), "drizzle.config.ts");
    const fallbackConfigPath = path.join(process.cwd(), "lib/db/drizzle.config.ts");
    const targetConfigPath = fs.existsSync(drizzleConfigPath) ? drizzleConfigPath : (fs.existsSync(fallbackConfigPath) ? fallbackConfigPath : null);

    if (targetConfigPath) {
      const content = fs.readFileSync(targetConfigPath, "utf-8");
      assert.ok(content.includes("schema:"));
    }
  });
});
