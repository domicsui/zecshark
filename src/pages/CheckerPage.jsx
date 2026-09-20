import React, { useState } from 'react';
import { fetchApi } from '../utils/api';
import { playQuestVerified, playErrorBeep, playPixelClick } from '../utils/sound';
import PixelButton from '../components/PixelButton';
import PixelCard from '../components/PixelCard';
import PixelBadge from '../components/PixelBadge';
import { ShieldCheck, XCircle, Search, AlertCircle, Sparkles, HelpCircle } from 'lucide-react';

export default function CheckerPage({ setActivePage }) {
  const [walletInput, setWalletInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkerEnabled, setCheckerEnabled] = useState(true);
  const [result, setResult] = useState(null); // { eligible: boolean, address: string, error?: string }

  // Load live checker feature toggle from backend
  React.useEffect(() => {
    fetchApi('/checker/status').then(res => {
      if (res.ok && res.data) {
        setCheckerEnabled(res.data.walletCheckerEnabled !== false);
      }
    }).catch(() => {});
  }, []);

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!walletInput.trim()) return;

    playPixelClick();
    setChecking(true);
    setResult(null);

    try {
      const res = await fetchApi('/checker/check', {
        method: 'POST',
        body: JSON.stringify({ walletAddress: walletInput.trim() })
      });

      if (res.ok && res.data) {
        if (res.data.eligible) {
          playQuestVerified();
        } else {
          playErrorBeep();
        }
        setResult({
          eligible: res.data.eligible,
          address: res.data.walletAddress || walletInput.trim()
        });
      } else {
        playErrorBeep();
        setResult({
          error: res.data?.error || 'Failed to check eligibility. Please try again.'
        });
      }
    } catch (err) {
      playErrorBeep();
      setResult({
        error: 'Network connection error while checking eligibility.'
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      
      {/* Header */}
      <div className="text-center space-y-3">
        <PixelBadge status="READY" text="WHITELIST RADAR" />
        <h1 className="font-pixel text-2xl sm:text-4xl text-[#FF8800] uppercase text-pixel-glow">
          WALLET CHECKER
        </h1>
        <p className="text-zinc-400 text-sm max-w-xl mx-auto">
          Verify whether your shielded wallet address is registered and eligible in the official ZECKSHARK Whitelist database.
        </p>
      </div>

      {/* Main Checker Box */}
      <div className="border-4 border-black bg-[#13141F] p-6 sm:p-10 shadow-[8px_8px_0px_#000]">
        {!checkerEnabled && (
          <div className="mb-6 bg-[#2B1717] border-4 border-black p-4 shadow-[4px_4px_0px_#000] text-red-200 text-xs space-y-1">
            <div className="font-pixel text-[11px] text-[#EF4444] flex items-center gap-2 uppercase">
              <AlertCircle size={16} />
              <span>WALLET CHECKER OFFLINE</span>
            </div>
            <p className="text-zinc-300">
              The Wallet Eligibility Checker is temporarily offline for maintenance by administrators. Please check back later.
            </p>
          </div>
        )}

        <form onSubmit={handleCheck} className="space-y-6">
          <div>
            <label className="font-pixel text-xs text-[#FFC107] block mb-2">
              ENTER SHIELDED WALLET ADDRESS:
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="u1... or zs1..."
                value={walletInput}
                onChange={(e) => setWalletInput(e.target.value)}
                disabled={checking || !checkerEnabled}
                className="w-full bg-black border-4 border-black px-4 py-3.5 text-white font-mono text-sm focus:outline-none focus:border-[#FF8800] shadow-[4px_4px_0px_#000]"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-500 mt-2 flex-wrap gap-2">
              <span>Supports Zcash Shielded (Unified u1... & Sapling zs1...) addresses.</span>
              <span className="text-zinc-400">Rate limited & verified server-side</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <PixelButton
              type="submit"
              variant="primary"
              size="lg"
              disabled={checking || !walletInput.trim() || !checkerEnabled}
              className="w-full sm:w-auto"
            >
              {checking ? 'SCANNING DATABASE...' : !checkerEnabled ? '[ CHECKER OFFLINE ]' : '[ CHECK ELIGIBILITY ]'}
            </PixelButton>

            {walletInput && (
              <button
                type="button"
                onClick={() => { setWalletInput(''); setResult(null); }}
                className="text-xs text-zinc-400 hover:text-white underline font-mono"
              >
                Clear input
              </button>
            )}
          </div>
        </form>

        {/* Loading Scanner State */}
        {checking && (
          <div className="mt-8 border-4 border-black bg-[#1A1B28] p-6 text-center space-y-3 animate-pulse">
            <div className="font-pixel text-sm text-[#FF8800]">
              QUERYING ON-CHAIN DATABASE...
            </div>
            <p className="text-xs text-zinc-400">Comparing cryptographic address against eligible registry</p>
          </div>
        )}

        {/* Result: ELIGIBLE or NOT ELIGIBLE */}
        {result && !checking && (
          <div className="mt-8 border-4 border-black p-6 sm:p-8 shadow-[6px_6px_0px_#000] animate-fade-in transition-all">
            {result.error ? (
              <div className="bg-[#2A1616] p-4 border-2 border-black space-y-2">
                <div className="flex items-center gap-2 text-[#EF4444] font-pixel text-xs">
                  <AlertCircle size={16} />
                  <span>ERROR</span>
                </div>
                <p className="text-zinc-300 text-xs">{result.error}</p>
              </div>
            ) : result.eligible ? (
              /* POSITIVE ELIGIBLE RESULT */
              <div className="bg-[#12231A] p-6 border-4 border-black space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b-2 border-black pb-3">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck size={28} className="text-[#10B981]" />
                    <span className="font-pixel text-lg sm:text-xl text-[#10B981]">
                      ✓ ELIGIBLE
                    </span>
                  </div>
                  <PixelBadge status="ELIGIBLE" />
                </div>

                <div className="space-y-1">
                  <span className="font-pixel text-[10px] text-zinc-400">CHECKED WALLET:</span>
                  <div className="font-mono text-xs sm:text-sm text-white break-all bg-black/40 p-2.5 border border-black">
                    {result.address}
                  </div>
                </div>

                <p className="text-sm text-zinc-200">
                  Congratulations! This wallet address is recorded in the official ZECKSHARK Whitelist database. You have secured allocation priority for the 2222 NFT drop.
                </p>
              </div>
            ) : (
              /* NEGATIVE NOT ELIGIBLE RESULT */
              <div className="bg-[#261717] p-6 border-4 border-black space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b-2 border-black pb-3">
                  <div className="flex items-center gap-2.5">
                    <XCircle size={28} className="text-[#EF4444]" />
                    <span className="font-pixel text-lg sm:text-xl text-[#EF4444]">
                      ✕ NOT ELIGIBLE
                    </span>
                  </div>
                  <PixelBadge status="NOT ELIGIBLE" />
                </div>

                <div className="space-y-1">
                  <span className="font-pixel text-[10px] text-zinc-400">CHECKED WALLET:</span>
                  <div className="font-mono text-xs sm:text-sm text-zinc-300 break-all bg-black/40 p-2.5 border border-black">
                    {result.address}
                  </div>
                </div>

                <p className="text-sm text-zinc-300">
                  This wallet was not found in the current eligible database. If you recently completed your waitlist application, please note that batches are reviewed and approved periodically by administrators.
                </p>

                <div className="pt-2">
                  <PixelButton
                    variant="primary"
                    size="sm"
                    onClick={() => { setActivePage('waitlist'); window.scrollTo(0, 0); }}
                  >
                    [ JOIN WAITLIST NOW ]
                  </PixelButton>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Info Card */}
      <PixelCard title="WHITELIST CRITERIA" badge={<PixelBadge status="READY" text="INFO" size="sm" />}>
        <div className="space-y-3 text-xs text-zinc-300">
          <p className="flex items-start gap-2">
            <span className="text-[#FF8800] font-pixel">01.</span>
            <span>Completed waitlist applications are reviewed and imported directly into this database.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-[#FF8800] font-pixel">02.</span>
            <span>Early community contributors and genesis partners receive automatic inclusion.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-[#FF8800] font-pixel">03.</span>
            <span>To safeguard user privacy, the complete wallet registry is maintained strictly server-side.</span>
          </p>
        </div>
      </PixelCard>

    </div>
  );
}
