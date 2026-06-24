import { useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { insightsRouteContract } from "../../core/insights";
import listIconUrl from "../../assets/icons/list.svg";
import { cn } from "../utils";
import { MobileNavDrawer, type MobileNavDrawerItem } from "./MobileNavDrawer";
import type { MobileNavProgress } from "./mobileNavProgress";

interface MainNavProps {
  mobileOpen: boolean;
  onToggleMobile: () => void;
  onCloseMobile: () => void;
  onOpenStayUpdated: () => void;
  learnEnabled: boolean;
  showBetaBadge: boolean;
  mobileProgress: MobileNavProgress;
  wideShell?: boolean;
  onCoreFlowLinkClick?: (label: string, destination: string) => void;
}

interface NavItem {
  to: string;
  label: string;
  description: string;
  icon: MobileNavDrawerItem["icon"];
  end?: boolean;
  disabled?: boolean;
}

export function MainNav(props: MainNavProps) {
  const location = useLocation();
  const hideNavigationItems = location.pathname.startsWith("/calibration");
  const desktopNavRef = useRef<HTMLElement | null>(null);
  const desktopLinkRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, ready: false });
  const navItems: NavItem[] = [
    { to: "/dashboard", label: "Dashboard", description: "Overview & progress", icon: "dashboard", end: true },
    ...(insightsRouteContract.navEligible && insightsRouteContract.navVisible
      ? [{ to: insightsRouteContract.route, label: insightsRouteContract.navigationLabel, description: "Trends from your cases", icon: "insights" as const, end: true }]
      : []),
    { to: "/learn?all=1", label: "Learn", description: "Modules & references", icon: "learn", disabled: !props.learnEnabled },
    { to: "/practice", label: "Practice", description: "Clinical case sets", icon: "practice" }
  ];
  const activeItem = hideNavigationItems ? undefined : navItems.find(item => {
    if (item.disabled) return false;
    if (item.end) return location.pathname === item.to;
    const normalizedTo = item.to.split("?")[0];
    return location.pathname === normalizedTo || location.pathname.startsWith(`${normalizedTo}/`);
  });

  useLayoutEffect(() => {
    let isCancelled = false;

    function updateIndicator() {
      if (isCancelled) return;

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

    const animationFrame = window.requestAnimationFrame(updateIndicator);
    window.addEventListener("resize", updateIndicator);

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(updateIndicator)
      : null;
    const nav = desktopNavRef.current;
    const activeLabel = activeItem ? desktopLinkRefs.current[activeItem.to] : null;
    if (resizeObserver && nav) resizeObserver.observe(nav);
    if (resizeObserver && activeLabel) resizeObserver.observe(activeLabel);

    (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready.then(updateIndicator);

    return () => {
      isCancelled = true;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", updateIndicator);
      resizeObserver?.disconnect();
    };
  }, [activeItem?.to, hideNavigationItems, props.learnEnabled]);

  return (
    <>
      <header className={cn(
        "main-nav",
        hideNavigationItems && "main-nav--minimal",
        props.wideShell && "main-nav--wide-shell"
      )}>
        <div className="main-nav__inner">
        <NavLink className="main-nav__brand" to="/dashboard" end>
          <div className="main-nav__brand-copy">
            <div className="main-nav__brand-title">ABG Master</div>
            {props.showBetaBadge ? <span className="main-nav__beta-badge">Beta</span> : null}
          </div>
        </NavLink>

        {!hideNavigationItems ? (
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
                  onClick={() => {
                    if (item.to.startsWith("/learn") || item.to.startsWith("/practice")) {
                      props.onCoreFlowLinkClick?.(item.label, item.to);
                    }
                  }}
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
        ) : null}

          <div className="main-nav__controls">
            <button className="main-nav__stay-updated" type="button" onClick={props.onOpenStayUpdated}>
              <span className="main-nav__link-icon main-nav__bell-icon" aria-hidden="true" />
              <span>Stay Updated</span>
            </button>

            {!hideNavigationItems ? (
              <button
                ref={mobileTriggerRef}
                className="main-nav__toggle"
                type="button"
                aria-label={props.mobileOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={props.mobileOpen}
                aria-controls="mobile-navigation-drawer"
                onClick={props.onToggleMobile}
              >
                <img src={listIconUrl} alt="" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {!hideNavigationItems ? (
        <MobileNavDrawer
          open={props.mobileOpen}
          triggerRef={mobileTriggerRef}
          onClose={props.onCloseMobile}
          onOpenStayUpdated={props.onOpenStayUpdated}
          onCoreFlowLinkClick={props.onCoreFlowLinkClick}
          items={navItems.map(({ disabled: _disabled, ...item }) => item)}
          progress={props.mobileProgress}
          showBetaBadge={props.showBetaBadge}
        />
      ) : null}
    </>
  );
}
