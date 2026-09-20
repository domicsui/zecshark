import React, { useState } from 'react';
import PixelBadge from '../components/PixelBadge';
import { playPixelClick } from '../utils/sound';
import { ChevronDown, HelpCircle } from 'lucide-react';

export default function FaqPage() {
  const [openIdx, setOpenIdx] = useState(null);

  const faqs = [
    {
      q: 'What is ZECKSHARK?',
      a: 'ZECKSHARK is a premier Web3 pixel-art NFT project featuring 2222 unique sharks entering and expanding the Zcash ecosystem with on-chain utility and staking.'
    },
    {
      q: 'What is the 2222 Collection?',
      a: 'The 2222 Collection represents the fixed, immutable supply of Genesis ZECKSHARK NFTs. Once all 2222 are minted, no additional Genesis sharks will ever be created.'
    },
    {
      q: 'Which chain is ZECKSHARK built on?',
      a: 'ZECKSHARK is built natively for the Zcash ecosystem, prioritizing privacy, cryptographic resilience, and sustainable decentralized digital assets.'
    },
    {
      q: 'How does the waitlist work?',
      a: 'The waitlist utilizes a sequential quest system. You must complete and verify each of the 5 social quests in order (Connect X, Follow, Like/Repost, Quote, Comment). Once verified, the shielded wallet step unlocks for application submission.'
    },
    {
      q: 'How are X tasks verified?',
      a: 'All X tasks are verified securely through server-side verification endpoints on our backend engine. Frontend JavaScript cannot bypass verification, ensuring fair allocations.'
    },
    {
      q: 'What wallet should I enter?',
      a: 'You can enter your Zcash Shielded address (Sapling zs1... or Unified u1...), Zcash Transparent address (t1...), or EVM address (0x...). Never share or submit your private keys or seed phrases.'
    },
    {
      q: 'What does Eligible mean?',
      a: 'Being "Eligible" means your shielded or public wallet address has been verified, approved by administrators, and recorded into the official Whitelist database, granting guaranteed priority during collection minting.'
    },
    {
      q: 'What is NFT staking?',
      a: 'NFT staking allows ZECKSHARK holders to lock their sharks into smart contracts to earn ongoing rewards, access exclusive alpha channels, and unlock staker-only ecosystem benefits in Phase 04.'
    }
  ];

  const handleToggle = (idx) => {
    playPixelClick();
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      
      {/* Header */}
      <div className="text-center space-y-3">
        <PixelBadge status="READY" text="KNOWLEDGE BASE" />
        <h1 className="font-pixel text-2xl sm:text-4xl text-[#FF8800] uppercase text-pixel-glow">
          FREQUENTLY ASKED QUESTIONS
        </h1>
        <p className="text-zinc-400 text-sm max-w-xl mx-auto">
          Clear, concise answers regarding ZECKSHARK, the 2222 collection, the waitlist quest system, and ecosystem mechanics.
        </p>
      </div>

      {/* FAQs List */}
      <div className="space-y-4">
        {faqs.map((faq, idx) => {
          const isOpen = openIdx === idx;

          return (
            <div
              key={idx}
              className={`border-4 border-black transition-all ${
                isOpen ? 'bg-[#181926] shadow-[6px_6px_0px_#000]' : 'bg-[#12131D] shadow-[4px_4px_0px_#000]'
              }`}
            >
              <button
                type="button"
                onClick={() => handleToggle(idx)}
                className="w-full text-left p-5 sm:p-6 flex items-center justify-between gap-4 select-none focus:outline-none"
              >
                <div className="flex items-center gap-3">
                  <span className="font-pixel text-xs text-[#FF8800]">Q0{idx + 1}.</span>
                  <h3 className="font-pixel text-xs sm:text-sm text-white hover:text-[#FFC107] transition-colors">
                    {faq.q}
                  </h3>
                </div>
                <div className={`p-1.5 border-2 border-black bg-[#202130] text-[#FFC107] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                  <ChevronDown size={16} />
                </div>
              </button>

              {isOpen && (
                <div className="px-5 sm:px-6 pb-6 pt-1 border-t-2 border-black/80 text-xs sm:text-sm text-zinc-300 leading-relaxed animate-fade-in">
                  <div className="bg-[#12131B] p-4 border border-black text-zinc-300 font-sans">
                    {faq.a}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Still have questions */}
      <div className="border-4 border-black bg-[#141520] p-6 text-center space-y-3 shadow-[4px_4px_0px_#000]">
        <h4 className="font-pixel text-sm text-[#FFC107]">STILL HAVE QUESTIONS?</h4>
        <p className="text-xs text-zinc-400">
          Reach out to our official community channel on X (@zecshark) for assistance.
        </p>
        <div className="pt-2">
          <a
            href="https://x.com/zecshark"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-pixel text-xs px-4 py-2.5 bg-[#FF8800] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-[#FFA726] active:translate-x-[2px] active:translate-y-[2px]"
          >
            CONTACT ON X (@zecshark)
          </a>
        </div>
      </div>

    </div>
  );
}
