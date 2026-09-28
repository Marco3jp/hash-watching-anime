/**
 * スクリーンショット取得スクリプト
 *
 * 使用方法:
 *   npm run screenshot
 *
 * Vite dev サーバーを port 43124 で起動し、src/model/example.ts の見本を
 * Sparkling Journey と同じく addInitScript で localStorage へ注入してから、
 * 各ページを screenshots/ に保存する。システムの Google Chrome を使う。
 */

import { chromium } from "@playwright/test";
import { mkdir } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createServer } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const screenshotsDir = join(rootDir, "screenshots");
const port = 43124;
const baseUrl = `http://127.0.0.1:${port}`;

function byTitle(items, title) {
  const found = items.find((item) => item.title === title);
  if (!found) throw new Error(`見本に無い: ${title}`);
  return found;
}

async function main() {
  await mkdir(screenshotsDir, { recursive: true });

  const server = await createServer({
    root: rootDir,
    server: { port, host: "127.0.0.1", strictPort: true },
    logLevel: "warn",
  });

  try {
    await server.listen();
    const { buildExample } = await server.ssrLoadModule("/src/model/example.ts");
    const { storageKeys } = await server.ssrLoadModule("/src/model/storage.ts");
    const db = buildExample();

    const tv1 = byTitle(db.series, "中二病でも恋がしたい！");
    const first = byTitle(db.episodes, "邂逅の…邪王真眼");
    const second = byTitle(db.episodes, "旋律の…聖調理人（プリーステス）");
    const film = byTitle(db.episodes, "映画 中二病でも恋がしたい！ -Take On Me-");
    const rikka = byTitle(db.characters, "小鳥遊六花");

    const executablePath =
      process.env.CHROME_PATH ?? "/usr/bin/google-chrome-stable";
    const browser = await chromium.launch({
      executablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: "ja-JP",
    });
    await context.addInitScript(
      ({ keys, data }) => {
        if (sessionStorage.getItem("seeded")) return;
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem(keys.series, JSON.stringify(data.series));
        localStorage.setItem(keys.episodes, JSON.stringify(data.episodes));
        localStorage.setItem(keys.characters, JSON.stringify(data.characters));
      },
      { keys: storageKeys, data: db },
    );
    const page = await context.newPage();

    const shots = [
      { name: "home", path: "/" },
      { name: "series", path: `/series/${tv1.id}` },
      { name: "episode", path: `/episodes/${first.id}` },
      { name: "episode-roster", path: `/episodes/${second.id}` },
      { name: "film", path: `/episodes/${film.id}` },
      { name: "character", path: `/characters/${rikka.id}` },
      { name: "search", path: `/search?text=${encodeURIComponent("六花")}` },
      { name: "settings", path: "/settings" },
    ];

    for (const shot of shots) {
      console.log(`  撮影中: ${shot.name}`);
      await page.goto(`${baseUrl}${shot.path}`);
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      const dest = join(screenshotsDir, `${shot.name}.png`);
      await page.screenshot({ path: dest, fullPage: true });
      console.log(`  保存完了: ${dest}`);
    }

    console.log("  撮影中: suggest");
    await page.goto(`${baseUrl}/episodes/${second.id}`);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    const body = page.getByRole("textbox", { name: "本文" }).first();
    await body.click();
    await body.pressSequentially("部室で@");
    await page.keyboard.type("六");
    await page.getByRole("listbox").waitFor();
    const suggestDest = join(screenshotsDir, "suggest.png");
    await page.screenshot({ path: suggestDest, fullPage: true });
    console.log(`  保存完了: ${suggestDest}`);

    await browser.close();
    console.log("\nすべてのスクリーンショットを保存しました:", screenshotsDir);
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
