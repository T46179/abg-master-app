import { Award, Flame, Target, TrendingUp, Trophy } from "lucide-react";
import { useAppContext } from "../../app/AppProvider";
import { formatLevelProgressText } from "../../app/viewHelpers";
import { calculateAccuracy, getLevelProgress } from "../../core/progression";
import { ProgressBar } from "../primitives/ProgressBar";
import { SectionHeader } from "../primitives/SectionHeader";
import { Surface } from "../primitives/Surface";
import { ErrorView, LoadingView } from "../shared/StatusViews";

export function ProfileScreen() {
  const { state } = useAppContext();
  if (state.status === "loading" || state.status === "idle") return <LoadingView />;
  if (state.status === "error") return <ErrorView message={state.errorMessage} />;

  const payload = state.payload;
  const levelProgress = getLevelProgress(payload?.progressionConfig ?? null, state.userState);
  const accuracy = calculateAccuracy(state.userState.correctAnswers, state.userState.totalAnswers);
  const achievementCards = [
    { name: "First Steps", description: "Complete your first case", unlocked: state.userState.casesCompleted >= 1, icon: "TT" },
    { name: "Perfect Score", description: "Get 100% on a case", unlocked: state.userState.recentResults.includes(true), icon: "PS" },
    { name: "Week Warrior", description: "Reach a 7 day streak", unlocked: state.userState.streak >= 7, icon: "WW" },
    { name: "Master Mind", description: "Unlock Master difficulty", unlocked: state.userState.unlockedDifficulties.includes("master"), icon: "MM" }
  ];
  const stats = [
    { label: "Total Cases", value: String(state.userState.casesCompleted), icon: Target, tone: "green" },
    { label: "Accuracy", value: `${accuracy}%`, icon: TrendingUp, tone: "blue" },
    { label: "Current Streak", value: `${state.userState.streak} days`, icon: Flame, tone: "orange" },
    { label: "Current Level", value: String(state.userState.level), icon: Trophy, tone: "violet" }
  ] as const;
  const recentActivity = [
    {
      title: `${state.userState.casesCompleted} total cases completed`,
      description: "Practice progress is derived from the persisted runtime user state.",
      badge: `${state.userState.xp} XP`
    },
    {
      title: `${state.userState.streak} day current streak`,
      description: "Daily streak behavior remains unchanged from the migrated runtime logic.",
      badge: state.userState.streak > 0 ? "Streak active" : "Start practicing"
    },
    {
      title: `${state.userState.badges.length} badges earned`,
      description: state.userState.badges.at(-1) ?? "Complete more cases to unlock your next badge.",
      badge: state.userState.badges.length ? "Achievement" : "Pending"
    },
    {
      title: `${state.userState.unlockedDifficulties.length} unlocked difficulties`,
      description: `Highest unlocked difficulty: ${state.userState.unlockedDifficulties.at(-1) ?? "beginner"}`,
      badge: state.userState.isPremium ? "Premium" : "Free"
    }
  ];

  return (
    <main className="app-shell__page profile-screen">
      <div className="profile-screen__container">
        <Surface className="profile-hero" tone="hero">
          <div className="profile-hero__top">
            <div className="profile-hero__avatar">{state.userState.level}</div>
            <div className="profile-hero__copy">
              <h1>ABG Learner</h1>
              <p>Level {state.userState.level} · {state.userState.isPremium ? "Premium member" : "Free learner"}</p>
              <div className="profile-hero__badges">
                <span className="profile-chip">{state.userState.xp} XP</span>
                <span className="profile-chip">{state.userState.casesCompleted} Cases Completed</span>
                {state.userState.isPremium ? <span className="profile-chip">Premium</span> : null}
              </div>
            </div>
          </div>

          <div className="profile-hero__progress">
            <div className="profile-hero__progress-meta">
              <span>Progress to Level {state.userState.level + 1}</span>
              <span>{formatLevelProgressText(levelProgress, state.userState.xp)}</span>
            </div>
            <ProgressBar value={levelProgress.progressPercent} />
          </div>
        </Surface>

        <div className="profile-stats-grid">
          {stats.map(stat => {
            const Icon = stat.icon;
            return (
              <Surface key={stat.label} className="profile-stat-card">
                <div className={`profile-stat-card__icon profile-stat-card__icon--${stat.tone}`}>
                  <Icon />
                </div>
                <div className="profile-stat-card__label">{stat.label}</div>
                <div className="profile-stat-card__value">{stat.value}</div>
              </Surface>
            );
          })}
        </div>

        <Surface className="profile-section">
          <SectionHeader title="Achievements" subtitle="Milestones preserved from the existing progression and badge logic." actions={<Award />} />
          <div className="achievement-grid">
            {achievementCards.map(card => (
              <article key={card.name} className={`achievement-card${card.unlocked ? " is-unlocked" : ""}`}>
                <span className="achievement-card__icon" aria-hidden="true">{card.icon}</span>
                <div>
                  <strong>{card.name}</strong>
                  <p>{card.description}</p>
                  <span className={`achievement-card__status${card.unlocked ? " is-unlocked" : ""}`}>
                    {card.unlocked ? "Unlocked" : "Locked"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </Surface>

        <Surface className="profile-section">
          <SectionHeader title="Earned Badges" subtitle="Directly sourced from the persisted user state." />
          <div className="dashboard-badge-grid">
            {state.userState.badges.length ? state.userState.badges.map(badge => (
              <article key={badge} className="dashboard-badge-card">
                <span className="dashboard-badge-card__icon" aria-hidden="true">{badge.slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{badge}</strong>
                  <p>Achievement unlocked</p>
                </div>
              </article>
            )) : (
              <article className="dashboard-badge-card dashboard-badge-card--empty">
                <span className="dashboard-badge-card__icon" aria-hidden="true">--</span>
                <div>
                  <strong>No badges earned yet</strong>
                  <p>Complete more practice cases to build your collection.</p>
                </div>
              </article>
            )}
          </div>
        </Surface>

        <Surface className="profile-section">
          <SectionHeader title="Recent Activity" subtitle="Runtime-derived summary cards rather than mock timeline data." />
          <div className="activity-list">
            {recentActivity.map(item => (
              <article key={item.title} className="activity-item">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
                <span className="profile-chip">{item.badge}</span>
              </article>
            ))}
          </div>
        </Surface>
      </div>
    </main>
  );
}
