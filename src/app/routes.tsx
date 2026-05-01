import type { RouteObject } from "react-router-dom";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShell } from "../presentation/layout/AppShell";
import { LandingScreen } from "../presentation/screens/LandingScreen";
import { DashboardScreen } from "../presentation/screens/DashboardScreen";
import { PracticeScreen } from "../presentation/screens/PracticeScreen";
import { ExamScreen } from "../presentation/screens/ExamScreen";
import { LeaderboardScreen } from "../presentation/screens/LeaderboardScreen";
import { LearnScreen } from "../presentation/screens/LearnScreen";
import { LearnLessonScreen } from "../presentation/screens/LearnLessonScreen";
import { PrivacyScreen } from "../presentation/screens/PrivacyScreen";
import { BloodGasCompensationRulesScreen } from "../presentation/screens/BloodGasCompensationRulesScreen";

export const appRoutes: RouteObject[] = [
  {
    path: "/blood-gas-compensation-rules",
    element: <BloodGasCompensationRulesScreen />
  },
  {
    path: "/",
    element: <LandingScreen />
  },
  {
    path: "/privacy",
    element: <PrivacyScreen />
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
          { index: true, element: <LearnScreen /> },
          { path: ":difficulty", element: <LearnLessonScreen /> },
          { path: "*", element: <Navigate to="/learn" replace /> }
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
