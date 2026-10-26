import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const port = process.env.PORT || "3000";

const child = spawn(process.execPath, [nextBin, "start", "-p", port], {
  stdio: "inherit",
  env: {
    ...process.env,
    LORAN_LOCAL_PREVIEW: "1",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error("Failed to start local production preview:", error);
  process.exit(1);
});
