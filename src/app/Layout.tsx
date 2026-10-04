import { useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { pagesOf } from "../model/views.ts";
import { JumpSuggest } from "./components/JumpSuggest.tsx";
import { BrokenStorage } from "./components/Recovery.tsx";
import { paths, hashName } from "./paths.ts";
import { useDatabase, useStoreStatus } from "./store.ts";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 font-medium ${isActive ? "text-theme-dark" : "text-theme hover:text-theme-dark"}`;

export function Layout() {
  const navigate = useNavigate();
  const db = useDatabase();
  const status = useStoreStatus();
  const [text, setText] = useState("");

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = text.trim();
    if (query) navigate(paths.search(query));
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          {/* 見せる名前は #watching_anime。# を印にして、実況のハッシュタグに見せる。保存キーやパッケージ名は hash-watching-anime のまま */}
          <Link
            to={paths.home}
            aria-label="#watching_anime"
            className="flex items-center gap-1.5 font-semibold text-theme"
          >
            <span
              aria-hidden
              className="inline-flex size-6 items-center justify-center rounded-md bg-theme text-sm font-bold text-on-theme"
            >
              #
            </span>
            <span aria-hidden>watching_anime</span>
          </Link>
          <nav className="flex gap-4 text-sm">
            <NavLink to={paths.home} end className={navClass}>
              ホーム
            </NavLink>
            <NavLink to={paths.settings} className={navClass}>
              書き出しと読み込み
            </NavLink>
          </nav>
          <form
            onSubmit={onSearch}
            className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto"
            role="search"
          >
            <JumpSuggest
              type="search"
              aria-label="検索"
              value={text}
              onChange={setText}
              pages={pagesOf(db)}
              hintOf={(page) => {
                if (page.kind !== "episode") return undefined;
                const season = db.seasons.find((item) => item.id === page.seasonId);
                return season ? hashName(season) : undefined;
              }}
              className="flex-1 sm:w-60 sm:flex-none"
            />
            <button type="submit" className="btn">
              探す
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto box-border w-full max-w-6xl flex-1 px-4 pt-8 pb-24">
        {status.kind === "broken" ? <BrokenStorage message={status.message} /> : <Outlet />}
      </main>
    </div>
  );
}
