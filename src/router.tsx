import { createBrowserRouter } from "react-router-dom";
import { Missing } from "./app/components/PageFrame.tsx";
import { Layout } from "./app/Layout.tsx";
import { CharacterPage } from "./app/pages/CharacterPage.tsx";
import { EpisodePage } from "./app/pages/EpisodePage.tsx";
import { HomePage } from "./app/pages/HomePage.tsx";
import { SearchPage } from "./app/pages/SearchPage.tsx";
import { SeriesPage } from "./app/pages/SeriesPage.tsx";
import { SettingsPage } from "./app/pages/SettingsPage.tsx";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <Layout />,
      children: [
        { index: true, element: <HomePage /> },
        { path: "series/:id", element: <SeriesPage /> },
        { path: "episodes/:id", element: <EpisodePage /> },
        { path: "characters/:id", element: <CharacterPage /> },
        { path: "search", element: <SearchPage /> },
        { path: "settings", element: <SettingsPage /> },
        { path: "*", element: <Missing what="このページ" /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
