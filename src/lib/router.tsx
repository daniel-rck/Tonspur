import { createBrowserRouter } from "react-router-dom";
import { ROUTES } from "./routes.ts";

export const router = createBrowserRouter([
  {
    path: ROUTES.home,
    lazy: async () => {
      const { GamePage } = await import("../features/game/GamePage.tsx");
      return { Component: GamePage };
    },
  },
]);
