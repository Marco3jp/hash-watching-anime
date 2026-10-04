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

## 中身

- `src/model/types.ts` — 保存する型
- `src/model/records.ts` — ページを作って、返った id を紐づける。更新と削除
- `src/model/views.ts` — 保存してある配列からサイドパネルを組む関数
- `src/model/body.ts` — 本文の textarea の差分を `TextRun` に写す。行の分割と結合
- `src/model/search.ts` — 検索とサジェストの候補
- `src/model/storage.ts` — LocalStorage への保存、JSON の書き出しと読み込み
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
