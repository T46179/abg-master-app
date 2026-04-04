import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShell } from "../presentation/layout/AppShell";
import { DashboardScreen } from "../presentation/screens/DashboardScreen";
import { PracticeScreen } from "../presentation/screens/PracticeScreen";
import { LearnScreen } from "../presentation/screens/LearnScreen";
import { ExamScreen } from "../presentation/screens/ExamScreen";
import { LeaderboardScreen } from "../presentation/screens/LeaderboardScreen";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardScreen /> },
      { path: "practice", element: <PracticeScreen /> },
      { path: "learn", element: <LearnScreen /> },
      { path: "exam", element: <ExamScreen /> },
      { path: "leaderboard", element: <LeaderboardScreen /> },
      { path: "*", element: <Navigate to="/" replace /> }
    ]
  }
], {
  basename: import.meta.env.BASE_URL
});
