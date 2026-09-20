import React from 'react';
import { playPixelClick } from '../utils/sound';

export default function PixelButton({
  children,
  onClick,
  variant = 'primary', // 'primary' | 'secondary' | 'dark' | 'danger' | 'ghost'
  size = 'md', // 'sm' | 'md' | 'lg'
  disabled = false,
  className = '',
  type = 'button',
  ...props
}) {
  const handleClick = (e) => {
    if (disabled) return;
    playPixelClick();
    if (onClick) onClick(e);
  };

  const baseStyles = "font-pixel uppercase tracking-wider transition-all duration-75 select-none inline-flex items-center justify-center border-4 border-black disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none";

  const sizeStyles = {
    sm: "text-[10px] px-3 py-2 shadow-[3px_3px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    md: "text-xs px-5 py-3 shadow-[4px_4px_0px_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
    lg: "text-sm px-7 py-4 shadow-[6px_6px_0px_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
  };

  const variantStyles = {
    primary: "bg-[#FF8800] text-black hover:bg-[#FFA726] border-black",
    secondary: "bg-[#FFC107] text-black hover:bg-[#FFD54F] border-black",
    dark: "bg-[#1C1D27] text-white hover:bg-[#282937] border-black",
    danger: "bg-[#EF4444] text-white hover:bg-[#F87171] border-black",
    success: "bg-[#10B981] text-black hover:bg-[#34D399] border-black",
    ghost: "bg-transparent text-[#FFC107] hover:bg-white/5 border-2 border-[#FFC107]/40 shadow-none"
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={handleClick}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
