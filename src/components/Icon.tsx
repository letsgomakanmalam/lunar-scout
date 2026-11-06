import type { ReactNode } from 'react'
import type { ModuleId } from '../data/types'

/** Line icons on a 24px grid. Stroke uses currentColor, so color comes from CSS. */
const PATHS = {
  habitat: <><path d="M4 18v-6a8 6 0 0 1 16 0v6" /><path d="M2.5 18h19" /><path d="M10 18v-4a2 2 0 0 1 4 0v4" /><path d="M7 9.2l1.4 1M17 9.2l-1.4 1" /></>,
  solar: <><rect x="3" y="4" width="18" height="9" rx="1" /><path d="M3 8.5h18M9 4v9M15 4v9" /><path d="M12 13v5M8.5 21l3.5-3 3.5 3" /></>,
  dish: <><path d="M5.5 5a9.5 9.5 0 0 0 13.5 13.5z" /><path d="M12.3 11.7l4.6-4.6" /><circle cx="17.8" cy="6.2" r="1.3" /><path d="M8.5 16.5L6.5 21h7l-2-3.5" /></>,
  flask: <><path d="M9.5 3h5M10.5 3v5.5L5 18.3A1.8 1.8 0 0 0 6.6 21h10.8a1.8 1.8 0 0 0 1.6-2.7L13.5 8.5V3" /><path d="M7.4 14.5h9.2" /><circle cx="10.5" cy="17.5" r=".9" fill="currentColor" stroke="none" /><circle cx="13.8" cy="18.2" r=".6" fill="currentColor" stroke="none" /></>,
  ice: <><path d="M12 2.8v18.4M4 7.4l16 9.2M4 16.6l16-9.2" /><path d="M9.6 4.4L12 6.6l2.4-2.2M9.6 19.6L12 17.4l2.4 2.2M4.6 10.4l3.2-.8-1-3M19.4 13.6l-3.2.8 1 3M4.6 13.6l3.2.8-1 3M19.4 10.4l-3.2-.8 1-3" /></>,
  rover: <><rect x="3.5" y="8" width="13" height="6" rx="1.5" /><path d="M16.5 10h2.6l1.6 3v1h-4.2" /><circle cx="6.5" cy="17" r="2" /><circle cx="12" cy="17" r="2" /><circle cx="17.5" cy="17" r="2" /><path d="M7.5 8V5h4.5" /></>,
  rp: <><path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z" /><path d="M12 8.3l3.2 1.85v3.7L12 15.7l-3.2-1.85v-3.7z" fill="currentColor" stroke="none" /></>,
  star: <path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6.1L12 16.8l-5.4 3 1.2-6.1-4.5-4.2 6.1-.7z" fill="currentColor" stroke="none" />,
  starOutline: <path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6.1L12 16.8l-5.4 3 1.2-6.1-4.5-4.2 6.1-.7z" />,
  probe: <><path d="M12 3l3 5.5H9z" /><rect x="8.5" y="8.5" width="7" height="5" rx="1" /><path d="M9 13.5l-3 5.5M15 13.5l3 5.5M4.5 19h3M16.5 19h3M12 13.5v3" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5v-3a4 4 0 0 1 8 0v3M12 14.5V17" /></>,
  bolt: <path d="M13 2.5L5.5 13.5H11l-1 8 7.5-11H12z" />,
  crew: <><circle cx="12" cy="8.5" r="4.8" /><path d="M9 8.8a3 2.2 0 0 1 6 0" /><path d="M4.5 21a7.5 5.5 0 0 1 15 0" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  cross: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  soundOn: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  soundOff: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></>,
  target: <><circle cx="12" cy="12" r="7" /><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  flag: <path d="M6 21V3.5M6 4h11l-2.5 3.5L17 11H6" />,
  book: <><path d="M5 4.5h10.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h10.5M9 8.5h6" /></>,
  chart: <path d="M4 20h16M7 16v-4M12 16V8M17 16V9" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.4" /></>,
  rocket: <><path d="M12 2.5c3 2.5 4.5 6 4.5 10l-2 3.5h-5l-2-3.5c0-4 1.5-7.5 4.5-10z" /><circle cx="12" cy="9.5" r="1.6" /><path d="M9.5 16L7 19.5M14.5 16l2.5 3.5M12 16v4.5" /></>,
  scan: <><path d="M12 12l7-7" /><path d="M20 12a8 8 0 1 1-8-8" /><path d="M16 12a4 4 0 1 1-4-4" /></>,
  upgrade: <path d="M6 13l6-6 6 6M6 19l6-6 6 6" />,
  remove: <><path d="M4.5 6.5h15M9 6.5V4h6v2.5M6.5 6.5l1 14h9l1-14" /></>,
  grid: <><rect x="3.5" y="3.5" width="17" height="17" rx="1" /><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17" /></>,
  tip: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />,
  signal: <><path d="M4.5 19.5a10.6 10.6 0 0 1 0-15M19.5 4.5a10.6 10.6 0 0 1 0 15M8 16a5.6 5.6 0 0 1 0-8M16 8a5.6 5.6 0 0 1 0 8" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /></>,
  music: <><path d="M9 18V5.5l11-2.5v12.5" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="15.5" r="2.5" /></>,
  musicOff: <><path d="M9 18V5.5l11-2.5v12.5" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="15.5" r="2.5" /><path d="M3 3l18 18" /></>,
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  keyboard: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7 14h10" /></>,
  farm: <><path d="M4 20h16" /><path d="M6 20a6 6 0 0 1 12 0" /><path d="M12 20v-6" /><path d="M12 14c0-2.5 2-4.5 4.5-4.5 0 2.5-2 4.5-4.5 4.5z" /><path d="M12 15.5c0-2-1.6-3.5-3.5-3.5 0 2 1.6 3.5 3.5 3.5z" /></>,
  battery: <><rect x="3" y="7" width="16" height="10" rx="1.5" /><path d="M21 10.5v3" /><path d="M7 10v4M10.5 10v4M14 10v4" /></>,
  pad: <><path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z" /><path d="M9 9v6M15 9v6M9 12h6" /></>,
  oxygen: <><rect x="5" y="6" width="5.5" height="14" rx="2.75" /><rect x="13.5" y="9" width="5.5" height="11" rx="2.75" /><path d="M7.75 6V3.5M16.25 9V6.5" /></>,
  printer: <><path d="M4 20V5h16v15" /><path d="M4 9h16" /><path d="M11 9v3" /><path d="M7.5 20a4.5 4.5 0 0 1 9 0" /></>,
  telescope: <><path d="M5 9a9 9 0 0 0 10 10" /><path d="M5 9l10 10" /><path d="M10 14l5-5" /><circle cx="16" cy="8" r="1.6" /><path d="M9 21h8" /><path d="M12 17v4" /></>,
  quest: <><path d="M7 3h10l2 3v15H5V6z" /><path d="M9 10l2 2 4-4" /><path d="M9 16h6" /></>,
  tech: <><circle cx="12" cy="12" r="2" /><ellipse cx="12" cy="12" rx="9" ry="3.6" /><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></>,
  layers: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>,
  ruler: <><path d="M3.5 16.5l13-13 4 4-13 13z" /><path d="M7 13l1.8 1.8M9.8 10.2l1.2 1.2M12.6 7.4l1.8 1.8M15.4 4.6l1.2 1.2" /></>,
  undo: <path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />,
  medal: <><circle cx="12" cy="15" r="5.5" /><path d="M8.5 3l3.5 6.5L15.5 3M12 12.5l.9 1.8 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" /></>,
  mars: <><circle cx="12" cy="12" r="8.5" /><path d="M4.5 9.5c3 1.2 5.5.2 8-.8s5-1.6 7.2-.4M4 14.3c2.6-.7 4.4.4 6.6 1.2 2.3.8 5 .7 9.2-1.4" /><circle cx="9" cy="6.6" r=".8" fill="currentColor" stroke="none" /></>,
  twins: <><circle cx="7" cy="12" r="4.5" /><circle cx="17" cy="12" r="4.5" /><path d="M11.5 12h1M4.5 9.5c1.5.8 3.5.8 5 0M14.5 14.5c1.5-.8 3.5-.8 5 0" /></>,
  download: <path d="M12 3.5v11.5M7 10.5l5 5 5-5M4.5 20h15" />,
  sun: <><path d="M3 18h18" /><path d="M7.5 18a4.5 4.5 0 0 1 9 0" /><path d="M12 9.5v2M5.6 12.4l1.4 1.4M18.4 12.4L17 13.8M3.5 21h17" /></>,
  pin: <><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof PATHS

export const MODULE_ICON: Record<ModuleId, IconName> = {
  habitat: 'habitat', power: 'solar', comms: 'dish', lab: 'flask', ice: 'ice', rover: 'rover',
  farm: 'farm', battery: 'battery', pad: 'pad', oxygen: 'oxygen', printer: 'printer', telescope: 'telescope',
}

export default function Icon({ name, size = 20, className, title }: { name: IconName; size?: number; className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size} className={`icon ${className ?? ''}`}
      fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} focusable="false"
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  )
}
