import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const postMerge = read("scripts/post-merge.sh");
const artifact = read("artifacts/api-server/.replit-artifact/artifact.toml");
const packageJson = JSON.parse(read("package.json"));
const dbPackageJson = JSON.parse(read("lib/db/package.json"));

const checks = [
  [
    "post-merge uses the workspace database package",
    postMerge.includes("pnpm --filter @workspace/db run push"),
  ],
  [
    "post-merge does not force destructive schema changes",
    !postMerge.includes("push-force") && !postMerge.includes("--force"),
  ],
  [
    "database package exposes the non-forced push command",
    dbPackageJson.scripts?.push ===
      "drizzle-kit push --config ./drizzle.config.ts",
  ],
  [
    "production build does not mutate the database",
    !/\b(db:push|push-force|drizzle-kit\s+push)\b/.test(artifact),
  ],
  [
    "production startup does not mutate the database",
    !/\b(db:push|push-force|drizzle-kit\s+push)\b/.test(artifact),
  ],
  [
    "deployment validation is available from the root package",
    packageJson.scripts?.["validate:db-deployment"] ===
      "node ./scripts/validate-db-deployment.mjs",
  ],
];

const failures = checks
  .filter(([, passed]) => !passed)
  .map(([description]) => description);

if (failures.length > 0) {
  console.error("Database deployment validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Database deployment validation passed (${checks.length} checks).`);