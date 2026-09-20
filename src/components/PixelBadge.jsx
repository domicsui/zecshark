import React from 'react';

export default function PixelBadge({ status, text, size = 'md', className = '' }) {
  const normStatus = (status || '').toUpperCase();

  const configs = {
    'LOCKED': {
      bg: 'bg-zinc-800 text-zinc-400 border-zinc-950',
      icon: '🔒',
      defaultText: 'LOCKED'
    },
    'READY': {
      bg: 'bg-[#FFC107] text-black border-black',
      icon: '⚡',
      defaultText: 'READY'
    },
    'VERIFYING': {
      bg: 'bg-[#FF8800] text-black border-black animate-pulse',
      icon: '⏳',
      defaultText: 'VERIFYING...'
    },
    'VERIFIED': {
      bg: 'bg-[#10B981] text-black border-black',
      icon: '✓',
      defaultText: 'VERIFIED'
    },
    'FAILED': {
      bg: 'bg-[#EF4444] text-white border-black',
      icon: '✕',
      defaultText: 'FAILED'
    },
    'TRY AGAIN': {
      bg: 'bg-[#F59E0B] text-black border-black',
      icon: '↻',
      defaultText: 'TRY AGAIN'
    },
    'COMPLETED': {
      bg: 'bg-[#10B981] text-black border-black',
      icon: '★',
      defaultText: 'COMPLETED'
    },
    'IN PROGRESS': {
      bg: 'bg-[#FF8800] text-black border-black animate-pulse',
      icon: '▶',
      defaultText: 'IN PROGRESS'
    },
    'UPCOMING': {
      bg: 'bg-[#272733] text-zinc-300 border-black',
      icon: '◇',
      defaultText: 'UPCOMING'
    },
    'ELIGIBLE': {
      bg: 'bg-[#10B981] text-black border-black',
      icon: '✓',
      defaultText: 'ELIGIBLE'
    },
    'NOT ELIGIBLE': {
      bg: 'bg-[#EF4444] text-white border-black',
      icon: '✕',
      defaultText: 'NOT ELIGIBLE'
    }
  };

  const conf = configs[normStatus] || {
    bg: 'bg-[#FF8800] text-black border-black',
    icon: '',
    defaultText: normStatus
  };

  const sizeClasses = size === 'sm' 
    ? 'text-[9px] px-2 py-1 border-2 shadow-[2px_2px_0px_#000]'
    : 'text-[11px] px-3 py-1.5 border-2 shadow-[3px_3px_0px_#000]';

  return (
    <span className={`font-pixel uppercase inline-flex items-center gap-1.5 select-none font-bold ${conf.bg} ${sizeClasses} ${className}`}>
      {conf.icon && <span className="text-[12px] leading-none">{conf.icon}</span>}
      <span>{text || conf.defaultText}</span>
    </span>
  );
}
