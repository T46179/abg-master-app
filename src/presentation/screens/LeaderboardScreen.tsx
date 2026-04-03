import { Trophy } from "lucide-react";
import { TeaserPanel } from "../primitives/TeaserPanel";

export function LeaderboardScreen() {
  return (
    <TeaserPanel
      title="Leaderboard Coming Soon"
      description="Compete with other learners and see how you rank globally. Track your progress and climb the leaderboard as you master ABG interpretation."
      icon={Trophy}
      featureLabel="Feature Under Development"
      items={[
        { title: "Global Rankings", description: "See where you stand" },
        { title: "Weekly Competitions", description: "Fresh challenges each week" },
        { title: "Friend Challenges", description: "Compete with peers" },
        { title: "Seasonal Rewards", description: "Exclusive achievements" }
      ]}
    />
  );
}
