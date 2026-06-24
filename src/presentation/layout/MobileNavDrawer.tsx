// Drawer-local spacing and typography mirror Figma because the shared theme has no reusable tokens for this scale.
import { useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Award, Bell, BookOpen, ChevronRight, LayoutDashboard, Stethoscope, TrendingUp, X, type LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import { ProgressBar } from "../primitives/ProgressBar";
import { cn } from "../utils";
import type { MobileNavProgress } from "./mobileNavProgress";

export interface MobileNavDrawerItem {
  to: string;
  label: string;
  description: string;
  end?: boolean;
  icon: "dashboard" | "insights" | "learn" | "practice";
}

interface MobileNavDrawerProps {
  open: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onOpenStayUpdated: () => void;
  onCoreFlowLinkClick?: (label: string, destination: string) => void;
  items: MobileNavDrawerItem[];
  progress: MobileNavProgress;
  showBetaBadge: boolean;
}

const drawerId = "mobile-navigation-drawer";

const iconByName: Record<MobileNavDrawerItem["icon"], LucideIcon> = {
  dashboard: LayoutDashboard,
  insights: TrendingUp,
  learn: BookOpen,
  practice: Stethoscope
};

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export function MobileNavDrawer(props: MobileNavDrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (props.open) {
      panel.removeAttribute("inert");
      return;
    }
    panel.setAttribute("inert", "");
  }, [props.open]);

  useEffect(() => {
    if (!props.open) {
      if (wasOpenRef.current) {
        props.triggerRef.current?.focus();
        wasOpenRef.current = false;
      }
      return;
    }

    wasOpenRef.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        props.onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [props.open, props.onClose, props.triggerRef]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className={cn("mobile-nav-drawer", props.open && "is-open")} aria-hidden={!props.open}>
      <div className="mobile-nav-drawer__backdrop" onClick={props.onClose} />
      <div
        ref={panelRef}
        id={drawerId}
        className="mobile-nav-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
        aria-hidden={!props.open}
        tabIndex={-1}
      >
        <header className="mobile-nav-drawer__header">
          <div className="mobile-nav-drawer__brand">
            <span>ABG Master</span>
            {props.showBetaBadge ? <span className="mobile-nav-drawer__beta">Beta</span> : null}
          </div>
          <button
            ref={closeButtonRef}
            className="mobile-nav-drawer__close"
            type="button"
            aria-label="Close navigation menu"
            onClick={props.onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <section className="mobile-nav-drawer__progress" aria-label="Your progress">
          <div className="mobile-nav-drawer__progress-copy">
            <span className="mobile-nav-drawer__eyebrow">Level {props.progress.level} · {props.progress.tier}</span>
            <span className="mobile-nav-drawer__remaining">{props.progress.remainingLabel}</span>
          </div>
          <span className="mobile-nav-drawer__progress-icon" aria-hidden="true"><Award /></span>
          <ProgressBar
            className="mobile-nav-drawer__progress-bar"
            value={props.progress.progressPercent}
            blocked={props.progress.isBlocked}
          />
        </section>

        <p className="mobile-nav-drawer__section-label">Navigate</p>
        <nav className="mobile-nav-drawer__links" aria-label="Mobile navigation links">
          {props.items.map(item => {
            const Icon = iconByName[item.icon];
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn("mobile-nav-drawer__link", isActive && "is-active")}
                onClick={() => {
                  if (item.to.startsWith("/learn") || item.to.startsWith("/practice")) {
                    props.onCoreFlowLinkClick?.(item.label, item.to);
                  }
                  props.onClose();
                }}
              >
                <span className="mobile-nav-drawer__link-icon" aria-hidden="true"><Icon /></span>
                <span className="mobile-nav-drawer__link-copy">
                  <span>{item.label}</span>
                  <small>{item.description}</small>
                </span>
                <ChevronRight className="mobile-nav-drawer__chevron" aria-hidden="true" />
              </NavLink>
            );
          })}
        </nav>

        <footer className="mobile-nav-drawer__footer">
          <button className="mobile-nav-drawer__stay-updated" type="button" onClick={props.onOpenStayUpdated}>
            <span className="mobile-nav-drawer__stay-updated-icon" aria-hidden="true"><Bell /></span>
            <span>
              <strong>Stay Updated</strong>
              <small>Weekly tips &amp; new modules</small>
            </span>
          </button>
          <p>{props.progress.versionLabel}</p>
        </footer>
      </div>
    </div>,
    document.body
  );
}
