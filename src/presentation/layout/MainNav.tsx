import { Droplet, GraduationCap, LayoutDashboard, Menu, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "../utils";

interface MainNavProps {
  mobileOpen: boolean;
  onToggleMobile: () => void;
  onCloseMobile: () => void;
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
        <div className="main-nav__brand">
          <span className="main-nav__brand-mark" aria-hidden="true">
            <Droplet />
          </span>
          <div className="main-nav__brand-copy">
            <div className="main-nav__brand-title">ABG Master</div>
            {props.showBetaBadge ? <span className="main-nav__beta-badge">Beta</span> : null}
          </div>
        </div>

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

        <button
          className="main-nav__toggle"
          type="button"
          aria-label={props.mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={props.mobileOpen}
          onClick={props.onToggleMobile}
        >
          {props.mobileOpen ? <X /> : <Menu />}
        </button>

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
