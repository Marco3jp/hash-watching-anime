# hash-watching-anime

アニメを見ながら、話ごとのページに実況メモを書くブラウザアプリ。いまは 1st の範囲で、話、シリーズ、キャラクターのサイドパネルまで。保存先はブラウザの LocalStorage。

参考にした [sparkling-journey](https://github.com/Marco3jp/sparkling-journey) は、作品とタグをブラウザに置く台帳。このメモとはページの単位が違うので、同じリポジトリにはまとめていない。

## 起動

```bash
npm install
npm run dev
```

開発サーバーは http://127.0.0.1:43123 で開く。最初は空。ホームでシリーズを作るところから始める。

`main` への push で GitHub Actions が GitHub Pages に載せる。公開先は https://marco3jp.github.io/hash-watching-anime/ 。ローカルの開発サーバーはルートのまま。

## 使い方

- ホームでシリーズを作る。劇場版・単発を選ぶと「本編」の話が1本でき、そのページが開く
- シリーズのサイドパネルで話を足し、キャラクター名簿を作る
- 話のページの本文に、そのまま書く。Enter で次の行、Shift+Enter で行内の改行、左の欄に時刻
- `@` に続けて打つとサジェストが開く。選んだページの id がリンクとして本文に入る。リンクは Ctrl（Mac は ⌘）+クリックで開く
- 話のサイドパネルで出演を付ける。出演が無い話は、シリーズの名簿を出す
- 右上の検索は、題名、別名、話数、本文の文字列で探す
- 「書き出しと読み込み」で JSON に書き出し、同じ id のまま読み込む
- Google ドライブと同期できる（OAuth クライアント ID を渡したビルドだけ）。見出しは「同期と書き出し」になる

## Google ドライブと同期

ブラウザから Drive API を直接呼び、Drive の appDataFolder（このアプリだけが見える隠しフォルダ）に `hash-watching-anime.json` を1つ置く。サーバーは無い。

使うには Google Cloud で OAuth クライアント ID を作り、ビルドに `VITE_GOOGLE_CLIENT_ID` で渡す。

1. Google Cloud のプロジェクトで Google Drive API を有効にする
2. Google Auth platform で同意画面を作る。対象は「外部」。テスト中は、使う Google アカウントをテストユーザーに足す。データアクセスにスコープ `https://www.googleapis.com/auth/drive.appdata` を足す（非機密のスコープ）
3. クライアントで「ウェブ アプリケーション」の OAuth クライアント ID を作り、承認済みの JavaScript 生成元に `https://marco3jp.github.io` を足す。手元で試すなら `http://localhost` と `http://localhost:43123` も足し、開発サーバーを localhost で開く
4. GitHub のリポジトリの Settings → Secrets and variables → Actions → Variables に `GOOGLE_CLIENT_ID` を置く。手元では `.env.local` に `VITE_GOOGLE_CLIENT_ID=...`

クライアント ID はページに埋め込まれて誰でも読めるもので、秘密ではない。

## 中身

- `src/model/types.ts` — 保存する型
- `src/model/records.ts` — ページを作って、返った id を紐づける。更新と削除
- `src/model/views.ts` — 保存してある配列からサイドパネルを組む関数
- `src/model/body.ts` — 本文の textarea の差分を `TextRun` に写す。行の分割と結合
- `src/model/search.ts` — 検索とサジェストの候補
- `src/model/storage.ts` — LocalStorage への保存、JSON の書き出しと読み込み
- `src/model/sync.ts` — 同期で、手元とドライブの Database をページ単位で合わせる
- `src/sync/` — Google のトークン、Drive API、同期の段取り
- `src/model/example.ts` — 『中二病でも恋がしたい！』周辺の見本。テストとスクショのシード
- `src/app/` — 画面。ページは `src/router.tsx`

方針と作業の記録は `開発ノート.md`。

## 確認

```bash
npm run test
npm run lint
npm run build
npm run screenshot
```

`npm run screenshot` は port 43124 で Vite を上げ、見本を LocalStorage に注入して、`screenshots/` を更新する。
