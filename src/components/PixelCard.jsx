import React from 'react';

export default function PixelCard({
  children,
  title,
  subtitle,
  badge,
  className = '',
  headerClassName = '',
  hoverEffect = false,
  glow = false
}) {
  return (
    <div
      className={`bg-[#14151E] border-4 border-black text-white relative transition-all duration-150 ${
        glow ? 'shadow-[4px_4px_0px_#000,0_0_20px_rgba(255,136,0,0.35)]' : 'shadow-[4px_4px_0px_#000]'
      } ${
        hoverEffect ? 'hover:-translate-y-1 hover:shadow-[6px_6px_0px_#000]' : ''
      } ${className}`}
    >
      {(title || badge) && (
        <div className={`border-b-4 border-black bg-[#1B1C27] px-4 py-3 flex items-center justify-between gap-2 flex-wrap ${headerClassName}`}>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 bg-[#FF8800] border-2 border-black"></span>
            <div>
              {title && <h3 className="font-pixel text-xs text-[#FFC107] uppercase tracking-wide">{title}</h3>}
              {subtitle && <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {badge && <div>{badge}</div>}
        </div>
      )}
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}
