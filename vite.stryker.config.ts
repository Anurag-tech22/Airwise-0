import { defineConfig } from "vitest/config";

/** Test scope for mutation testing: the decision-engine tests only, so each mutant is checked in seconds. */
export default defineConfig({
  test: { include: ["shared/**/*.test.ts"], exclude: ["shared/contrast.test.ts"] },
});
