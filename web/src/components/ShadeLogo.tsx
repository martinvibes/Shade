"use client";

interface ShadeLogoProps {
  size?: number;
  className?: string;
}

export function ShadeLogo({ size = 24, className = "" }: ShadeLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="32" height="32" rx="8" fill="#09090B" />
      <circle cx="16" cy="16" r="10" stroke="#D4A853" strokeWidth="1.5" opacity="0.3" />
      <circle cx="16" cy="16" r="6" stroke="#D4A853" strokeWidth="1.5" opacity="0.6" />
      <circle cx="16" cy="16" r="2.5" fill="#D4A853" />
      <line x1="16" y1="6" x2="16" y2="10" stroke="#D4A853" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <line x1="16" y1="22" x2="16" y2="26" stroke="#D4A853" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <line x1="6" y1="16" x2="10" y2="16" stroke="#D4A853" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <line x1="22" y1="16" x2="26" y2="16" stroke="#D4A853" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}
