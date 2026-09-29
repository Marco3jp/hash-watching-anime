import { useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { paths } from "./paths.ts";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 rounded-full px-2.5 py-1 ${
    isActive ? "bg-ink text-paper-2" : "text-muted hover:bg-paper-2 hover:text-ink"
  }`;

export function Layout() {
  const navigate = useNavigate();
  const [text, setText] = useState("");

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = text.trim();
    if (query) navigate(paths.search(query));
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <Link to={paths.home} className="font-serif text-lg font-semibold">
            hash-watching-anime
          </Link>
          <nav className="flex gap-1 text-sm">
            <NavLink to={paths.home} end className={navClass}>
              ホーム
            </NavLink>
            <NavLink to={paths.settings} className={navClass}>
              書き出しと読み込み
            </NavLink>
          </nav>
          <form onSubmit={onSearch} className="ml-auto flex gap-2" role="search">
            <input
              type="search"
              aria-label="検索"
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="w-56 rounded-md border border-line bg-paper-2 px-2.5 py-1 text-sm outline-none focus:border-seal"
            />
            <button
              type="submit"
              className="rounded-md border border-ink bg-ink px-3 py-1 text-sm text-paper-2"
            >
              探す
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8">
        <Outlet />
      </main>
    </div>
  );
}
