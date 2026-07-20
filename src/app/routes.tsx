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
import { InsightsScreen } from "../presentation/screens/InsightsScreen";
import { PrivacyScreen } from "../presentation/screens/PrivacyScreen";
import { BloodGasCompensationRulesScreen } from "../presentation/screens/BloodGasCompensationRulesScreen";
import { DeltaRatioScreen } from "../presentation/screens/DeltaRatioScreen";
import { AbgInterpretationScreen } from "../presentation/screens/AbgInterpretationScreen";
import { AnionGapScreen } from "../presentation/screens/AnionGapScreen";
import { CalibrationScreen } from "../presentation/calibration";
import { CasePreviewScreen } from "../presentation/screens/CasePreviewScreen";
import { AuthoredCaseGalleryScreen } from "../presentation/screens/AuthoredCaseGalleryScreen";
import { AboutScreen } from "../presentation/screens/AboutScreen";
import { ResourcesScreen } from "../presentation/screens/ResourcesScreen";
import { UpdatesScreen } from "../presentation/screens/UpdatesScreen";
import { ContactScreen } from "../presentation/screens/ContactScreen";
import { FeaturedCaseScreen } from "../presentation/screens/FeaturedCaseScreen";

export const appRoutes: RouteObject[] = [
  {
    path: "/about",
    element: <AboutScreen />
  },
  {
    path: "/resources",
    element: <ResourcesScreen />
  },
  {
    path: "/updates",
    element: <UpdatesScreen />
  },
  {
    path: "/contact",
    element: <ContactScreen />
  },
  {
    path: "/blood-gas-compensation-rules",
    element: <BloodGasCompensationRulesScreen />
  },
  {
    path: "/delta-ratio",
    element: <DeltaRatioScreen />
  },
  {
    path: "/abg-interpretation",
    element: <AbgInterpretationScreen />
  },
  {
    path: "/anion-gap",
    element: <AnionGapScreen />
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
      { path: "featured-case", element: <FeaturedCaseScreen /> },
      { path: "insights", element: <InsightsScreen /> },
      { path: "calibration", element: <CalibrationScreen /> },
      { path: "case-preview/:caseId", element: <CasePreviewScreen /> },
      { path: "dev/authored-cases", element: <AuthoredCaseGalleryScreen /> },
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
