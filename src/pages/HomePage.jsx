import React from 'react';
import { useStats } from '../context/StatsContext';
import PixelButton from '../components/PixelButton';
import PixelCard from '../components/PixelCard';
import PixelBadge from '../components/PixelBadge';
import AnimatedBanner from '../components/AnimatedBanner';
import { Shield, Sparkles, Waves, ArrowRight, Zap, RefreshCw } from 'lucide-react';

export default function HomePage({ setActivePage }) {
  const { registeredUsers, loading, error, refreshStats } = useStats();

  return (
    <div className="space-y-24 pb-12 arcade-grid">
      
      {/* ===================================================
          1. HERO SECTION
         =================================================== */}
      <section className="relative pt-8 sm:pt-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Glow ambient background */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-3/4 h-80 bg-gradient-to-b from-[#FF8800]/20 to-transparent blur-3xl pointer-events-none -z-10" />

        <div className="text-center space-y-6">
          
          {/* Animated Interactive Retro Banner */}
          <AnimatedBanner />

          {/* Main Titles */}
          <div className="space-y-3 pt-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1B1C27] border-2 border-black font-pixel text-[10px] sm:text-xs text-[#FFC107] shadow-[2px_2px_0px_#000]">
              <Sparkles size={13} className="text-[#FF8800]" />
              <span>OFFICIAL ZCASH NFT COLLECTION</span>
            </div>

            <h1 className="font-pixel text-3xl sm:text-5xl lg:text-6xl text-[#FF8800] tracking-wider text-pixel-glow uppercase">
              ZECKSHARK
            </h1>

            <div className="space-y-1 max-w-2xl mx-auto">
              <p className="font-pixel text-base sm:text-xl lg:text-2xl text-[#FFC107] uppercase">
                2222 PIXEL SHARKS
              </p>
              <p className="font-pixel text-xs sm:text-sm text-zinc-300 uppercase tracking-wide">
                BUILT FOR THE ZCASH ECOSYSTEM
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <PixelButton
              variant="primary"
              size="lg"
              onClick={() => { setActivePage('waitlist'); window.scrollTo(0, 0); }}
              className="w-full sm:w-auto"
            >
              [ JOIN WAITLIST ]
            </PixelButton>

            <PixelButton
              variant="secondary"
              size="lg"
              onClick={() => { setActivePage('checker'); window.scrollTo(0, 0); }}
              className="w-full sm:w-auto"
            >
              [ WALLET CHECKER ]
            </PixelButton>
          </div>

          {/* ===================================================
              REAL REGISTERED USERS COUNTER (CRITICAL REAL DATA)
             =================================================== */}
          <div className="pt-6 max-w-md mx-auto">
            <div className="bg-[#141520] border-4 border-black p-5 shadow-[6px_6px_0px_#000] relative">
              <div className="flex items-center justify-between border-b-2 border-black/80 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#10B981]"></span>
                  </span>
                  <span className="font-pixel text-xs text-[#FFC107] uppercase tracking-wider">
                    REGISTERED USERS
                  </span>
                </div>
                <button
                  onClick={refreshStats}
                  title="Refresh real-time count"
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <RefreshCw size={13} />
                </button>
              </div>

              {/* State handling: Loading vs Error vs Real Count */}
              <div className="py-2">
                {loading ? (
                  <div className="space-y-1">
                    <div className="font-pixel text-lg sm:text-xl text-zinc-400 animate-pulse">
                      Loading...
                    </div>
                    <p className="text-[11px] text-zinc-500">Querying database transactions</p>
                  </div>
                ) : error ? (
                  <div className="space-y-1">
                    <div className="font-pixel text-sm sm:text-base text-[#EF4444]">
                      COUNT UNAVAILABLE
                    </div>
                    <p className="text-[11px] text-zinc-500">Backend database offline</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="font-pixel text-3xl sm:text-4xl text-[#FF8800] tracking-wider text-pixel-glow">
                      {registeredUsers.toLocaleString()}
                    </div>
                    <p className="text-[11px] text-zinc-400 flex items-center justify-center gap-1.5">
                      <span>✓ Verified database registration records</span>
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-2.5 border-t border-black/60 text-[10px] text-zinc-500 font-mono">
                LIVE REAL-TIME DATABASE SYNC
              </div>
            </div>
          </div>

        </div>
      </section>



      {/* ===================================================
          3. ROADMAP PREVIEW
         =================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#12131D] border-4 border-black p-6 sm:p-10 shadow-[8px_8px_0px_#000]">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 border-b-2 border-black pb-6">
            <div>
              <PixelBadge status="IN PROGRESS" text="PHASE ROADMAP" />
              <h2 className="font-pixel text-2xl sm:text-3xl text-[#FF8800] uppercase mt-2">
                ROADMAP PREVIEW
              </h2>
            </div>
            <PixelButton
              variant="secondary"
              size="md"
              onClick={() => { setActivePage('roadmap'); window.scrollTo(0, 0); }}
            >
              [ VIEW ROADMAP ]
            </PixelButton>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Phase 01 */}
            <div className="bg-[#181924] border-2 border-black p-4 shadow-[3px_3px_0px_#000] relative">
              <div className="text-xs font-pixel text-[#10B981] mb-1">PHASE 01</div>
              <h4 className="font-pixel text-sm text-white mb-2">THE AWAKENING</h4>
              <p className="text-xs text-zinc-400 mb-4">
                2222 unique ZECKSHARK NFTs, waitlist initiation & collection reveal.
              </p>
              <PixelBadge status="COMPLETED" size="sm" />
            </div>

            {/* Phase 02 */}
            <div className="bg-[#181924] border-2 border-black p-4 shadow-[3px_3px_0px_#000] relative">
              <div className="text-xs font-pixel text-[#FF8800] mb-1">PHASE 02</div>
              <h4 className="font-pixel text-sm text-white mb-2">ZCASH WATERS</h4>
              <p className="text-xs text-zinc-400 mb-4">
                Zcash ecosystem integration, wallet eligibility checker & smart contracts.
              </p>
              <PixelBadge status="IN PROGRESS" size="sm" />
            </div>

            {/* Phase 03 */}
            <div className="bg-[#181924] border-2 border-black p-4 shadow-[3px_3px_0px_#000] relative">
              <div className="text-xs font-pixel text-zinc-400 mb-1">PHASE 03</div>
              <h4 className="font-pixel text-sm text-white mb-2">THE SHARK PACK</h4>
              <p className="text-xs text-zinc-400 mb-4">
                Holder community benefits, exclusive access, events & merchandise.
              </p>
              <PixelBadge status="UPCOMING" size="sm" />
            </div>

            {/* Phase 04 */}
            <div className="bg-[#181924] border-2 border-black p-4 shadow-[3px_3px_0px_#000] relative">
              <div className="text-xs font-pixel text-zinc-400 mb-1">PHASE 04</div>
              <h4 className="font-pixel text-sm text-white mb-2">SHARK STAKING</h4>
              <p className="text-xs text-zinc-400 mb-4">
                NFT staking infrastructure, yield rewards & staker-only privilege pass.
              </p>
              <PixelBadge status="UPCOMING" size="sm" />
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}
