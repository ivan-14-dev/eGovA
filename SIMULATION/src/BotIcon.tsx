import type { SVGProps } from 'react'

export function BotIcon({ size = 20, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="4" y="7" width="16" height="13" rx="4" />
      <path d="M12 3v4m-4 6h.01M16 13h.01M9 17h6" />
    </svg>
  )
}

export function BotOrb({ className = '', size = 'normal' }: { className?: string; size?: 'normal' | 'hero' | 'small' }) {
  return (
    <div className={`bot-orb bot-orb-${size} ${className}`} aria-hidden="true">
      <span className="bot-face">
        <i />
        <i />
      </span>
    </div>
  )
}
