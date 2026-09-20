import React from 'react';
import PixelBadge from '../components/PixelBadge';
import PixelButton from '../components/PixelButton';
import { Compass, CheckCircle2, Waves, Anchor, Coins } from 'lucide-react';

export default function RoadmapPage({ setActivePage }) {
  const phases = [
    {
      phase: 'PHASE 01',
      title: 'THE AWAKENING',
      tagline: '2222 SHARKS',
      status: 'COMPLETED',
      icon: <CheckCircle2 className="text-[#10B981]" size={20} />,
      badgeColor: 'COMPLETED',
      points: [
        '2222 unique pixel-art ZECKSHARK NFTs minted and cataloged',
        'Official community initiation & sequential waitlist quest engine',
        'Official collection reveal and trait metadata distribution'
      ]
    },
    {
      phase: 'PHASE 02',
      title: 'ZCASH WATERS',
      tagline: 'BUILT ON ZCASH',
      status: 'IN PROGRESS',
      icon: <Waves className="text-[#FF8800]" size={20} />,
      badgeColor: 'IN PROGRESS',
      points: [
        '2222 Collection deployment on the Zcash ecosystem',
        'Zcash network integration and cryptographic validation',
        'Live public Wallet Checker and whitelist verification pipeline'
      ]
    },
    {
      phase: 'PHASE 03',
      title: 'THE SHARK PACK',
      tagline: 'HOLD • CONNECT',
      status: 'UPCOMING',
      icon: <Anchor className="text-zinc-400" size={20} />,
      badgeColor: 'UPCOMING',
      points: [
        'ZECKSHARK verified holder community and alpha channels',
        'Exclusive holder utility perks and ecosystem governance access',
        'Private shark events, digital drops & merchandise'
      ]
    },
    {
      phase: 'PHASE 04',
      title: 'SHARK STAKING',
      tagline: 'STAKE • EARN',
      status: 'UPCOMING',
      icon: <Coins className="text-zinc-400" size={20} />,
      badgeColor: 'UPCOMING',
      points: [
        'Decentralized NFT staking smart contract infrastructure',
        'Ecosystem yield and staker rewards pool',
        'Staker-only tiers, booster multipliers & Genesis pass upgrades'
      ]
    }
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      
      {/* Page Title */}
      <div className="text-center space-y-3">
        <PixelBadge status="IN PROGRESS" text="EXPEDITION TIMELINE" />
        <h1 className="font-pixel text-2xl sm:text-4xl text-[#FF8800] uppercase text-pixel-glow">
          ROADMAP
        </h1>
        <p className="text-zinc-400 text-sm max-w-xl mx-auto">
          The strategic four-phase journey of 2222 ZECKSHARKS navigating from initiation to deep-water staking on Zcash.
        </p>
      </div>

      {/* Subtle Artwork Banner Feature */}
      <div className="border-4 border-black bg-[#13141F] p-2 shadow-[6px_6px_0px_#000] overflow-hidden">
        <img
          src="/assets/zeckshark-banner.png"
          alt="Roadmap Artwork"
          className="w-full h-36 sm:h-48 object-cover object-center filter contrast-110"
        />
      </div>

      {/* 4 Phases Timeline Grid */}
      <div className="space-y-6">
        {phases.map((item, idx) => {
          const isCompleted = item.status === 'COMPLETED';
          const isInProgress = item.status === 'IN PROGRESS';

          return (
            <div
              key={item.phase}
              className={`border-4 border-black p-6 sm:p-8 transition-all ${
                isCompleted
                  ? 'bg-[#111914] shadow-[4px_4px_0px_#000]'
                  : isInProgress
                  ? 'bg-[#161726] shadow-[8px_8px_0px_#000] border-[#FF8800]'
                  : 'bg-[#12131C] shadow-[4px_4px_0px_#000]'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black/80 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 border-2 border-black bg-black flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-pixel text-xs text-[#FF8800]">{item.phase}</span>
                      <span className="text-zinc-500">—</span>
                      <span className="font-pixel text-xs text-zinc-400">{item.tagline}</span>
                    </div>
                    <h2 className="font-pixel text-base sm:text-xl text-white mt-1">
                      {item.title}
                    </h2>
                  </div>
                </div>

                <div>
                  <PixelBadge status={item.status} />
                </div>
              </div>

              {/* Milestones */}
              <ul className="space-y-3">
                {item.points.map((pt, pIdx) => (
                  <li key={pIdx} className="flex items-start gap-3 text-xs sm:text-sm text-zinc-300">
                    <span className="font-pixel text-[10px] text-[#FFC107] mt-0.5">▶</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Bottom Action */}
      <div className="border-4 border-black bg-[#161724] p-8 text-center space-y-4 shadow-[6px_6px_0px_#000]">
        <h3 className="font-pixel text-base sm:text-lg text-[#FFC107]">
          BE PART OF THE EXPEDITION
        </h3>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto">
          Phase 02 is currently unfolding. Secure your whitelist allocation before the 2222 genesis collection closes.
        </p>
        <div className="pt-2">
          <PixelButton variant="primary" size="md" onClick={() => setActivePage('waitlist')}>
            [ JOIN THE WAITLIST ]
          </PixelButton>
        </div>
      </div>

    </div>
  );
}
