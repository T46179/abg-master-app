import type { RouteObject } from "react-router-dom";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShell } from "../presentation/layout/AppShell";
import { LandingScreen } from "../presentation/screens/LandingScreen";
import { DashboardScreen } from "../presentation/screens/DashboardScreen";
import { PracticeScreen } from "../presentation/screens/PracticeScreen";
import { ExamScreen } from "../presentation/screens/ExamScreen";
import { LeaderboardScreen } from "../presentation/screens/LeaderboardScreen";

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: <LandingScreen />
  },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { path: "dashboard", element: <DashboardScreen /> },
      { path: "practice", element: <PracticeScreen /> },
      {
        path: "learn",
        children: [
          { index: true, element: <Navigate to="/practice" replace /> },
          { path: "*", element: <Navigate to="/practice" replace /> }
        ]
      },
      { path: "exam", element: <ExamScreen /> },
      { path: "leaderboard", element: <LeaderboardScreen /> },
      { path: "*", element: <Navigate to="/" replace /> }
    ]
  }
];

export const router = createBrowserRouter(appRoutes, {
  basename: import.meta.env.BASE_URL
});
