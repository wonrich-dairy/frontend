/**
 * The glyphs used in the Figma frames, inlined so the screen carries no icon dependency and
 * every mark inherits the surrounding colour.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
} as const;

export function DropletIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3s5.5 6.2 5.5 9.8a5.5 5.5 0 0 1-11 0C6.5 9.2 12 3 12 3Z" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

export function PersonIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function PlusCircleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4 2.8 20h18.4L12 4Z" />
      <path d="M12 10v4M12 17.2v.1" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    </svg>
  );
}

export function FlaskIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 3h4M10.5 3v6.2L5.8 17.4A2 2 0 0 0 7.5 20.5h9a2 2 0 0 0 1.7-3.1L13.5 9.2V3" />
      <path d="M8 15h8" />
    </svg>
  );
}

export function CloudOffIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7.5 18h9a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.4 8.5" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

export function CloudIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7.5 18h9a4 4 0 0 0 .6-7.96A6 6 0 0 0 5.7 11 3.5 3.5 0 0 0 6 18Z" />
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m4 11 8-6 8 6v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

export function ClipboardIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 4h6v3H9zM7 5H5v15h14V5h-2" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M4.6 7.5l1.7 1M17.7 15.5l1.7 1M4.6 16.5l1.7-1M17.7 8.5l1.7-1" />
    </svg>
  );
}

export function LogoMark(props: IconProps) {
  return (
    <svg {...base} width={22} height={22} {...props}>
      <path d="M3 15c3-1 5-4 9-4s6 3 9 4" />
      <path d="M6 15v3h12v-3" />
      <circle cx="12" cy="7" r="2.2" />
    </svg>
  );
}

export function TruckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </svg>
  );
}

export function TraceIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4h5v5H4zM15 4h5v5h-5zM4 15h5v5H4z" />
      <path d="M15 15h2v2h-2zM19 19h1M19 15h1M15 19h1" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19c0-3 2.7-4.8 6-4.8s6 1.8 6 4.8" />
      <path d="M16 8.4a3 3 0 0 1 0 5.2M17.5 19c0-2-.8-3.4-2-4.3" />
    </svg>
  );
}

export function GridPlusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 9v6M9 12h6" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  );
}

export function ThermometerIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 13.5V5.5a2 2 0 1 1 4 0v8a4 4 0 1 1-4 0Z" />
      <path d="M16 7h3M16 10h3" />
    </svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </svg>
  );
}

export function BadgeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="6" width="17" height="13" rx="2" />
      <path d="M9 3.5h6v2.5H9zM7.5 12h4M7.5 15.5h6" />
    </svg>
  );
}

export function SaveIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 5h11l3 3v11H5z" />
      <path d="M8.5 5v4h6V5M8.5 19v-5h7v5" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m5 9 7 7 7-7" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M14 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4" />
      <path d="M10 8.5 13.5 12 10 15.5M13.5 12H4" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6.5 10a5.5 5.5 0 1 1 11 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10Z" />
      <path d="M10.5 19a1.8 1.8 0 0 0 3 0" />
    </svg>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.8 9.6a2.3 2.3 0 1 1 3.1 2.1c-.6.3-.9.8-.9 1.4v.4" />
      <path d="M12 16.6h.01" />
    </svg>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 12 4 5l2.6 7L4 19z" />
    </svg>
  );
}

export function LoginIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4" />
      <path d="m14 8.5 3.5 3.5-3.5 3.5M17.5 12H8" />
    </svg>
  );
}

export function TankIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="4" width="14" height="16" rx="3" />
      <path d="M5 13h14" />
    </svg>
  );
}

export function AlertTempIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 13.5V5.5a2 2 0 1 1 4 0v8a4 4 0 1 1-4 0Z" />
      <path d="M16.5 8h3" />
    </svg>
  );
}
