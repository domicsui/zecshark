import React from 'react';

export default function Footer({ setActivePage }) {
  return (
    <footer className="bg-[#0A0B0E] border-t-4 border-black text-zinc-400 py-12 px-4 sm:px-6 lg:px-8 mt-20">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 border-2 border-black bg-[#FF8800] overflow-hidden">
                <img src="/assets/zeckshark-logo.jpg" alt="ZECKSHARK Logo" className="w-full h-full object-cover" />
              </div>
              <span className="font-pixel text-lg text-[#FFC107]">ZECKSHARK</span>
            </div>
            <p className="text-sm text-zinc-400 max-w-md">
              2222 unique pixel-art shark NFTs entering the Zcash ecosystem.
              Forged in deep waters, verified on-chain.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <span className="inline-block px-2.5 py-1 bg-[#181924] border border-black font-pixel text-[10px] text-[#FF8800]">
                CHAIN: ZCASH
              </span>
              <span className="inline-block px-2.5 py-1 bg-[#181924] border border-black font-pixel text-[10px] text-[#FFC107]">
                SUPPLY: 2,222
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div>
            <h4 className="font-pixel text-xs text-[#FFC107] uppercase mb-4 tracking-wider">Navigation</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button onClick={() => { setActivePage('home'); window.scrollTo(0, 0); }} className="hover:text-[#FF8800] transition-colors">
                  Home
                </button>
              </li>
              <li>
                <button onClick={() => { setActivePage('waitlist'); window.scrollTo(0, 0); }} className="hover:text-[#FF8800] transition-colors">
                  Join Waitlist
                </button>
              </li>
              <li>
                <button onClick={() => { setActivePage('checker'); window.scrollTo(0, 0); }} className="hover:text-[#FF8800] transition-colors">
                  Wallet Checker
                </button>
              </li>
              <li>
                <button onClick={() => { setActivePage('roadmap'); window.scrollTo(0, 0); }} className="hover:text-[#FF8800] transition-colors">
                  Roadmap
                </button>
              </li>
              <li>
                <button onClick={() => { setActivePage('faq'); window.scrollTo(0, 0); }} className="hover:text-[#FF8800] transition-colors">
                  FAQ
                </button>
              </li>
            </ul>
          </div>

          {/* Social / Ecosystem */}
          <div>
            <h4 className="font-pixel text-xs text-[#FFC107] uppercase mb-4 tracking-wider">Official Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="https://x.com/zecshark" target="_blank" rel="noopener noreferrer" className="hover:text-[#FF8800] transition-colors flex items-center gap-1.5">
                  <span>Official X (@zecshark)</span>
                </a>
              </li>
              <li>
                <span className="text-zinc-500">Zcash Network Ecosystem</span>
              </li>
              <li>
                <span className="text-zinc-500">Contract Verification (Coming Soon)</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t-2 border-black/80 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
          <p>© 2026 ZECKSHARK. All rights reserved. 2222 Pixel Sharks.</p>
          <button
            onClick={() => { setActivePage('admin'); window.scrollTo(0, 0); }}
            title="Admin Access"
            className="font-pixel text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors focus:outline-none"
          >
            ARCADE EDITION v1.0.0
          </button>
        </div>
      </div>
    </footer>
  );
}
