import { useLayoutEffect, useRef, useState } from "react";
import { Bell, Menu, X } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "../utils";

interface MainNavProps {
  mobileOpen: boolean;
  onToggleMobile: () => void;
  onCloseMobile: () => void;
  onOpenStayUpdated: () => void;
  learnEnabled: boolean;
  showBetaBadge: boolean;
  wideShell?: boolean;
}

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  disabled?: boolean;
}

export function MainNav(props: MainNavProps) {
  const location = useLocation();
  const desktopNavRef = useRef<HTMLElement | null>(null);
  const desktopLinkRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, ready: false });
  const navItems: NavItem[] = [
    { to: "/dashboard", label: "Dashboard", end: true },
    { to: "/learn", label: "Learn", disabled: !props.learnEnabled },
    { to: "/practice", label: "Practice" }
  ];
  const activeItem = navItems.find(item => {
    if (item.disabled) return false;
    if (item.end) return location.pathname === item.to;
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
  });

  useLayoutEffect(() => {
    function updateIndicator() {
      const nav = desktopNavRef.current;
      const activeLabel = activeItem ? desktopLinkRefs.current[activeItem.to] : null;

      if (!nav || !activeLabel) {
        setIndicatorStyle(style => ({ ...style, ready: false }));
        return;
      }

      const navRect = nav.getBoundingClientRect();
      const labelRect = activeLabel.getBoundingClientRect();
      setIndicatorStyle({
        left: labelRect.left - navRect.left,
        width: labelRect.width,
        ready: true
      });
    }

    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [activeItem?.to, props.learnEnabled]);

  return (
    <header className={cn("main-nav", props.wideShell && "main-nav--wide-shell")}>
      <div className="main-nav__inner">
        <NavLink className="main-nav__brand" to="/dashboard" end>
          <div className="main-nav__brand-copy">
            <div className="main-nav__brand-title">ABG Master</div>
            {props.showBetaBadge ? <span className="main-nav__beta-badge">Beta</span> : null}
          </div>
        </NavLink>

        <nav className="main-nav__desktop" aria-label="Primary" ref={desktopNavRef}>
          {navItems.map(item => {
            return item.disabled ? (
              <span key={item.to} className="main-nav__link is-disabled" aria-disabled="true">
                <span>{item.label}</span>
              </span>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn("main-nav__link", isActive && "is-active")}
              >
                <span ref={node => { desktopLinkRefs.current[item.to] = node; }}>{item.label}</span>
              </NavLink>
            );
          })}
          <span
            className={cn("main-nav__active-indicator", indicatorStyle.ready && "is-ready")}
            aria-hidden="true"
            style={{
              transform: `translateX(${indicatorStyle.left}px)`,
              width: `${indicatorStyle.width}px`
            }}
          />
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
            return item.disabled ? (
              <span key={item.to} className="main-nav__mobile-link is-disabled" aria-disabled="true">
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
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
