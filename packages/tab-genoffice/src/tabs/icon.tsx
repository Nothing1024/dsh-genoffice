/**
 * GenOffice tab / viewer icons. Official guide entries take a component
 * `(props: { size?: number }) => ReactNode`.
 */
import type { ReactNode } from 'react'

/** Shared SVG presentation props for sidebar tab icons (16px grid). */
export const TAB_ICON_PROPS = {
  width: 14,
  height: 14,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** GenOffice document glyph. `size` is accepted for the guide-entry icon. */
export function GenOfficeIcon(_props: { size?: number; className?: string }): ReactNode {
  return (
    <svg {...TAB_ICON_PROPS}>
      <path d="M4 2h5l3 3v9H4z" />
      <path d="M9 2v3h3M6.5 8.5h3M6.5 11h3" />
    </svg>
  )
}
