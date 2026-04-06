import { Bell, Droplet, GraduationCap, LayoutDashboard, Menu, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "../utils";

interface MainNavProps {
  mobileOpen: boolean;
  onToggleMobile: () => void;
  onCloseMobile: () => void;
  onOpenStayUpdated: () => void;
  learnEnabled: boolean;
  showBetaBadge: boolean;
}

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  disabled?: boolean;
}

export function MainNav(props: MainNavProps) {
  const navItems: NavItem[] = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/learn", label: "Learn", icon: GraduationCap, disabled: !props.learnEnabled },
    { to: "/practice", label: "Practice", icon: Droplet }
  ];

  return (
    <header className="main-nav">
      <div className="main-nav__inner">
        <NavLink className="main-nav__brand" to="/" end>
          <span className="main-nav__brand-mark" aria-hidden="true">
            <Droplet />
          </span>
          <div className="main-nav__brand-copy">
            <div className="main-nav__brand-title">ABG Master</div>
            {props.showBetaBadge ? <span className="main-nav__beta-badge">Beta</span> : null}
          </div>
        </NavLink>

        <nav className="main-nav__desktop" aria-label="Primary">
          {navItems.map(item => {
            const Icon = item.icon;

            return item.disabled ? (
              <span key={item.to} className="main-nav__link is-disabled" aria-disabled="true">
                <Icon className="main-nav__link-icon" />
                <span>{item.label}</span>
              </span>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn("main-nav__link", isActive && "is-active")}
              >
                <Icon className="main-nav__link-icon" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="main-nav__controls">
          <button className="main-nav__stay-updated" type="button" onClick={props.onOpenStayUpdated}>
            <Bell className="main-nav__link-icon" />
            <span>Stay Updated</span>
          </button>

          <button
            className="main-nav__mobile-stay-updated"
            type="button"
            aria-label="Stay Updated"
            onClick={props.onOpenStayUpdated}
          >
            <Bell />
          </button>

          <button
            className="main-nav__toggle"
            type="button"
            aria-label={props.mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={props.mobileOpen}
            onClick={props.onToggleMobile}
          >
            {props.mobileOpen ? <X /> : <Menu />}
          </button>
        </div>

        <nav className={cn("main-nav__mobile", props.mobileOpen && "is-open")} aria-label="Mobile navigation">
          {navItems.map(item => {
            const Icon = item.icon;

            return item.disabled ? (
              <span key={item.to} className="main-nav__mobile-link is-disabled" aria-disabled="true">
                <Icon className="main-nav__link-icon" />
                <span>{item.label}</span>
              </span>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn("main-nav__mobile-link", isActive && "is-active")}
                onClick={props.onCloseMobile}
              >
                <Icon className="main-nav__link-icon" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
