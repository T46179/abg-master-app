import type { ReactNode } from "react"

/* Inline icons matching the app's 1.6 stroke set. */

function Svg({ size = 20, stroke = 1.6, children }: { size?: number; stroke?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

export const UserIcon = ({ size = 18 }: { size?: number }) => (
  <Svg size={size}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
  </Svg>
)
export const MailIcon = ({ size = 22 }: { size?: number }) => (
  <Svg size={size}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m4 7 8 6 8-6" />
  </Svg>
)
export const EyeIcon = () => (
  <Svg size={18}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
)
export const EyeOffIcon = () => (
  <Svg size={18}>
    <path d="M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.9 0 3.5-.6 4.9-1.5" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="m3 3 18 18" />
  </Svg>
)
export const CheckIcon = ({ size = 15 }: { size?: number }) => (
  <Svg size={size} stroke={2.2}>
    <path d="M5 12l4 4 10-10" />
  </Svg>
)
export const AlertIcon = ({ size = 15 }: { size?: number }) => (
  <Svg size={size} stroke={1.9}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5" />
    <path d="M12 16.4v.1" />
  </Svg>
)
export const InfoIcon = ({ size = 15 }: { size?: number }) => (
  <Svg size={size} stroke={1.9}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5" />
    <path d="M12 7.6v.1" />
  </Svg>
)
export const ArrowIcon = () => (
  <Svg size={18} stroke={1.8}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
)
export const ChevronLeftIcon = () => (
  <Svg size={16} stroke={1.8}>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
)
export const ClockIcon = ({ size = 22 }: { size?: number }) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
)
export const KeyIcon = ({ size = 22 }: { size?: number }) => (
  <Svg size={size}>
    <circle cx="8" cy="15" r="4" />
    <path d="m10.8 12.2 8.7-8.7M16 7l2.5 2.5M18.5 4.5 21 7" />
  </Svg>
)
export const CloudOffIcon = ({ size = 22 }: { size?: number }) => (
  <Svg size={size}>
    <path d="M7.5 18.5h9.8a4 4 0 0 0 1.3-7.8 6 6 0 0 0-9.7-3.4M5.3 9.4A4.5 4.5 0 0 0 7.5 18.5" />
    <path d="m3 3 18 18" />
  </Svg>
)
export const SyncIcon = ({ size = 16 }: { size?: number }) => (
  <Svg size={size} stroke={1.8}>
    <path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" />
    <path d="M4 4v4h4" />
    <path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" />
    <path d="M20 20v-4h-4" />
  </Svg>
)
export const SignOutIcon = ({ size = 16 }: { size?: number }) => (
  <Svg size={size} stroke={1.8}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    <path d="M10 16l-4-4 4-4M6 12h10" />
  </Svg>
)
export const LockIcon = ({ size = 16 }: { size?: number }) => (
  <Svg size={size} stroke={1.8}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Svg>
)
export const ReportIcon = () => (
  <Svg>
    <path d="M6 3h7l5 5v13H6z" />
    <path d="M13 3v5h5" />
    <path d="M9 13v4M12 11v6M15 14v3" />
  </Svg>
)
export const LayersIcon = () => (
  <Svg>
    <path d="M12 3 3 8l9 5 9-5-9-5Z" />
    <path d="M3 13l9 5 9-5" />
  </Svg>
)
export const HistoryIcon = () => (
  <Svg>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 4v4h4" />
    <path d="M12 8v4l3 2" />
  </Svg>
)
export const ClipboardIcon = () => (
  <Svg>
    <rect x="5" y="4.5" width="14" height="16.5" rx="2.5" />
    <path d="M9 4.5V3.8A1.3 1.3 0 0 1 10.3 2.5h3.4A1.3 1.3 0 0 1 15 3.8v.7" />
    <path d="m9 13 2 2 4-4.5" />
  </Svg>
)
