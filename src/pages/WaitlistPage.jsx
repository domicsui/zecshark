import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';
import { useStats } from '../context/StatsContext';
import { playQuestVerified, playSuccessFanfare, playErrorBeep, playPixelClick } from '../utils/sound';
import PixelButton from '../components/PixelButton';
import PixelCard from '../components/PixelCard';
import PixelBadge from '../components/PixelBadge';
import confetti from '../utils/confetti';
import { 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Lock, 
  ShieldAlert, 
  Sparkles,
  Twitter,
  Wallet,
  RefreshCw,
  Info
} from 'lucide-react';

export default function WaitlistPage({ setActivePage }) {
  const { refreshStats } = useStats();

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [connectedX, setConnectedX] = useState(null);
  const [progress, setProgress] = useState({ completed: 0, total: 5, allSocialCompleted: false });
  const [application, setApplication] = useState(null);
  const [settings, setSettings] = useState({ waitlistEnabled: true, applicationsOpen: true, verificationMode: 'DEMO' });

  // Task interaction state
  const [xUsernameInput, setXUsernameInput] = useState('');
  const [walletInput, setWalletInput] = useState('');
  const [quoteTweetUrl, setQuoteTweetUrl] = useState('');
  const [verifyingTaskId, setVerifyingTaskId] = useState(null);
  const [submittingApp, setSubmittingApp] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: '' }
  const [testFailMode, setTestFailMode] = useState(false); // Testing toggle for "FAILED / TRY AGAIN" verification states

  // Load current waitlist state
  const loadTasks = async () => {
    try {
      setLoading(true);
      const res = await fetchApi('/waitlist/tasks');
      if (res.ok && res.data) {
        setTasks(res.data.tasks || []);
        setConnectedX(res.data.connectedX || null);
        setProgress(res.data.progress || { completed: 0, total: 5, allSocialCompleted: false });
        setApplication(res.data.application || null);
        if (res.data.settings) setSettings(res.data.settings);
        if (res.data.connectedX?.xUsername) {
          setXUsernameInput(res.data.connectedX.xUsername);
        }
      }
    } catch (err) {
      console.error('Error loading tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  // Step 1: Connect X Account
  const handleConnectX = async (e) => {
    e.preventDefault();
    if (!xUsernameInput.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter your X (Twitter) username.' });
      return;
    }

    setVerifyingTaskId(tasks[0]?.id || 1);
    setStatusMessage(null);

    try {
      const res = await fetchApi('/waitlist/connect-x', {
        method: 'POST',
        body: JSON.stringify({
          xUsername: xUsernameInput.trim(),
          forceFail: testFailMode
        })
      });

      if (res.ok && res.data.success) {
        playQuestVerified();
        setConnectedX(res.data.connectedX);
        setStatusMessage({ type: 'success', text: `✓ Connected as @${res.data.connectedX.xUsername}` });
        await loadTasks();
      } else {
        playErrorBeep();
        setStatusMessage({ type: 'error', text: res.data.error || 'Failed to connect X account.' });
        await loadTasks();
      }
    } catch (err) {
      playErrorBeep();
      setStatusMessage({ type: 'error', text: 'Network error connecting X account.' });
    } finally {
      setVerifyingTaskId(null);
    }
  };

  // Steps 2-5: Verify Task
  const handleVerifyTask = async (task) => {
    setVerifyingTaskId(task.id);
    setStatusMessage(null);

    try {
      const res = await fetchApi('/waitlist/verify-task', {
        method: 'POST',
        body: JSON.stringify({
          taskId: task.id,
          proofUrl: task.verificationType === 'QUOTE' ? quoteTweetUrl : undefined,
          forceFail: testFailMode
        })
      });

      if (res.ok && res.data.success) {
        playQuestVerified();
        setStatusMessage({ type: 'success', text: `✓ Verified ${task.name}!` });
        await loadTasks();
      } else {
        playErrorBeep();
        setStatusMessage({ type: 'error', text: res.data.error || `Verification failed for ${task.name}. Try again.` });
        await loadTasks();
      }
    } catch (err) {
      playErrorBeep();
      setStatusMessage({ type: 'error', text: 'Network error verifying task.' });
    } finally {
      setVerifyingTaskId(null);
    }
  };

  // Step 6 & 7: Submit Wallet & Final Application
  const handleSubmitApplication = async (e) => {
    e.preventDefault();
    if (!walletInput.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter your Zcash shielded or public wallet address.' });
      return;
    }

    setSubmittingApp(true);
    setStatusMessage(null);

    try {
      const res = await fetchApi('/waitlist/submit', {
        method: 'POST',
        body: JSON.stringify({ walletAddress: walletInput.trim() })
      });

      if (res.ok && res.data.success) {
        playSuccessFanfare();
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        setApplication(res.data.application);
        refreshStats();
        setStatusMessage({
          type: 'success',
          text: res.data.alreadyRegistered 
            ? 'Application record retrieved.' 
            : '✓ APPLICATION COMPLETED! Welcome to ZECKSHARK.'
        });
      } else {
        playErrorBeep();
        setStatusMessage({ type: 'error', text: res.data.error || 'Failed to submit application.' });
      }
    } catch (err) {
      playErrorBeep();
      setStatusMessage({ type: 'error', text: 'Network error submitting application.' });
    } finally {
      setSubmittingApp(false);
    }
  };

  // 1-Click Auto-Verify all 5 quests (Fast Test Mode)
  const handleAutoVerifyAll = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetchApi('/waitlist/auto-verify-all', { method: 'POST' });
      if (res.ok && res.data.success) {
        playQuestVerified();
        setStatusMessage({
          type: 'success',
          text: '⚡ All 5 social quests successfully auto-verified! Wallet submission is now unlocked.'
        });
        await loadTasks();
      } else {
        playErrorBeep();
        setStatusMessage({ type: 'error', text: res.data?.error || 'Failed to auto-verify quests.' });
      }
    } catch (err) {
      playErrorBeep();
      setStatusMessage({ type: 'error', text: 'Network error while auto-verifying.' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="font-pixel text-lg text-[#FF8800] animate-pulse">
          INITIALIZING QUEST ENGINE...
        </div>
        <p className="text-zinc-500 text-xs mt-2">Loading sequential task matrix</p>
      </div>
    );
  }

  // If waitlist is disabled by admin
  if (!settings.waitlistEnabled) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <PixelCard title="WAITLIST PAUSED" badge={<PixelBadge status="FAILED" text="OFFLINE" />}>
          <div className="text-center py-8 space-y-4">
            <AlertTriangle size={48} className="mx-auto text-[#FFC107]" />
            <h2 className="font-pixel text-xl text-white">THE WAITLIST IS CURRENTLY CLOSED</h2>
            <p className="text-zinc-400 text-sm max-w-md mx-auto">
              Administrators have temporarily paused new registrations. Follow our official X account for announcements on the next initiation wave.
            </p>
            <div className="pt-4">
              <PixelButton variant="primary" onClick={() => setActivePage('home')}>
                RETURN HOME
              </PixelButton>
            </div>
          </div>
        </PixelCard>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      
      {/* Page Header */}
      <div className="text-center space-y-3">
        <PixelBadge status="IN PROGRESS" text="INITIATION PROTOCOL" />
        <h1 className="font-pixel text-2xl sm:text-4xl text-[#FF8800] uppercase text-pixel-glow">
          ZECKSHARK WAITLIST
        </h1>
        <p className="text-zinc-400 text-sm max-w-xl mx-auto">
          Complete the 5 sequential social quests to unlock your shielded wallet submission. All tasks are strictly verified on the backend.
        </p>

        {/* Demo Mode Notice & Failure Testing Switch */}
        {settings.verificationMode === 'DEMO' && (
          <div className="inline-flex items-center gap-3 px-3 py-1.5 bg-[#1B1C27] border-2 border-black text-[11px] text-[#FFC107] shadow-[2px_2px_0px_#000]">
            <span className="font-pixel text-[9px] bg-[#FF8800] text-black px-1.5 py-0.5 font-bold">
              DEMO ENGINE
            </span>
            <span>Simulated Server-Side Verification Active</span>
            <label className="flex items-center gap-1.5 cursor-pointer ml-2 text-zinc-400 hover:text-white border-l border-zinc-700 pl-3">
              <input
                type="checkbox"
                checked={testFailMode}
                onChange={(e) => setTestFailMode(e.target.checked)}
                className="accent-[#FF8800] cursor-pointer"
              />
              <span className="text-[10px]">Test Fail / Retry</span>
            </label>
          </div>
        )}
      </div>

      {/* Global Status Banner */}
      {statusMessage && (
        <div
          className={`p-4 border-4 border-black font-pixel text-xs shadow-[4px_4px_0px_#000] flex items-center justify-between gap-3 ${
            statusMessage.type === 'success'
              ? 'bg-[#10B981] text-black'
              : 'bg-[#EF4444] text-white'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="border-2 border-black px-2 py-0.5 text-[10px] font-bold bg-black/20 hover:bg-black/40"
          >
            ✕
          </button>
        </div>
      )}

      {/* ===================================================
          FINAL APPLICATION CONFIRMATION (IF ALREADY SUBMITTED)
         =================================================== */}
      {application ? (
        <div className="border-4 border-black bg-[#12131D] p-6 sm:p-8 shadow-[8px_8px_0px_#000] space-y-6">
          <div className="flex items-center justify-between border-b-2 border-black pb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={24} className="text-[#10B981]" />
              <h2 className="font-pixel text-lg sm:text-xl text-[#FFC107]">
                APPLICATION COMPLETED ✓
              </h2>
            </div>
            <PixelBadge status="COMPLETED" text={application.status || 'PENDING'} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#181924] p-4 border-2 border-black">
              <span className="font-pixel text-[10px] text-zinc-400 block mb-1">APPLICATION ID</span>
              <span className="font-pixel text-base text-[#FF8800]">
                {application.applicationCode}
              </span>
            </div>

            <div className="bg-[#181924] p-4 border-2 border-black">
              <span className="font-pixel text-[10px] text-zinc-400 block mb-1">STATUS</span>
              <span className="font-pixel text-base text-[#10B981]">
                {application.status || 'PENDING'}
              </span>
            </div>

            <div className="bg-[#181924] p-4 border-2 border-black sm:col-span-2">
              <span className="font-pixel text-[10px] text-zinc-400 block mb-1">SHIELDED / PUBLIC WALLET</span>
              <span className="font-mono text-xs sm:text-sm text-zinc-200 break-all">
                {application.walletAddress}
              </span>
            </div>

            {application.xUsername && (
              <div className="bg-[#181924] p-4 border-2 border-black sm:col-span-2">
                <span className="font-pixel text-[10px] text-zinc-400 block mb-1">VERIFIED X ACCOUNT</span>
                <span className="font-pixel text-xs text-[#FFC107]">
                  @{application.xUsername}
                </span>
              </div>
            )}
          </div>

          <div className="bg-[#151622] p-4 border-2 border-black text-xs text-zinc-400 space-y-2">
            <p className="flex items-center gap-2 text-white font-semibold">
              <Sparkles size={14} className="text-[#FF8800]" />
              Your waitlist registration is securely locked in the database.
            </p>
            <p>
              When the review period concludes, eligible wallets will be moved to the Eligible Wallets Database. You can check your status anytime on the Wallet Checker page.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 pt-2">
            <PixelButton variant="primary" onClick={() => setActivePage('checker')}>
              [ WALLET CHECKER ]
            </PixelButton>
            <PixelButton variant="dark" onClick={() => setActivePage('home')}>
              [ RETURN HOME ]
            </PixelButton>
          </div>
        </div>
      ) : (
        <>
          {/* Progress Tracker (0 / 5 to 5 / 5) */}
          <div className="bg-[#13141F] border-4 border-black p-4 sm:p-5 shadow-[6px_6px_0px_#000]">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-pixel text-xs text-white">QUEST PROGRESS:</span>
                <span className="font-pixel text-sm text-[#FF8800]">
                  {progress.completed} / {progress.total}
                </span>
              </div>
              <span className="text-xs text-zinc-400 font-pixel text-[10px]">
                {progress.allSocialCompleted ? '✓ 5/5 SOCIAL TASKS COMPLETE' : 'SEQUENTIAL LOCK ACTIVE'}
              </span>
            </div>

            {/* Pixel Segments Progress Bar */}
            <div className="grid grid-cols-5 gap-2 h-4">
              {[0, 1, 2, 3, 4].map((stepIdx) => {
                const isDone = stepIdx < progress.completed;
                return (
                  <div
                    key={stepIdx}
                    className={`border-2 border-black transition-all ${
                      isDone ? 'bg-[#FF8800]' : 'bg-zinc-800'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* ===================================================
              SEQUENTIAL TASKS LIST
             =================================================== */}
          <div className="space-y-4">
            {tasks.map((task, idx) => {
              const isFirst = idx === 0;
              const isCurrentVerifying = verifyingTaskId === task.id;
              const isLocked = task.state === 'LOCKED';
              const isVerified = task.state === 'VERIFIED';
              const isFailed = task.state === 'FAILED';
              const isReady = task.state === 'READY';

              return (
                <div
                  key={task.id}
                  className={`border-4 border-black p-4 sm:p-5 transition-all ${
                    isVerified
                      ? 'bg-[#121815] shadow-[3px_3px_0px_#000]'
                      : isReady
                      ? 'bg-[#161724] shadow-[6px_6px_0px_#000] border-[#FF8800]/60'
                      : 'bg-[#101117] opacity-60 shadow-[2px_2px_0px_#000]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black/80 pb-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="font-pixel text-[11px] text-[#FF8800] bg-black/40 px-2 py-1 border border-black">
                        TASK 0{idx + 1}
                      </span>
                      <h3 className="font-pixel text-xs sm:text-sm text-white">
                        {task.name}
                      </h3>
                    </div>

                    <div>
                      {isCurrentVerifying ? (
                        <PixelBadge status="VERIFYING" />
                      ) : (
                        <PixelBadge status={task.state} />
                      )}
                    </div>
                  </div>

                  <p className="text-zinc-400 text-xs mb-4">
                    {task.description}
                  </p>

                  {/* Task Action Form / Buttons */}
                  <div>
                    {/* TASK 01: CONNECT X */}
                    {isFirst && (
                      <div className="space-y-3">
                        {connectedX ? (
                          <div className="bg-[#1A231F] border-2 border-black p-3 text-xs flex items-center justify-between">
                            <span className="text-[#10B981] font-pixel text-[10px]">
                              ✓ CONNECTED: @{connectedX.xUsername}
                            </span>
                            <span className="text-zinc-500 text-[10px]">ID: {connectedX.xId}</span>
                          </div>
                        ) : (
                          <form onSubmit={handleConnectX} className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-pixel text-xs">@</span>
                              <input
                                type="text"
                                placeholder="your_x_handle"
                                value={xUsernameInput}
                                onChange={(e) => setXUsernameInput(e.target.value)}
                                disabled={isCurrentVerifying}
                                className="w-full bg-black border-2 border-black pl-8 pr-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-[#FF8800]"
                              />
                            </div>
                            <PixelButton
                              type="submit"
                              variant="primary"
                              size="sm"
                              disabled={isCurrentVerifying || !xUsernameInput.trim()}
                            >
                              {isCurrentVerifying ? 'CONNECTING...' : '[ CONNECT X ]'}
                            </PixelButton>
                          </form>
                        )}
                      </div>
                    )}

                    {/* TASKS 02 - 05: Social Actions & Verification */}
                    {!isFirst && (
                      <div className="space-y-3">
                        {/* Quote tweet URL input for Task 04 */}
                        {task.verificationType === 'QUOTE' && !isVerified && (
                          <div className="mb-2">
                            <input
                              type="text"
                              placeholder="https://x.com/your_username/status/..."
                              value={quoteTweetUrl}
                              onChange={(e) => setQuoteTweetUrl(e.target.value)}
                              disabled={isLocked || isCurrentVerifying}
                              className="w-full bg-black border-2 border-black px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#FF8800]"
                            />
                            <span className="text-[10px] text-zinc-500 mt-1 block">
                              Paste your quote tweet URL for verification
                            </span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Action Button: Opens official link on X */}
                          {task.xUrl && (
                            <a
                              href={task.xUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 font-pixel text-[10px] px-3 py-2 bg-[#1C1D29] border-2 border-black text-[#FFC107] hover:bg-[#252737] shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                            >
                              <span>OPEN ON X</span>
                              <ExternalLink size={12} />
                            </a>
                          )}

                          {/* Verification Button */}
                          {!isVerified && (
                            <PixelButton
                              variant={isFailed ? 'secondary' : 'primary'}
                              size="sm"
                              disabled={isLocked || isCurrentVerifying}
                              onClick={() => handleVerifyTask(task)}
                            >
                              {isCurrentVerifying
                                ? 'VERIFYING...'
                                : isFailed
                                ? '↻ TRY AGAIN'
                                : '[ VERIFY ]'}
                            </PixelButton>
                          )}

                          {isVerified && (
                            <span className="text-xs font-pixel text-[#10B981] flex items-center gap-1">
                              ✓ VERIFIED ON SERVER
                            </span>
                          )}

                          {isLocked && (
                            <span className="text-[10px] font-pixel text-zinc-500 flex items-center gap-1">
                              <Lock size={11} /> LOCKED UNTIL TASK 0{idx} IS VERIFIED
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ===================================================
              STEP 06 & 07: WALLET STEP (ALWAYS VISIBLE WITH CLEAR STATE)
             =================================================== */}
          <div className="border-4 border-black bg-[#161726] p-6 sm:p-8 shadow-[8px_8px_0px_#000] space-y-6 animate-fade-in">
            
            <div className="flex items-center justify-between border-b-2 border-black pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Wallet size={24} className="text-[#FF8800]" />
                <h3 className="font-pixel text-base sm:text-lg text-[#FFC107] uppercase">
                  STEP 06: ENTER ZCASH SHIELDED WALLET (u1... / zs1...)
                </h3>
              </div>
              {progress.allSocialCompleted ? (
                <PixelBadge status="READY" text="UNLOCKED" />
              ) : (
                <PixelBadge status="LOCKED" text={`LOCKED (${progress.completed}/5 QUESTS)`} />
              )}
            </div>

            {/* CRITICAL SECURITY WARNING */}
            <div className="bg-[#2A1717] border-4 border-black p-4 shadow-[4px_4px_0px_#000] text-red-200 text-xs space-y-1">
              <div className="font-pixel text-[11px] text-[#EF4444] flex items-center gap-2 uppercase">
                <ShieldAlert size={16} />
                <span>CRITICAL SECURITY WARNING</span>
              </div>
              <p className="font-semibold text-white">
                Only enter your Zcash Shielded address (Unified u1... or Sapling zs1...).
              </p>
              <p className="text-zinc-300">
                Never enter your seed phrase or spending/private key. ZECKSHARK admins will never ask for your recovery phrase or credentials.
              </p>
            </div>

            {/* If tasks incomplete: show guidance and 1-click auto-verify button */}
            {!progress.allSocialCompleted && (
              <div className="bg-[#1C1D2B] border-2 border-black p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <span className="font-pixel text-[11px] text-[#FFC107] flex items-center gap-1.5">
                    <Lock size={13} />
                    QUEST PREREQUISITE: {progress.completed}/5 VERIFIED
                  </span>
                  <p className="text-zinc-400">
                    Verify all 5 social quests above to unlock final application submission, or click below to auto-verify:
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAutoVerifyAll}
                  className="font-pixel text-[10px] px-3.5 py-2 bg-[#FF8800] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#FFA726] active:translate-x-[1px] active:translate-y-[1px] whitespace-nowrap"
                >
                  ⚡ AUTO-VERIFY ALL 5 QUESTS
                </button>
              </div>
            )}

            {/* Wallet Input Form */}
            <form onSubmit={handleSubmitApplication} className="space-y-4">
              <div>
                <label className="font-pixel text-xs text-white block mb-2">
                  ZCASH SHIELDED WALLET ADDRESS (u1... or zs1...):
                </label>
                <input
                  type="text"
                  placeholder="Enter Zcash Shielded address (Unified u1... or Sapling zs1...)"
                  value={walletInput}
                  onChange={(e) => setWalletInput(e.target.value)}
                  disabled={submittingApp}
                  className="w-full bg-black border-4 border-black px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[#FF8800] shadow-[3px_3px_0px_#000]"
                />
                <span className="text-[11px] text-zinc-400 mt-1.5 block">
                  Accepted formats: <strong>Zcash Unified Address (u1...)</strong> & <strong>Sapling Shielded (zs1...)</strong>. Transparent addresses (t1...) are not shielded.
                </span>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <PixelButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={submittingApp || !walletInput.trim() || !progress.allSocialCompleted}
                  className="w-full sm:w-auto"
                >
                  {submittingApp
                    ? 'SUBMITTING TO DATABASE...'
                    : !progress.allSocialCompleted
                    ? '[ COMPLETE QUESTS TO SUBMIT ]'
                    : '[ SUBMIT APPLICATION ]'}
                </PixelButton>

                {!progress.allSocialCompleted && (
                  <span className="text-xs font-pixel text-zinc-500">
                    Complete 5/5 tasks above to enable submission
                  </span>
                )}
              </div>
            </form>
          </div>
        </>
      )}

    </div>
  );
}
