import "dotenv/config";
import { spawnSync } from "node:child_process";

const test = process.env.TEST_DATABASE_URL;
const live = process.env.DATABASE_URL;

if (!test) {
  console.error("TEST_DATABASE_URL is not set in .env");
  process.exit(1);
}
if (test === live) {
  console.error("TEST_DATABASE_URL must be different from DATABASE_URL. Refusing to continue.");
  process.exit(1);
}

// ሚስጥር (password) ሳይታተም የትኛው ዳታቤዝ እንደሆነ ያሳያል
const url = new URL(test);
console.log(`Applying migrations to host "${url.hostname}", database "${url.pathname.slice(1)}"`);

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: test },
});
process.exit(result.status ?? 1);