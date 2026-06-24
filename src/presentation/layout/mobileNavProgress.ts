import {
  canAccessDifficulty,
  getDifficultyMeta,
  getLevelProgress,
  getReadinessGateProgressMessage,
  type ProgressionStateInput
} from "../../core/progression";
import { APP_BUILD_LABEL } from "./appBuild";

export interface MobileNavProgress {
  level: number;
  tier: string;
  progressPercent: number;
  isBlocked: boolean;
  remainingLabel: string;
  versionLabel: string;
}

export function getMobileNavProgress(input: ProgressionStateInput): MobileNavProgress {
  const userState = input.userState;
  if (!userState) {
    return {
      level: 1,
      tier: "Beginner",
      progressPercent: 0,
      isBlocked: false,
      remainingLabel: "0 XP until Level 2",
      versionLabel: APP_BUILD_LABEL
    };
  }

  const levelProgress = getLevelProgress(input.progressionConfig, userState);
  const highestUnlockedTier = getDifficultyMeta(input)
    .filter(item => canAccessDifficulty(input, item.level))
    .at(-1)?.label ?? "Beginner";
  const readinessGateProgressMessage = levelProgress.isBlockedByReadinessGate
    ? getReadinessGateProgressMessage(input.progressionConfig, levelProgress.blockedDifficulty)
    : null;
  const remainingLabel = readinessGateProgressMessage ?? (levelProgress.isMaxLevel
    ? "Max level"
    : levelProgress.xpForNextLevel
      ? `${Math.max(0, levelProgress.xpForNextLevel - levelProgress.xpIntoLevel)} XP until Level ${userState.level + 1}`
      : "Max level");
  return {
    level: userState.level,
    tier: highestUnlockedTier,
    progressPercent: levelProgress.progressPercent,
    isBlocked: levelProgress.isBlockedByReadinessGate,
    remainingLabel,
    versionLabel: APP_BUILD_LABEL
  };
}
