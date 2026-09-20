import React, { useState } from 'react';
import { Volume2, VolumeX, Menu, X } from 'lucide-react';
import { toggleSound, isSoundEnabled, playPixelClick } from '../utils/sound';

export default function Navbar({ activePage, setActivePage }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());

  const navItems = [
    { id: 'home', label: 'HOME' },
    { id: 'waitlist', label: 'WAITLIST' },
    { id: 'checker', label: 'WALLET CHECKER' },
    { id: 'roadmap', label: 'ROADMAP' },
    { id: 'faq', label: 'FAQ' },
  ];

  const handleNavClick = (id) => {
    playPixelClick();
    setActivePage(id);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleSound = () => {
    const nextState = toggleSound();
    setSoundOn(nextState);
    if (nextState) playPixelClick();
  };

  return (
    <nav className="sticky top-0 z-50 bg-[#0C0D12]/95 backdrop-blur border-b-4 border-black shadow-[0_4px_0px_#000]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Brand */}
          <button
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-3 group text-left focus:outline-none"
          >
            <div className="w-12 h-12 border-2 border-black shadow-[3px_3px_0px_#000] overflow-hidden bg-[#FF8800] shrink-0 group-hover:-translate-y-0.5 transition-transform">
              <img
                src="/assets/zeckshark-logo.jpg"
                alt="ZECKSHARK Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-pixel text-base sm:text-lg text-[#FFC107] group-hover:text-[#FF8800] transition-colors tracking-wider">
                  ZECKSHARK
                </span>
                <span className="hidden sm:inline-block bg-[#FF8800] text-black text-[9px] font-pixel px-1.5 py-0.5 border border-black font-bold">
                  2222
                </span>
              </div>
              <span className="text-[11px] text-zinc-400 block tracking-wider uppercase font-semibold">
                Zcash Ecosystem
              </span>
            </div>
          </button>

          {/* Desktop Public Navigation (Strictly 5 items: HOME, WAITLIST, WALLET CHECKER, ROADMAP, FAQ) */}
          <div className="hidden md:flex items-center gap-1.5 lg:gap-2">
            {navItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`font-pixel text-[11px] lg:text-xs px-3.5 py-2.5 uppercase transition-all select-none border-2 border-black ${
                    isActive
                      ? 'bg-[#FF8800] text-black shadow-[3px_3px_0px_#000] translate-x-[-1px] translate-y-[-1px]'
                      : 'bg-[#151620] text-zinc-300 hover:text-white hover:bg-[#20212E] shadow-[2px_2px_0px_#000]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Right Controls: Official X Link, Sound Toggle & Mobile Menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="https://x.com/zecshark"
              target="_blank"
              rel="noopener noreferrer"
              title="Official X: @zecshark"
              className="p-2.5 bg-[#151620] border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#222433] text-[#FF8800] hover:text-[#FFC107] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-1.5"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span className="hidden sm:inline font-pixel text-[10px]">@zecshark</span>
            </a>

            <button
              onClick={handleToggleSound}
              title={soundOn ? 'Mute 8-Bit Audio' : 'Enable 8-Bit Audio'}
              className="p-2.5 bg-[#151620] border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#222433] text-[#FFC107] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} className="text-zinc-500" />}
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 bg-[#FF8800] text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t-4 border-black bg-[#0E0F16] px-4 pt-3 pb-6 space-y-2 shadow-[0_8px_0px_#000]">
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full text-left font-pixel text-xs p-3.5 uppercase border-2 border-black block transition-all ${
                  isActive
                    ? 'bg-[#FF8800] text-black shadow-[3px_3px_0px_#000]'
                    : 'bg-[#181924] text-zinc-300 hover:text-white shadow-[2px_2px_0px_#000]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}
