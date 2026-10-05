import { createBrowserRouter } from "react-router-dom";
import { Missing } from "./app/components/PageFrame.tsx";
import { PageError } from "./app/components/Recovery.tsx";
import { Layout } from "./app/Layout.tsx";
import { CharacterPage } from "./app/pages/CharacterPage.tsx";
import { EpisodePage } from "./app/pages/EpisodePage.tsx";
import { HomePage } from "./app/pages/HomePage.tsx";
import { SearchPage } from "./app/pages/SearchPage.tsx";
import { SeasonPage } from "./app/pages/SeasonPage.tsx";
import { SeriesPage } from "./app/pages/SeriesPage.tsx";
import { SettingsPage } from "./app/pages/SettingsPage.tsx";
import { TermPage } from "./app/pages/TermPage.tsx";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <Layout />,
      errorElement: (
        <div className="mx-auto box-border w-full max-w-6xl px-4">
          <PageError />
        </div>
      ),
      children: [
        {
          errorElement: <PageError />,
          children: [
            { index: true, element: <HomePage /> },
            { path: "series/:id", element: <SeriesPage /> },
            { path: "seasons/:id", element: <SeasonPage /> },
            { path: "episodes/:id", element: <EpisodePage /> },
            { path: "characters/:id", element: <CharacterPage /> },
            { path: "terms/:id", element: <TermPage /> },
            { path: "search", element: <SearchPage /> },
            { path: "settings", element: <SettingsPage /> },
            { path: "*", element: <Missing what="このページ" /> },
          ],
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
