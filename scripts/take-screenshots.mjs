/**
 * スクリーンショット取得スクリプト
 *
 * 使用方法:
 *   npm run screenshot
 *
 * Vite dev サーバーを起動し、レビューページの主な面を screenshots/ に保存する。
 * システムの Google Chrome を使う。
 *
 * 見本データはいま src/model/example.ts に直書きしている。
 * ブラウザ保存ができたあとは、Sparkling Journey と同じく
 * addInitScript で localStorage へシードを注入する。
 */

import { chromium } from "@playwright/test";
import { spawn } from "child_process";
import { mkdir } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const screenshotsDir = join(rootDir, "screenshots");
const port = 43124;
const baseUrl = `http://127.0.0.1:${port}`;

function waitForServer(url, timeout = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      fetch(url)
        .then((res) => {
          if (res.ok) resolve();
          else retry();
        })
        .catch(retry);
    };
    const retry = () => {
      if (Date.now() - start >= timeout) {
        reject(new Error(`サーバーが ${timeout}ms 以内に起動しませんでした: ${url}`));
      } else {
        setTimeout(check, 500);
      }
    };
    check();
  });
}

async function shoot(page, name, selector) {
  const target = page.locator(selector);
  await target.scrollIntoViewIfNeeded();
  const dest = join(screenshotsDir, `${name}.png`);
  await target.screenshot({ path: dest });
  console.log(`  保存完了: ${dest}`);
}

async function main() {
  await mkdir(screenshotsDir, { recursive: true });

  const server = spawn(
    "npx",
    ["vite", "--port", String(port), "--host", "127.0.0.1"],
    { stdio: ["ignore", "pipe", "pipe"], cwd: rootDir, detached: true },
  );
  server.stdout.on("data", (data) => process.stdout.write(data));
  server.stderr.on("data", (data) => process.stderr.write(data));

  try {
    console.log("Vite dev サーバーの起動を待機中...");
    await waitForServer(`${baseUrl}/`);
    console.log("サーバー起動を確認。スクリーンショット取得を開始します。");

    const executablePath =
      process.env.CHROME_PATH ?? "/usr/bin/google-chrome-stable";
    const browser = await chromium.launch({
      executablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto(baseUrl);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);

    const sections = [
      { name: "premise", selector: "#premise" },
      { name: "questions", selector: "#questions" },
      { name: "map", selector: "#map" },
      { name: "types", selector: "#types" },
    ];
    for (const section of sections) {
      console.log(`  撮影中: ${section.name}`);
      await shoot(page, section.name, section.selector);
    }

    const screen = page.locator("#screen");
    console.log("  撮影中: episode");
    await shoot(page, "episode", "#screen");

    console.log("  撮影中: episode-roster");
    await screen.getByRole("button", { name: "第2話", exact: true }).click();
    await shoot(page, "episode-roster", "#screen");

    console.log("  撮影中: film");
    await screen.getByRole("button", { name: "Take On Me", exact: true }).click();
    await shoot(page, "film", "#screen");

    await browser.close();
    console.log("\nすべてのスクリーンショットを保存しました:", screenshotsDir);
  } finally {
    if (server.pid) {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        server.kill("SIGTERM");
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
