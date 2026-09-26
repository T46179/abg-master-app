// Exact SVG geometry from the supplied Figma Make source.
import type { ReactElement } from "react";

function icon(children: ReactElement) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

export function BellIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}
export function GapIcon() {
  return icon(<><path d="M4 7h6M4 12h4M4 17h6" /><path d="M20 7h-6M20 12h-4M20 17h-6" /></>)
}
export function ScaleIcon() {
  return icon(<><path d="M12 3v18" /><path d="M5 21h14" /><path d="M3 8l4-4 4 4M3 8a2 2 0 0 0 4 0M3 8h8" /><path d="M13 8l4-4 4 4M17 12a2 2 0 0 0 4 0" /></>)
}
export function SplitIcon() {
  return icon(<><path d="M12 3v6" /><path d="M12 9c0 3-4 3-4 6a2 2 0 0 0 4 0c0-3-4-3-4-6" transform="translate(4 0)" /><path d="M6 15a2 2 0 0 0 4 0c0-3-4-3-4-6" /><path d="M14 15a2 2 0 0 0 4 0c0-3-4-3-4-6" /></>)
}
export function LungIcon() {
  return icon(<><path d="M12 3v9" /><path d="M12 12c0-1.5-1.2-3-3-3-1.8 0-3 1.4-3 4v3c0 2 1 3 2.5 3S12 21 12 19v-7" /><path d="M12 12c0-1.5 1.2-3 3-3 1.8 0 3 1.4 3 4v3c0 2-1 3-2.5 3S12 21 12 19v-7" /></>)
}
export function DropletIcon() {
  return icon(<><path d="M12 3s6 6 6 10a6 6 0 0 1-12 0c0-4 6-10 6-10Z" /><path d="M9 14a3 3 0 0 0 3 3" /></>)
}
export function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}
export function LayersIcon() {
  return icon(<><path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="M3 13l9 5 9-5" /></>)
}
export function ClockIcon() {
  return icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>)
}
export function ReportIcon() {
  return icon(<><path d="M7 3h7l5 5v13H7z" transform="translate(-1 0)" /><path d="M13 3v5h5" /><path d="M8 13v4M12 11v6M16 14v3" /></>)
}
export function HistoryIcon() {
  return icon(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 4v4h4" /><path d="M12 8v4l3 2" /></>)
}
export function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  )
}
export function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}
export function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l4 4 10-10" />
    </svg>
  )
}
export function CrossIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
export function DotIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
      <circle cx="5" cy="5" r="5" />
    </svg>
  )
}


