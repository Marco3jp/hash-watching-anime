/**
 * スクリーンショット取得スクリプト
 *
 * 使用方法:
 *   npm run screenshot
 *
 * Vite dev サーバーを port 43124 で起動し、src/model/example.ts の見本を
 * Sparkling Journey と同じく addInitScript で localStorage へ注入してから、
 * 各ページを screenshots/ に保存する。システムの Google Chrome を使う。
 * 配色は OS の設定に従うので、撮る側で固定する。基本はダーク、ホームだけライトも撮る。
 *
 * 同期の面を出すため、OAuth クライアント ID にダミーを渡す。
 * Google のスクリプトと Drive API は fakeGoogle で返し、外へは出ない。
 * 最後に偽のドライブ側で同じシリーズを直して競合を起こし、競合の面を撮ってから、
 * ダウンロードと強制上書きで手元の版がドライブに上がるかを確かめる。
 */

import { chromium } from "@playwright/test";
import { mkdir, readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createServer } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const screenshotsDir = join(rootDir, "screenshots");
const port = 43124;
const baseUrl = `http://127.0.0.1:${port}`;

/**
 * 日本語フォントの無い環境では Noto Sans JP を Web フォントで読む。
 * 字の範囲ごとに分かれていて、描いてから追加で取りに行くので、読み込みが止むまで待つ。
 */
async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    const text = `${document.body.innerText}${[...document.querySelectorAll("[placeholder]")]
      .map((element) => element.getAttribute("placeholder"))
      .join("")}`;
    await Promise.all(
      [400, 500, 600, 700].map((weight) =>
        document.fonts.load(`${weight} 16px "Noto Sans JP"`, text),
      ),
    );
    await document.fonts.ready;
  });
  await page.waitForLoadState("networkidle");
}

/**
 * Google Identity Services と Drive API の代わり。
 * トークンはすぐ返し、Drive の appDataFolder は1ファイルだけをメモリに持つ。
 * version は上げるたびに増やす。アプリは上げる前にこれを見て、変わっていればやり直す。
 */
async function fakeGoogle(context) {
  await context.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.google = { accounts: { oauth2: {
        initTokenClient: (config) => ({
          requestAccessToken: () => setTimeout(() => config.callback({ access_token: "fake", expires_in: 3599 }), 0),
        }),
        revoke: () => {},
      } } };`,
    }),
  );
  let file = null;
  const put = (text) => {
    file = { id: "fake-file", text, version: String(Number(file?.version ?? 0) + 1) };
  };
  await context.route("https://www.googleapis.com/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body) => route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
    if (request.method() === "GET" && url.pathname === "/drive/v3/files") {
      return json({ files: file ? [{ id: file.id, version: file.version }] : [] });
    }
    if (request.method() === "GET" && url.searchParams.get("alt") === "media") {
      return route.fulfill({ contentType: "application/json", body: file.text });
    }
    if (request.method() === "GET" && url.searchParams.get("fields") === "version") {
      return json({ version: file.version });
    }
    if (request.method() === "POST" && url.searchParams.get("uploadType") === "multipart") {
      const boundary = request.headers()["content-type"].split("boundary=")[1];
      const parts = request.postData().split(`--${boundary}`);
      const metadata = JSON.parse(parts[1].split("\r\n\r\n")[1]);
      if (metadata.parents?.[0] !== "appDataFolder") throw new Error("appDataFolder ではない");
      put(parts[2].split("\r\n\r\n").slice(1).join("\r\n\r\n").replace(/\r\n$/, ""));
      return json({ id: file.id });
    }
    if (request.method() === "PATCH" && url.searchParams.get("uploadType") === "media") {
      put(request.postData());
      return json({ id: file.id });
    }
    return route.fulfill({ status: 404, body: "" });
  });
  return {
    read: () => file,
    /** ほかの端末が上げたことにする */
    edit: (change) => {
      const data = JSON.parse(file.text);
      change(data);
      put(JSON.stringify(data, null, 2));
    },
  };
}

function byTitle(items, title) {
  const found = items.find((item) => item.title === title);
  if (!found) throw new Error(`見本に無い: ${title}`);
  return found;
}

async function main() {
  await mkdir(screenshotsDir, { recursive: true });
  process.env.VITE_GOOGLE_CLIENT_ID ??= "screenshot.apps.googleusercontent.com";

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

    const franchise = byTitle(db.series, "中二病でも恋がしたい！シリーズ");
    const tv1 = byTitle(db.seasons, "中二病でも恋がしたい！");
    const first = byTitle(db.episodes, "邂逅の…邪王真眼");
    const second = byTitle(db.episodes, "旋律の…聖調理人（プリーステス）");
    const film = byTitle(db.episodes, "映画 中二病でも恋がしたい！ -Take On Me-");
    const rikka = byTitle(db.characters, "小鳥遊六花");
    const evilEye = byTitle(db.terms, "邪王真眼");

    const executablePath =
      process.env.CHROME_PATH ?? "/usr/bin/google-chrome-stable";
    const browser = await chromium.launch({
      executablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: "ja-JP",
      timezoneId: "Asia/Tokyo",
      colorScheme: "dark",
    });
    const drive = await fakeGoogle(context);
    await context.addInitScript(
      ({ keys, data }) => {
        if (sessionStorage.getItem("seeded")) return;
        sessionStorage.setItem("seeded", "1");
        for (const [name, key] of Object.entries(keys)) {
          localStorage.setItem(key, JSON.stringify(data[name]));
        }
      },
      { keys: storageKeys, data: db },
    );
    const page = await context.newPage();
    // 本文の行に入る書いた時刻を、撮るたびに変えない
    await page.clock.setFixedTime(new Date("2026-10-01T21:20:00+09:00"));

    const shots = [
      { name: "home", path: "/" },
      { name: "series", path: `/series/${franchise.id}` },
      { name: "season", path: `/seasons/${tv1.id}` },
      { name: "episode", path: `/episodes/${first.id}` },
      { name: "episode-roster", path: `/episodes/${second.id}` },
      { name: "film", path: `/episodes/${film.id}` },
      { name: "character", path: `/characters/${rikka.id}` },
      { name: "term", path: `/terms/${evilEye.id}` },
      { name: "search", path: `/search?text=${encodeURIComponent("六花")}` },
      { name: "settings", path: "/settings" },
    ];

    for (const shot of shots) {
      console.log(`  撮影中: ${shot.name}`);
      await page.goto(`${baseUrl}${shot.path}`);
      await settle(page);
      const dest = join(screenshotsDir, `${shot.name}.png`);
      await page.screenshot({ path: dest, fullPage: true });
      console.log(`  保存完了: ${dest}`);
    }

    console.log("  撮影中: episode-focus");
    await page.goto(`${baseUrl}/episodes/${first.id}`);
    await settle(page);
    await page.getByRole("textbox", { name: "本文" }).nth(3).click();
    await settle(page);
    const focusDest = join(screenshotsDir, "episode-focus.png");
    await page.screenshot({ path: focusDest, fullPage: true });
    console.log(`  保存完了: ${focusDest}`);

    console.log("  撮影中: suggest");
    await page.goto(`${baseUrl}/episodes/${second.id}`);
    await settle(page);
    const body = page.getByRole("textbox", { name: "本文" }).first();
    await body.click();
    await body.pressSequentially("ここの@");
    await page.keyboard.type("六");
    await page.getByRole("listbox").waitFor();
    await settle(page);
    const suggestDest = join(screenshotsDir, "suggest.png");
    await page.screenshot({ path: suggestDest, fullPage: true });
    console.log(`  保存完了: ${suggestDest}`);

    console.log("  撮影中: search-suggest");
    await page.goto(`${baseUrl}/`);
    await settle(page);
    await page.getByRole("searchbox", { name: "検索" }).fill("六");
    await page.getByRole("listbox").waitFor();
    await settle(page);
    const searchSuggestDest = join(screenshotsDir, "search-suggest.png");
    await page.screenshot({ path: searchSuggestDest, fullPage: true });
    console.log(`  保存完了: ${searchSuggestDest}`);

    console.log("  撮影中: home-light");
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(`${baseUrl}/`);
    await settle(page);
    const lightDest = join(screenshotsDir, "home-light.png");
    await page.screenshot({ path: lightDest, fullPage: true });
    console.log(`  保存完了: ${lightDest}`);

    console.log("  撮影中: settings-sync");
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(`${baseUrl}/settings`);
    await settle(page);
    await page.getByRole("button", { name: "同期する" }).click();
    await page.getByText("最後に同期").waitFor();
    // 押したボタンに hover が残らないように
    await page.mouse.move(1279, 799);
    if (JSON.parse(drive.read().text).seasons.length !== db.seasons.length) {
      throw new Error("ドライブに上げた JSON が手元と違う");
    }
    await settle(page);
    const syncDest = join(screenshotsDir, "settings-sync.png");
    await page.screenshot({ path: syncDest, fullPage: true });
    console.log(`  保存完了: ${syncDest}`);

    console.log("  撮影中: settings-conflict");
    // 同じシーズンを、ほかの端末（偽のドライブ）と手元の両方で直す
    drive.edit((data) => {
      const season = data.seasons.find((item) => item.id === tv1.id);
      season.title = "中二病でも恋がしたい！（ほかの端末）";
      season.updatedAt = "2026-10-01T12:10:00.000Z";
    });
    await page.evaluate(
      ({ key, id }) => {
        const seasons = JSON.parse(localStorage.getItem(key));
        const target = seasons.find((item) => item.id === id);
        target.title = "中二病でも恋がしたい！（この端末）";
        target.updatedAt = "2026-10-01T12:15:00.000Z";
        localStorage.setItem(key, JSON.stringify(seasons));
      },
      { key: storageKeys.seasons, id: tv1.id },
    );
    // 開き直すと、保存してあるトークンで同期する
    await page.reload();
    await page.getByRole("button", { name: "強制上書き" }).waitFor();
    await page.mouse.move(1279, 799);
    await settle(page);
    const conflictDest = join(screenshotsDir, "settings-conflict.png");
    await page.screenshot({ path: conflictDest, fullPage: true });
    console.log(`  保存完了: ${conflictDest}`);

    // 競合したページの面。削除やコピーの並びに「同期の競合」が出る
    console.log("  撮影中: season-conflict");
    await page.goto(`${baseUrl}/seasons/${tv1.id}`);
    await page.getByRole("alert").filter({ hasText: "同期の競合" }).waitFor();
    await settle(page);
    const seasonConflictDest = join(screenshotsDir, "season-conflict.png");
    await page.screenshot({ path: seasonConflictDest, fullPage: true });
    console.log(`  保存完了: ${seasonConflictDest}`);
    await page.goto(`${baseUrl}/settings`);
    await page.getByRole("button", { name: "強制上書き" }).waitFor();

    if (!(await page.getByRole("button", { name: "強制上書き" }).isDisabled())) {
      throw new Error("ドライブの版をダウンロードする前に強制上書きできる");
    }
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "ドライブをダウンロード" }).click();
    const remoteFile = JSON.parse(await readFile(await (await downloaded).path(), "utf8"));
    if (remoteFile.seasons[0]?.title !== "中二病でも恋がしたい！（ほかの端末）") {
      throw new Error("ダウンロードしたドライブの版が違う");
    }
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "強制上書き" }).click();
    await page.getByRole("button", { name: "強制上書き" }).waitFor({ state: "detached" });
    const uploadedTitle = () =>
      JSON.parse(drive.read().text).seasons.find((item) => item.id === tv1.id).title;
    for (let tries = 0; uploadedTitle() !== "中二病でも恋がしたい！（この端末）"; tries += 1) {
      if (tries > 50) throw new Error("強制上書きで手元の版が上がっていない");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // 保存したデータを読めないときの画面。キャラクターのキーだけ壊して撮る
    console.log("  撮影中: broken");
    await page.emulateMedia({ colorScheme: "dark" });
    await page.evaluate((key) => localStorage.setItem(key, "{"), storageKeys.characters);
    await page.goto(`${baseUrl}/`);
    await settle(page);
    const brokenDest = join(screenshotsDir, "broken.png");
    await page.screenshot({ path: brokenDest, fullPage: true });
    console.log(`  保存完了: ${brokenDest}`);

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
