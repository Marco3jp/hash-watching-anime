# hash-watching-anime

アニメを見ながら、話ごとのページに実況メモを書くブラウザアプリ。話はシーズンにまとめ、シーズンは任意でシリーズに束ねる。キャラクターのサイドパネルもある。保存先はブラウザの LocalStorage。

参考にした [sparkling-journey](https://github.com/Marco3jp/sparkling-journey) は、作品とタグをブラウザに置く台帳。このメモとはページの単位が違うので、同じリポジトリにはまとめていない。

## 起動

```bash
npm install
npm run dev
```

開発サーバーは http://127.0.0.1:43123 で開く。最初は空。ホームでシーズンを作るところから始める。

`main` への push で GitHub Actions が GitHub Pages に載せる。公開先は https://marco3jp.github.io/hash-watching-anime/ 。ローカルの開発サーバーはルートのまま。

## 使い方

- ホームでシーズンを作る。劇場版・単発を選ぶと「本編」の話が1本でき、そのページが開く
- シーズンのサイドパネルで話を足し、キャラクター名簿を作る
- 続編や劇場版があれば、シーズンのサイドパネルの「シリーズ」でシリーズを作って入れる。シリーズの面で並べた順が前後になる
- 話のページの本文に、そのまま書く。Enter で次の行、Shift+Enter で行内の改行、左の欄に時刻
- `@` に続けて打つとサジェストが開く。選んだページの id がリンクとして本文に入る。リンクは Ctrl（Mac は ⌘）+クリックで開く
- 話のサイドパネルで出演を付ける。出演が無い話は、シーズンの名簿を出す
- 右上の検索は、題名、別名、話数、本文の文字列で探す
- 「書き出しと読み込み」で JSON に書き出し、同じ id のまま読み込む
- Google ドライブと同期できる（OAuth クライアント ID を渡したビルドだけ）。見出しは「同期と書き出し」になる

## Google ドライブと同期

ブラウザから Drive API を直接呼び、Drive の appDataFolder（このアプリだけが見える隠しフォルダ）に `hash-watching-anime.json` を1つ置く。サーバーは無い。

- 両方の端末で直したページは「競合」になり、同期から外れる。設定で両方の版をダウンロードでき、ドライブの版をダウンロードしてから「強制上書き」で手元の版を勝たせる。ドライブの版を取りたいときは、ダウンロードした JSON を「読み込み」で読む
- トークンは LocalStorage に置き、開き直しても使う。切れるまでは約1時間。切れたらヘッダーの「認証切れ（要再認証）」を押す

### セットアップ

クライアント ID はページに埋め込まれて誰でも読めるもので、秘密ではない。クライアントシークレットは使わない。

Google Cloud（1回だけ）

1. https://console.cloud.google.com/projectcreate でプロジェクトを作る。名前は何でもよい（例: `hash-watching-anime`）
2. 上のプロジェクト選択で、作ったプロジェクトを選ぶ
3. https://console.cloud.google.com/apis/library/drive.googleapis.com を開き「有効にする」
4. https://console.cloud.google.com/auth/overview を開き「開始」
   1. アプリ情報: アプリ名 `#watching_anime`、ユーザー サポートメールに自分のアドレス →「次へ」
   2. 対象: 「外部」→「次へ」
   3. 連絡先情報: 自分のアドレス →「次へ」
   4. 終了: ポリシーに同意 →「作成」
5. 左の「対象」（Audience）→ テストユーザーの「Add users」→ 同期に使う Google アカウントを足す →「保存」。公開ステータスは「テスト」のままでよい
6. 左の「データアクセス」（Data Access）→「スコープを追加または削除」→ 下の「スコープの手動追加」に `https://www.googleapis.com/auth/drive.appdata` を入れて「テーブルに追加」→「更新」→ ページ下の「保存」
7. 左の「クライアント」（Clients）→「クライアントを作成」
   1. アプリケーションの種類: 「ウェブ アプリケーション」
   2. 名前: 何でもよい
   3. 承認済みの JavaScript 生成元に次の3つを足す
      - `https://marco3jp.github.io`
      - `http://localhost`
      - `http://localhost:43123`
   4. 承認済みのリダイレクト URI: 空のまま
   5. 「作成」→ 出てきたクライアント ID（`…apps.googleusercontent.com`）を控える

GitHub Pages に載せる（1回だけ）

8. `gh variable set GOOGLE_CLIENT_ID -R Marco3jp/hash-watching-anime --body "<控えたクライアント ID>"`（リポジトリの変数。または Settings → Secrets and variables → Actions → Variables → New repository variable で `GOOGLE_CLIENT_ID`）。`gh variable list -R Marco3jp/hash-watching-anime` に出れば入っている
9. `main` に push するか、Actions の Deploy を Run workflow で回す
10. https://marco3jp.github.io/hash-watching-anime/ を開き、ナビが「同期と書き出し」、ヘッダーの検索欄の左が「未認証」になっていることを確かめる

手元で試す（任意）

11. リポジトリ直下に `.env.local` を作り、`VITE_GOOGLE_CLIENT_ID=<控えたクライアント ID>` と書く（`*.local` は git に入らない）
12. `npm run dev`
13. http://localhost:43123 で開く。`127.0.0.1` だと生成元が違い、Google に断られる

端末ごと

14. ヘッダーの「未認証」（または設定の「同期する」）を押す
15. ポップアップでテストユーザーに足したアカウントを選ぶ
16. 「Google はこのアプリを確認していません」が出たら「続行」
17. 許可を求める画面で「続行」
18. ヘッダーが「認証済（残59分）」になり、設定に「最後に同期」の時刻が出る
19. 2台目以降も 14〜18 を行う。手元のデータは、ドライブのデータと合わさる。同じページが両方で違えば競合になる

確かめる

20. 1台目でページを直し、3秒待つ
21. 2台目でタブに戻るか、設定の「今すぐ同期」を押す
22. 直した内容が出れば同期できている

約1時間ごと

23. ヘッダーが「認証切れ（要再認証）」になったら押す。2回目からは同意の画面は出ず、ポップアップが開いて閉じる

やめる

24. 設定の「やめる」。トークンを取り消し、この端末の同期の記録（base と競合）を捨てる。ドライブのファイルは残る
25. ドライブのファイルも消すときは、Google ドライブの 設定 → アプリを管理 → このアプリの「オプション」→「アプリデータを削除」

## 中身

- `src/model/types.ts` — 保存する型
- `src/model/records.ts` — ページを作って、返った id を紐づける。更新と削除
- `src/model/views.ts` — 保存してある配列からサイドパネルを組む関数
- `src/model/body.ts` — 本文の textarea の差分を `TextRun` に写す。行の分割と結合
- `src/model/search.ts` — 検索とサジェストの候補
- `src/model/storage.ts` — LocalStorage への保存、JSON の書き出しと読み込み
- `src/model/sync.ts` — 同期で、手元とドライブの Database をページ単位で合わせる。両方で直したページは競合
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
