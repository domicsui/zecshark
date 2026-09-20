import React, { useState, useEffect, useCallback } from 'react';
import { fetchApi, getAdminToken, setAdminToken } from '../utils/api';
import { useStats } from '../context/StatsContext';
import { playPixelClick, playQuestVerified, playErrorBeep } from '../utils/sound';
import PixelButton from '../components/PixelButton';
import PixelCard from '../components/PixelCard';
import PixelBadge from '../components/PixelBadge';
import {
  Lock,
  LogOut,
  Users,
  CheckCircle,
  Clock,
  Shield,
  Plus,
  Edit2,
  Archive,
  ArrowUp,
  ArrowDown,
  Upload,
  Download,
  Search,
  Settings,
  ListOrdered,
  FileText,
  Activity,
  Check,
  AlertTriangle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

export default function AdminPage() {
  const { refreshStats } = useStats();

  // Auth State
  const [token, setToken] = useState(getAdminToken());
  const [adminUser, setAdminUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: 'zecshark', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Active Admin Tab
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'tasks' | 'applications' | 'wallets' | 'settings' | 'audit'

  // Data states
  const [metrics, setMetrics] = useState(null);
  const [globalSettings, setGlobalSettings] = useState({});
  const [tasks, setTasks] = useState([]);
  const [applications, setApplications] = useState([]);
  const [appsSearch, setAppsSearch] = useState('');
  const [appsStatusFilter, setAppsStatusFilter] = useState('ALL');
  const [wallets, setWallets] = useState([]);
  const [walletsSearch, setWalletsSearch] = useState('');
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error' | 'warning', text: '' }
  const [supabaseStatus, setSupabaseStatus] = useState(null);
  const [savingSetting, setSavingSetting] = useState(null); // Tracks key currently being updated
  const [buttonStates, setButtonStates] = useState({
    waitlist_enabled: 'idle',
    applications_open: 'idle',
    wallet_checker_enabled: 'idle'
  });
  const [savingGeneralSettings, setSavingGeneralSettings] = useState(false);

  // Modals & Form states
  const [taskModal, setTaskModal] = useState(null); // null | { mode: 'create' | 'edit', task: {} }
  const [appDetailModal, setAppDetailModal] = useState(null);
  const [addWalletInput, setAddWalletInput] = useState({ address: '', notes: '' });
  const [csvUploadText, setCsvUploadText] = useState('');
  const [csvResult, setCsvResult] = useState(null);

  // ==========================================
  // AUTHENTICATION
  // ==========================================
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const res = await fetchApi('/admin/login', {
        method: 'POST',
        body: JSON.stringify(loginForm)
      });

      if (res.ok && res.data.token) {
        playQuestVerified();
        setAdminToken(res.data.token);
        setToken(res.data.token);
        setAdminUser(res.data.admin);
      } else {
        playErrorBeep();
        setLoginError(res.data.error || 'Authentication failed. Incorrect credentials.');
      }
    } catch (err) {
      playErrorBeep();
      setLoginError('Network error during login.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    playPixelClick();
    await fetchApi('/admin/logout', { method: 'POST' }).catch(() => {});
    setAdminToken('');
    setToken('');
    setAdminUser(null);
  };

  // Verify session on mount
  useEffect(() => {
    if (token) {
      fetchApi('/admin/me').then(res => {
        if (res.ok && res.data.admin) {
          setAdminUser(res.data.admin);
        } else {
          setAdminToken('');
          setToken('');
        }
      }).catch(() => {
        setAdminToken('');
        setToken('');
      });
    }
  }, [token]);

  // Load Admin Data
  const loadAdminData = useCallback(async () => {
    if (!token) return;
    setLoadingData(true);

    try {
      // 1. Metrics & Settings from Supabase
      const metricsRes = await fetchApi('/admin/metrics');
      if (metricsRes.ok && metricsRes.data) {
        setMetrics(metricsRes.data.metrics);
        setGlobalSettings(metricsRes.data.settings || {});
        if (metricsRes.data.supabaseStatus) {
          setSupabaseStatus(metricsRes.data.supabaseStatus);
        }
      }

      // 2. Tasks
      const tasksRes = await fetchApi('/admin/tasks');
      if (tasksRes.ok && tasksRes.data) {
        setTasks(tasksRes.data.tasks || []);
      }

      // 3. Applications
      const appsRes = await fetchApi(`/admin/applications?search=${encodeURIComponent(appsSearch)}&status=${appsStatusFilter}`);
      if (appsRes.ok && appsRes.data) {
        setApplications(appsRes.data.applications || []);
      }

      // 4. Wallets
      const walletsRes = await fetchApi(`/admin/wallets?search=${encodeURIComponent(walletsSearch)}`);
      if (walletsRes.ok && walletsRes.data) {
        setWallets(walletsRes.data.wallets || []);
      }

      // 5. Audit Logs
      const auditRes = await fetchApi('/admin/audit-logs');
      if (auditRes.ok && auditRes.data) {
        setAuditLogs(auditRes.data.logs || []);
      }
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoadingData(false);
    }
  }, [token, appsSearch, appsStatusFilter, walletsSearch]);

  useEffect(() => {
    if (!token) return;

    loadAdminData();

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        loadAdminData();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    // Periodic auto-refresh every 20s while tab is active
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadAdminData();
      }
    }, 20000);

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      clearInterval(interval);
    };
  }, [token, loadAdminData]);

  const showNotify = (type, text) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  // Quick Global Switch Toggle (Connected to Supabase Source of Truth)
  const handleToggleSetting = async (key, currentValue) => {
    // If button is currently saving or confirming, prevent re-entry
    if (buttonStates[key] === 'saving' || buttonStates[key] === 'success') return;
    playPixelClick();

    // 1. Capture exact previous boolean state for reliable rollback
    const prevValue = currentValue !== 'false' && currentValue !== false;
    const nextValue = !prevValue;
    const nextValueStr = nextValue ? 'true' : 'false';

    // 2. Transition button state to 'saving'
    setButtonStates(prev => ({ ...prev, [key]: 'saving' }));
    setSavingSetting(key);

    // Optimistically update visual UI switch
    setGlobalSettings(prev => ({
      ...prev,
      [key]: nextValueStr,
      ...(key === 'applications_open' ? { applications_enabled: nextValueStr } : {})
    }));

    try {
      // 3. Send async update request to server
      const res = await fetchApi('/admin/settings', {
        method: 'POST',
        body: JSON.stringify({ [key]: nextValueStr })
      });

      if (res.ok && res.data?.success) {
        // 4. Success flow: Confirm database update
        playQuestVerified();
        setButtonStates(prev => ({ ...prev, [key]: 'success' }));

        const label = key.toUpperCase().replace(/_/g, ' ');
        const stateWord = (key === 'applications_open' || key === 'applications_enabled')
          ? (nextValue ? 'OPEN' : 'CLOSED')
          : (nextValue ? 'ON' : 'OFF');

        showNotify('success', `✓ ${label}: ${stateWord} (Confirmed in database)`);

        // 5. Re-fetch current settings from Supabase to confirm persisted value
        const verifyRes = await fetchApi('/admin/settings');
        if (verifyRes.ok && verifyRes.data?.settings) {
          setGlobalSettings(verifyRes.data.settings);
          if (verifyRes.data.supabaseStatus) {
            setSupabaseStatus(verifyRes.data.supabaseStatus);
          }
        }

        // Return button state to 'idle' after brief confirmation
        setTimeout(() => {
          setButtonStates(prev => ({ ...prev, [key]: 'idle' }));
        }, 1200);

      } else {
        // 6. Error flow: Stop saving, show error, and rollback visual state
        playErrorBeep();
        const errMsg = res.data?.error || `Failed to update ${key} in database.`;
        showNotify('error', errMsg);

        setButtonStates(prev => ({ ...prev, [key]: 'error' }));

        // Rollback visual switch to previous confirmed database value
        setGlobalSettings(prev => ({
          ...prev,
          [key]: prevValue ? 'true' : 'false',
          ...(key === 'applications_open' ? { applications_enabled: prevValue ? 'true' : 'false' } : {})
        }));

        // Re-sync authoritative data from server
        await loadAdminData();

        setTimeout(() => {
          setButtonStates(prev => ({ ...prev, [key]: 'idle' }));
        }, 2000);
      }
    } catch (err) {
      // 7. Network error flow
      playErrorBeep();
      showNotify('error', `Network error while updating ${key}: ${err.message}`);
      setButtonStates(prev => ({ ...prev, [key]: 'error' }));

      // Rollback visual switch
      setGlobalSettings(prev => ({
        ...prev,
        [key]: prevValue ? 'true' : 'false',
        ...(key === 'applications_open' ? { applications_enabled: prevValue ? 'true' : 'false' } : {})
      }));

      await loadAdminData();

      setTimeout(() => {
        setButtonStates(prev => ({ ...prev, [key]: 'idle' }));
      }, 2000);
    } finally {
      setSavingSetting(null);
    }
  };

  // Task Actions
  const handleToggleTask = async (taskId) => {
    playPixelClick();
    const res = await fetchApi(`/admin/tasks/${taskId}/toggle`, { method: 'PUT' });
    if (res.ok) {
      showNotify('success', 'Task state updated.');
      loadAdminData();
    }
  };

  const handleArchiveTask = async (taskId, taskName) => {
    if (!window.confirm(`Are you sure you want to archive "${taskName}"?\nNote: Tasks are NEVER hard-deleted; archival preserves historical verification records.`)) {
      return;
    }
    playPixelClick();
    const res = await fetchApi(`/admin/tasks/${taskId}`, { method: 'DELETE' });
    if (res.ok) {
      showNotify('success', 'Task archived successfully.');
      loadAdminData();
    }
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    const isEdit = taskModal.mode === 'edit';
    const endpoint = isEdit ? `/admin/tasks/${taskModal.task.id}` : '/admin/tasks';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetchApi(endpoint, {
      method,
      body: JSON.stringify(taskModal.task)
    });

    if (res.ok) {
      playQuestVerified();
      showNotify('success', isEdit ? 'Task updated.' : 'Task created.');
      setTaskModal(null);
      loadAdminData();
    } else {
      playErrorBeep();
      showNotify('error', res.data.error || 'Failed to save task.');
    }
  };

  // Reorder Task
  const handleMoveTask = async (index, direction) => {
    const newTasks = [...tasks];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= newTasks.length) return;

    playPixelClick();
    const temp = newTasks[index];
    newTasks[index] = newTasks[targetIdx];
    newTasks[targetIdx] = temp;

    const taskOrders = newTasks.map((t, idx) => ({ id: t.id, sort_order: idx + 1 }));

    const res = await fetchApi('/admin/tasks/reorder', {
      method: 'POST',
      body: JSON.stringify({ taskOrders })
    });
    if (res.ok) {
      loadAdminData();
    }
  };

  // Application Status Change
  const handleUpdateAppStatus = async (appId, newStatus) => {
    playPixelClick();
    const res = await fetchApi(`/admin/applications/${appId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      showNotify('success', `Application #${appId} set to ${newStatus}`);
      refreshStats();
      loadAdminData();
    }
  };

  // Eligible Wallet Add
  const handleAddWallet = async (e) => {
    e.preventDefault();
    if (!addWalletInput.address.trim()) return;

    playPixelClick();
    const res = await fetchApi('/admin/wallets', {
      method: 'POST',
      body: JSON.stringify({
        walletAddress: addWalletInput.address.trim(),
        notes: addWalletInput.notes.trim()
      })
    });

    if (res.ok) {
      playQuestVerified();
      showNotify('success', 'Wallet added to eligible whitelist.');
      setAddWalletInput({ address: '', notes: '' });
      loadAdminData();
    } else {
      playErrorBeep();
      showNotify('error', res.data.error || 'Failed to add wallet.');
    }
  };

  const handleDeleteWallet = async (id, address) => {
    if (!window.confirm(`Remove wallet "${address}" from eligible database?`)) return;
    playPixelClick();
    const res = await fetchApi(`/admin/wallets/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showNotify('success', 'Wallet removed.');
      loadAdminData();
    }
  };

  // CSV Import
  const handleCsvImport = async (e) => {
    e.preventDefault();
    if (!csvUploadText.trim()) return;

    playPixelClick();
    const res = await fetchApi('/admin/wallets/import-csv', {
      method: 'POST',
      body: JSON.stringify({ csvText: csvUploadText })
    });

    if (res.ok && res.data) {
      playQuestVerified();
      setCsvResult(res.data.stats);
      showNotify('success', res.data.message);
      setCsvUploadText('');
      loadAdminData();
    } else {
      playErrorBeep();
      showNotify('error', res.data?.error || 'Failed to import CSV.');
    }
  };

  // CSV File Upload input
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setCsvUploadText(evt.target?.result || '');
    };
    reader.readAsText(file);
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (savingGeneralSettings) return;
    playPixelClick();
    setSavingGeneralSettings(true);

    try {
      const res = await fetchApi('/admin/settings', {
        method: 'POST',
        body: JSON.stringify(globalSettings)
      });
      if (res.ok && res.data?.success) {
        playQuestVerified();
        showNotify('success', '✓ Global settings saved to Supabase.');
        await loadAdminData();
      } else {
        playErrorBeep();
        showNotify('error', res.data?.error || 'Failed to save settings to database.');
      }
    } catch (err) {
      playErrorBeep();
      showNotify('error', `Network error while saving settings: ${err.message}`);
    } finally {
      setSavingGeneralSettings(false);
    }
  };

  // ==========================================
  // UN-AUTHENTICATED: LOGIN SCREEN
  // ==========================================
  if (!token || !adminUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-20">
        <div className="border-4 border-black bg-[#13141F] p-8 shadow-[8px_8px_0px_#000] space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 border-2 border-black bg-[#FF8800] mx-auto overflow-hidden shadow-[2px_2px_0px_#000]">
              <img src="/assets/zeckshark-logo.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="font-pixel text-xl text-[#FF8800] uppercase">
              ADMIN ACCESS
            </h1>
            <p className="text-zinc-500 text-xs font-mono">
              RESTRICTED SYSTEM TERMINAL
            </p>
          </div>

          {loginError && (
            <div className="bg-[#2B1616] border-2 border-black p-3 text-red-300 text-xs font-mono">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="font-pixel text-[10px] text-zinc-400 block mb-1.5 uppercase">
                USERNAME
              </label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                required
                className="w-full bg-black border-2 border-black p-2.5 text-white font-mono text-sm focus:outline-none focus:border-[#FF8800]"
              />
            </div>

            <div>
              <label className="font-pixel text-[10px] text-zinc-400 block mb-1.5 uppercase">
                PASSWORD
              </label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                required
                placeholder="••••••••••••"
                className="w-full bg-black border-2 border-black p-2.5 text-white font-mono text-sm focus:outline-none focus:border-[#FF8800]"
              />
            </div>

            <PixelButton
              type="submit"
              variant="primary"
              size="md"
              disabled={loginLoading}
              className="w-full mt-2"
            >
              {loginLoading ? 'AUTHENTICATING...' : '[ LOGIN TO PORTAL ]'}
            </PixelButton>
          </form>

          <div className="text-center text-[10px] text-zinc-600 font-mono border-t border-zinc-800 pt-4">
            Default credentials: zecshark / zecshark@6644
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // AUTHENTICATED: ADMIN CONSOLE
  // ==========================================
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Top Admin Header */}
      <div className="border-4 border-black bg-[#12131D] p-5 shadow-[6px_6px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border-2 border-black bg-[#FF8800] overflow-hidden shrink-0">
            <img src="/assets/zeckshark-logo.jpg" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-pixel text-sm sm:text-base text-[#FFC107]">
                ZECKSHARK ADMIN CONTROL
              </span>
              <span className="bg-[#10B981] text-black font-pixel text-[9px] px-1.5 py-0.5 border border-black font-bold">
                ONLINE
              </span>
            </div>
            <span className="text-xs text-zinc-400 font-mono">
              Logged in as: <strong className="text-white">@{adminUser.username}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAdminData}
            title="Refresh Data"
            className="p-2 bg-[#181926] border-2 border-black text-[#FFC107] hover:bg-[#252737] shadow-[2px_2px_0px_#000]"
          >
            <RefreshCw size={16} className={loadingData ? 'animate-spin' : ''} />
          </button>

          <PixelButton variant="danger" size="sm" onClick={handleLogout}>
            [ LOGOUT ]
          </PixelButton>
        </div>
      </div>

      {/* Global Notification */}
      {notification && (
        <div
          className={`p-3 border-4 border-black font-pixel text-xs shadow-[4px_4px_0px_#000] ${
            notification.type === 'success' ? 'bg-[#10B981] text-black' : 'bg-[#EF4444] text-white'
          }`}
        >
          {notification.text}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b-4 border-black pb-2">
        {[
          { id: 'overview', label: 'DASHBOARD' },
          { id: 'tasks', label: 'TASK MANAGER' },
          { id: 'applications', label: 'WAITLIST USERS' },
          { id: 'wallets', label: 'ELIGIBLE WALLETS' },
          { id: 'settings', label: 'SETTINGS' },
          { id: 'audit', label: 'AUDIT LOGS' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { playPixelClick(); setActiveTab(tab.id); }}
            className={`font-pixel text-xs px-4 py-2.5 uppercase border-2 border-black transition-all ${
              activeTab === tab.id
                ? 'bg-[#FF8800] text-black shadow-[3px_3px_0px_#000] translate-x-[-1px] translate-y-[-1px]'
                : 'bg-[#151622] text-zinc-300 hover:bg-[#20212E]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===================================================
          TAB 1: DASHBOARD OVERVIEW & GLOBAL TOGGLES
         =================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-[#141520] border-4 border-black p-5 shadow-[4px_4px_0px_#000]">
              <div className="flex items-center justify-between text-zinc-400 mb-2">
                <span className="font-pixel text-[10px] text-[#FF8800]">REAL REGISTERED USERS</span>
                <Users size={16} />
              </div>
              <div className="font-pixel text-2xl sm:text-3xl text-white">
                {metrics?.totalRegisteredUsers?.toLocaleString() ?? '...'}
              </div>
              <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                Derived from successful applications
              </span>
            </div>

            <div className="bg-[#141520] border-4 border-black p-5 shadow-[4px_4px_0px_#000]">
              <div className="flex items-center justify-between text-zinc-400 mb-2">
                <span className="font-pixel text-[10px] text-[#10B981]">COMPLETED APPS</span>
                <CheckCircle size={16} />
              </div>
              <div className="font-pixel text-2xl sm:text-3xl text-white">
                {metrics?.completedApplications ?? '...'}
              </div>
              <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                All valid waitlist submissions
              </span>
            </div>

            <div className="bg-[#141520] border-4 border-black p-5 shadow-[4px_4px_0px_#000]">
              <div className="flex items-center justify-between text-zinc-400 mb-2">
                <span className="font-pixel text-[10px] text-[#FFC107]">PENDING APPS</span>
                <Clock size={16} />
              </div>
              <div className="font-pixel text-2xl sm:text-3xl text-white">
                {metrics?.pendingApplications ?? '...'}
              </div>
              <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                Awaiting batch review
              </span>
            </div>

            <div className="bg-[#141520] border-4 border-black p-5 shadow-[4px_4px_0px_#000]">
              <div className="flex items-center justify-between text-zinc-400 mb-2">
                <span className="font-pixel text-[10px] text-[#818CF8]">ELIGIBLE WALLETS</span>
                <Shield size={16} />
              </div>
              <div className="font-pixel text-2xl sm:text-3xl text-white">
                {metrics?.eligibleWallets ?? '...'}
              </div>
              <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                Active in public checker
              </span>
            </div>

          </div>

          {/* Supabase Connection Status Banner */}
          {supabaseStatus && (
            <div>
              {supabaseStatus.configured ? (
                <div className="flex items-center justify-between gap-3 text-xs bg-[#112217] border-2 border-black p-3 shadow-[3px_3px_0px_#000]">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-[#10B981]" />
                    <span className="font-pixel text-[11px] text-[#10B981]">
                      SUPABASE PERSISTENCE ACTIVE
                    </span>
                    <span className="text-zinc-400 font-mono text-[10px]">
                      ({supabaseStatus.url || 'Cloud Database'} • {supabaseStatus.keyType.toUpperCase()} KEY)
                    </span>
                  </div>
                  <span className="font-pixel text-[9px] bg-[#10B981] text-black px-1.5 py-0.5 font-bold">
                    CLOUD SYNC
                  </span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-[#2B1E12] border-2 border-[#FF8800] p-3 shadow-[3px_3px_0px_#000]">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-[#FF8800] shrink-0" />
                    <div>
                      <span className="font-pixel text-[10px] text-[#FFC107] block">
                        SUPABASE NOT CONNECTED (RUNNING ON LOCAL CACHE)
                      </span>
                      <span className="text-zinc-300 text-[11px]">
                        To persist settings permanently across Vercel deployments, configure <strong>SUPABASE_URL</strong> and <strong>SUPABASE_ANON_KEY</strong> in Vercel Environment Variables.
                      </span>
                    </div>
                  </div>
                  <span className="font-pixel text-[9px] bg-[#FF8800] text-black px-2 py-0.5 font-bold shrink-0 self-start sm:self-center">
                    EPHEMERAL
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Quick Global Toggles */}
          <PixelCard title="GLOBAL SYSTEM SWITCHES" badge={<PixelBadge status="READY" text="CONTROLS" />}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              
              {/* Waitlist On/Off */}
              <div className="bg-[#181926] p-4 border-2 border-black flex items-center justify-between">
                <div>
                  <span className="font-pixel text-xs text-white block">WAITLIST ENGINE</span>
                  <span className="text-xs text-zinc-400">Enable or pause waitlist</span>
                </div>
                <button
                  disabled={buttonStates.waitlist_enabled === 'saving' || buttonStates.waitlist_enabled === 'success' || (!metrics && loadingData)}
                  onClick={() => handleToggleSetting('waitlist_enabled', globalSettings.waitlist_enabled)}
                  className={`font-pixel text-xs px-3 py-1.5 border-2 border-black transition-all ${
                    !metrics && loadingData
                      ? 'bg-zinc-800 text-zinc-400 cursor-wait'
                      : buttonStates.waitlist_enabled === 'saving'
                      ? 'bg-[#FF8800] text-black animate-pulse cursor-wait font-bold shadow-[2px_2px_0px_#000]'
                      : buttonStates.waitlist_enabled === 'success'
                      ? 'bg-[#10B981] text-black font-bold shadow-[2px_2px_0px_#000]'
                      : buttonStates.waitlist_enabled === 'error'
                      ? 'bg-[#EF4444] text-white font-bold shadow-[2px_2px_0px_#000]'
                      : globalSettings.waitlist_enabled !== 'false'
                      ? 'bg-[#10B981] text-black shadow-[2px_2px_0px_#000] hover:bg-[#20c997]'
                      : 'bg-[#EF4444] text-white shadow-[2px_2px_0px_#000] hover:bg-[#f87171]'
                  }`}
                >
                  {!metrics && loadingData
                    ? 'LOADING...'
                    : buttonStates.waitlist_enabled === 'saving'
                    ? 'SAVING...'
                    : buttonStates.waitlist_enabled === 'success'
                    ? 'SAVED! ✓'
                    : buttonStates.waitlist_enabled === 'error'
                    ? 'FAILED! ✕'
                    : globalSettings.waitlist_enabled !== 'false'
                    ? 'ON'
                    : 'OFF'}
                </button>
              </div>

              {/* Applications Open/Closed */}
              <div className="bg-[#181926] p-4 border-2 border-black flex items-center justify-between">
                <div>
                  <span className="font-pixel text-xs text-white block">APPLICATIONS</span>
                  <span className="text-xs text-zinc-400">Accepting submissions</span>
                </div>
                <button
                  disabled={buttonStates.applications_open === 'saving' || buttonStates.applications_open === 'success' || (!metrics && loadingData)}
                  onClick={() => handleToggleSetting('applications_open', globalSettings.applications_open !== undefined ? globalSettings.applications_open : globalSettings.applications_enabled)}
                  className={`font-pixel text-xs px-3 py-1.5 border-2 border-black transition-all ${
                    !metrics && loadingData
                      ? 'bg-zinc-800 text-zinc-400 cursor-wait'
                      : buttonStates.applications_open === 'saving'
                      ? 'bg-[#FF8800] text-black animate-pulse cursor-wait font-bold shadow-[2px_2px_0px_#000]'
                      : buttonStates.applications_open === 'success'
                      ? 'bg-[#10B981] text-black font-bold shadow-[2px_2px_0px_#000]'
                      : buttonStates.applications_open === 'error'
                      ? 'bg-[#EF4444] text-white font-bold shadow-[2px_2px_0px_#000]'
                      : (globalSettings.applications_open !== 'false' && globalSettings.applications_enabled !== 'false')
                      ? 'bg-[#10B981] text-black shadow-[2px_2px_0px_#000] hover:bg-[#20c997]'
                      : 'bg-[#EF4444] text-white shadow-[2px_2px_0px_#000] hover:bg-[#f87171]'
                  }`}
                >
                  {!metrics && loadingData
                    ? 'LOADING...'
                    : buttonStates.applications_open === 'saving'
                    ? 'SAVING...'
                    : buttonStates.applications_open === 'success'
                    ? 'SAVED! ✓'
                    : buttonStates.applications_open === 'error'
                    ? 'FAILED! ✕'
                    : (globalSettings.applications_open !== 'false' && globalSettings.applications_enabled !== 'false')
                    ? 'OPEN'
                    : 'CLOSED'}
                </button>
              </div>

              {/* Wallet Checker On/Off */}
              <div className="bg-[#181926] p-4 border-2 border-black flex items-center justify-between">
                <div>
                  <span className="font-pixel text-xs text-white block">WALLET CHECKER</span>
                  <span className="text-xs text-zinc-400">Public checker access</span>
                </div>
                <button
                  disabled={buttonStates.wallet_checker_enabled === 'saving' || buttonStates.wallet_checker_enabled === 'success' || (!metrics && loadingData)}
                  onClick={() => handleToggleSetting('wallet_checker_enabled', globalSettings.wallet_checker_enabled)}
                  className={`font-pixel text-xs px-3 py-1.5 border-2 border-black transition-all ${
                    !metrics && loadingData
                      ? 'bg-zinc-800 text-zinc-400 cursor-wait'
                      : buttonStates.wallet_checker_enabled === 'saving'
                      ? 'bg-[#FF8800] text-black animate-pulse cursor-wait font-bold shadow-[2px_2px_0px_#000]'
                      : buttonStates.wallet_checker_enabled === 'success'
                      ? 'bg-[#10B981] text-black font-bold shadow-[2px_2px_0px_#000]'
                      : buttonStates.wallet_checker_enabled === 'error'
                      ? 'bg-[#EF4444] text-white font-bold shadow-[2px_2px_0px_#000]'
                      : globalSettings.wallet_checker_enabled !== 'false'
                      ? 'bg-[#10B981] text-black shadow-[2px_2px_0px_#000] hover:bg-[#20c997]'
                      : 'bg-[#EF4444] text-white shadow-[2px_2px_0px_#000] hover:bg-[#f87171]'
                  }`}
                >
                  {!metrics && loadingData
                    ? 'LOADING...'
                    : buttonStates.wallet_checker_enabled === 'saving'
                    ? 'SAVING...'
                    : buttonStates.wallet_checker_enabled === 'success'
                    ? 'SAVED! ✓'
                    : buttonStates.wallet_checker_enabled === 'error'
                    ? 'FAILED! ✕'
                    : globalSettings.wallet_checker_enabled !== 'false'
                    ? 'ON'
                    : 'OFF'}
                </button>
              </div>

            </div>
          </PixelCard>

        </div>
      )}

      {/* ===================================================
          TAB 2: TASK MANAGER (CRUD + ARCHIVAL)
         =================================================== */}
      {activeTab === 'tasks' && (
        <div className="space-y-6 animate-fade-in">
          
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-pixel text-lg text-[#FFC107]">SEQUENTIAL TASK MANAGER</h2>
              <p className="text-xs text-zinc-400">
                Manage waitlist quests. Note: Removing tasks archives them so historic verifications remain intact.
              </p>
            </div>
            <PixelButton
              variant="primary"
              size="sm"
              onClick={() => setTaskModal({
                mode: 'create',
                task: {
                  name: '',
                  description: '',
                  x_account: '@zecshark',
                  x_url: 'https://x.com/zecshark',
                  verification_type: 'FOLLOW',
                  sort_order: tasks.length + 1,
                  is_enabled: 1
                }
              })}
            >
              [ + ADD TASK ]
            </PixelButton>
          </div>

          <div className="border-4 border-black bg-[#12131D] shadow-[6px_6px_0px_#000] overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-black bg-[#1A1B28] text-[#FFC107] font-pixel text-[10px]">
                  <th className="p-3">ORDER</th>
                  <th className="p-3">TASK NAME</th>
                  <th className="p-3">TYPE</th>
                  <th className="p-3">X TARGET</th>
                  <th className="p-3">STATUS</th>
                  <th className="p-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/50">
                {tasks.map((t, idx) => {
                  const isArchived = Boolean(t.is_archived);
                  return (
                    <tr key={t.id} className={`hover:bg-black/30 ${isArchived ? 'opacity-40 bg-red-950/20' : ''}`}>
                      <td className="p-3 font-mono font-bold text-white">
                        <div className="flex items-center gap-1">
                          <span>#{t.sort_order}</span>
                          {!isArchived && (
                            <div className="flex flex-col ml-1">
                              <button
                                onClick={() => handleMoveTask(idx, -1)}
                                disabled={idx === 0}
                                className="hover:text-[#FF8800] disabled:opacity-20"
                              >
                                <ArrowUp size={12} />
                              </button>
                              <button
                                onClick={() => handleMoveTask(idx, 1)}
                                disabled={idx === tasks.length - 1}
                                className="hover:text-[#FF8800] disabled:opacity-20"
                              >
                                <ArrowDown size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-pixel text-white">
                        {t.name}
                        {isArchived && <span className="ml-2 text-[9px] bg-red-800 text-white px-1 font-bold">ARCHIVED</span>}
                      </td>
                      <td className="p-3 font-mono text-zinc-400">
                        {t.verification_type}
                      </td>
                      <td className="p-3 font-mono text-[#FFC107]">
                        {t.x_account || '—'}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => !isArchived && handleToggleTask(t.id)}
                          disabled={isArchived}
                          className={`font-pixel text-[9px] px-2 py-0.5 border border-black ${
                            t.is_enabled ? 'bg-[#10B981] text-black' : 'bg-[#EF4444] text-white'
                          }`}
                        >
                          {t.is_enabled ? 'ENABLED' : 'DISABLED'}
                        </button>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        {!isArchived ? (
                          <>
                            <button
                              onClick={() => setTaskModal({ mode: 'edit', task: { ...t } })}
                              className="p-1 text-zinc-300 hover:text-[#FFC107]"
                              title="Edit Task"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleArchiveTask(t.id, t.name)}
                              className="p-1 text-red-400 hover:text-red-300"
                              title="Archive Task"
                            >
                              <Archive size={14} />
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-zinc-500 font-mono">Archived</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* Task Modal (Create / Edit) */}
      {taskModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#141520] border-4 border-black p-6 w-full max-w-lg shadow-[8px_8px_0px_#000] space-y-4">
            <h3 className="font-pixel text-sm text-[#FFC107]">
              {taskModal.mode === 'create' ? 'CREATE NEW TASK' : 'EDIT TASK'}
            </h3>

            <form onSubmit={handleSaveTask} className="space-y-3 text-xs">
              <div>
                <label className="font-pixel text-[10px] text-zinc-400 block mb-1">TASK NAME</label>
                <input
                  type="text"
                  required
                  value={taskModal.task.name}
                  onChange={(e) => setTaskModal({ ...taskModal, task: { ...taskModal.task, name: e.target.value } })}
                  className="w-full bg-black border-2 border-black p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="font-pixel text-[10px] text-zinc-400 block mb-1">DESCRIPTION</label>
                <textarea
                  required
                  rows={2}
                  value={taskModal.task.description}
                  onChange={(e) => setTaskModal({ ...taskModal, task: { ...taskModal.task, description: e.target.value } })}
                  className="w-full bg-black border-2 border-black p-2 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-pixel text-[10px] text-zinc-400 block mb-1">VERIFICATION TYPE</label>
                  <select
                    value={taskModal.task.verification_type}
                    onChange={(e) => setTaskModal({ ...taskModal, task: { ...taskModal.task, verification_type: e.target.value } })}
                    className="w-full bg-black border-2 border-black p-2 text-white font-mono"
                  >
                    <option value="CONNECT_X">CONNECT_X</option>
                    <option value="FOLLOW">FOLLOW</option>
                    <option value="LIKE_RETWEET">LIKE_RETWEET</option>
                    <option value="QUOTE">QUOTE</option>
                    <option value="COMMENT">COMMENT</option>
                  </select>
                </div>

                <div>
                  <label className="font-pixel text-[10px] text-zinc-400 block mb-1">SORT ORDER</label>
                  <input
                    type="number"
                    value={taskModal.task.sort_order}
                    onChange={(e) => setTaskModal({ ...taskModal, task: { ...taskModal.task, sort_order: Number(e.target.value) } })}
                    className="w-full bg-black border-2 border-black p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-pixel text-[10px] text-zinc-400 block mb-1">X TARGET ACCOUNT</label>
                <input
                  type="text"
                  value={taskModal.task.x_account || ''}
                  onChange={(e) => setTaskModal({ ...taskModal, task: { ...taskModal.task, x_account: e.target.value } })}
                  className="w-full bg-black border-2 border-black p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="font-pixel text-[10px] text-zinc-400 block mb-1">X URL</label>
                <input
                  type="text"
                  value={taskModal.task.x_url || ''}
                  onChange={(e) => setTaskModal({ ...taskModal, task: { ...taskModal.task, x_url: e.target.value } })}
                  className="w-full bg-black border-2 border-black p-2 text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setTaskModal(null)}
                  className="px-3 py-1.5 font-pixel text-[10px] bg-zinc-800 text-white border-2 border-black"
                >
                  CANCEL
                </button>
                <PixelButton type="submit" variant="primary" size="sm">
                  SAVE TASK
                </PixelButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================
          TAB 3: WAITLIST APPLICATIONS MANAGEMENT & CSV EXPORT
         =================================================== */}
      {activeTab === 'applications' && (
        <div className="space-y-6 animate-fade-in">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-pixel text-lg text-[#FFC107]">WAITLIST USER APPLICATIONS</h2>
              <p className="text-xs text-zinc-400">
                Review submitted applications, verify completion, and export wallets to CSV.
              </p>
            </div>

            {/* CSV Export Button for Completed Wallets */}
            <a
              href="/api/admin/applications/export-csv"
              download="zeckshark_waitlist_wallets.csv"
              className="inline-flex items-center gap-2 font-pixel text-xs px-4 py-2.5 bg-[#FFC107] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-[#FFD54F]"
            >
              <Download size={14} />
              <span>EXPORT COMPLETED CSV</span>
            </a>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by X username, wallet, or App ID..."
                value={appsSearch}
                onChange={(e) => setAppsSearch(e.target.value)}
                className="w-full bg-black border-2 border-black pl-9 pr-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#FF8800]"
              />
            </div>

            <div className="flex items-center gap-1">
              {['ALL', 'PENDING', 'COMPLETED', 'ELIGIBLE', 'NOT ELIGIBLE'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setAppsStatusFilter(filter)}
                  className={`font-pixel text-[10px] px-2.5 py-2 border border-black ${
                    appsStatusFilter === filter ? 'bg-[#FF8800] text-black font-bold' : 'bg-[#181926] text-zinc-400'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="border-4 border-black bg-[#12131D] shadow-[6px_6px_0px_#000] overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-black bg-[#1A1B28] text-[#FFC107] font-pixel text-[10px]">
                  <th className="p-3">APP ID</th>
                  <th className="p-3">X USERNAME</th>
                  <th className="p-3">TASKS</th>
                  <th className="p-3">SHIELDED WALLET</th>
                  <th className="p-3">ELIGIBLE?</th>
                  <th className="p-3">STATUS</th>
                  <th className="p-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/50 font-mono">
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-zinc-500 font-pixel text-xs">
                      No applications match current filters.
                    </td>
                  </tr>
                ) : (
                  applications.map(app => {
                    const appId = app.id || app.application_code;
                    const wallet = app.wallet_address || app.walletAddress || '';
                    const shortWallet = wallet.length > 14
                      ? `${wallet.substring(0, 8)}...${wallet.substring(wallet.length - 6)}`
                      : (wallet || 'N/A');
                    const completedTasks = app.completed_tasks_count !== undefined ? app.completed_tasks_count : 5;
                    const totalTasks = app.total_tasks_count !== undefined ? app.total_tasks_count : 5;

                    return (
                      <tr key={appId} className="hover:bg-black/30">
                        <td className="p-3 font-pixel text-[11px] text-[#FF8800]">
                          {app.application_code || app.applicationCode}
                        </td>
                        <td className="p-3 text-white">
                          @{app.x_username || app.xUsername}
                        </td>
                        <td className="p-3">
                          <span className="bg-[#181A25] px-2 py-0.5 border border-black text-[#10B981] font-bold">
                            {completedTasks}/{totalTasks}
                          </span>
                        </td>
                        <td className="p-3 text-zinc-300">
                          {shortWallet}
                        </td>
                        <td className="p-3">
                          {app.is_wallet_eligible ? (
                            <span className="text-[#10B981] font-bold">✓ YES</span>
                          ) : (
                            <span className="text-zinc-500">NO</span>
                          )}
                        </td>
                        <td className="p-3">
                          <select
                            value={app.status}
                            onChange={(e) => handleUpdateAppStatus(appId, e.target.value)}
                            className="bg-black border border-black text-[11px] px-2 py-1 text-[#FFC107] focus:outline-none"
                          >
                            <option value="PENDING">PENDING</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="REJECTED">REJECTED</option>
                          </select>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setAppDetailModal(app)}
                            className="font-pixel text-[9px] px-2 py-1 bg-[#1E202E] border border-black text-white hover:bg-[#2B2D3F]"
                          >
                            INSPECT
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* Application Detail Modal */}
      {appDetailModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#141520] border-4 border-black p-6 w-full max-w-lg shadow-[8px_8px_0px_#000] space-y-4 text-xs">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <h3 className="font-pixel text-sm text-[#FFC107]">
                APPLICATION #{appDetailModal.application_code}
              </h3>
              <button onClick={() => setAppDetailModal(null)} className="text-zinc-400 hover:text-white font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 font-mono">
              <div className="bg-black p-3 border border-zinc-800">
                <span className="text-zinc-500 block text-[10px]">X USER</span>
                <span className="text-white font-bold">@{appDetailModal.x_username} (ID: {appDetailModal.x_id})</span>
              </div>

              <div className="bg-black p-3 border border-zinc-800">
                <span className="text-zinc-500 block text-[10px]">ZCASH SHIELDED WALLET ADDRESS</span>
                <span className="text-[#FF8800] break-all">{appDetailModal.wallet_address}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-black p-3 border border-zinc-800">
                  <span className="text-zinc-500 block text-[10px]">STATUS</span>
                  <span className="text-[#10B981] font-bold">{appDetailModal.status}</span>
                </div>
                <div className="bg-black p-3 border border-zinc-800">
                  <span className="text-zinc-500 block text-[10px]">CREATED AT</span>
                  <span className="text-zinc-300">{new Date(appDetailModal.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setAppDetailModal(null)}
                className="px-4 py-2 bg-[#FF8800] text-black font-pixel text-xs border-2 border-black shadow-[2px_2px_0px_#000]"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          TAB 4: ELIGIBLE WALLET MANAGER & CSV WORKFLOW
         =================================================== */}
      {activeTab === 'wallets' && (
        <div className="space-y-8 animate-fade-in">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-pixel text-lg text-[#FFC107]">ELIGIBLE WALLET DATABASE</h2>
              <p className="text-xs text-zinc-400">
                These addresses return ✓ ELIGIBLE on the public Wallet Checker.
              </p>
            </div>

            <a
              href="/api/admin/wallets/export-csv"
              download="zeckshark_eligible_wallets.csv"
              className="inline-flex items-center gap-2 font-pixel text-xs px-4 py-2.5 bg-[#FF8800] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-[#FFA726]"
            >
              <Download size={14} />
              <span>EXPORT ELIGIBLE CSV</span>
            </a>
          </div>

          {/* Add Wallet & CSV Import Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Add Single Wallet */}
            <PixelCard title="ADD SINGLE WALLET">
              <form onSubmit={handleAddWallet} className="space-y-3 text-xs">
                <div>
                  <label className="font-pixel text-[10px] text-zinc-400 block mb-1">ZCASH SHIELDED WALLET ADDRESS (u1... / zs1...)</label>
                  <input
                    type="text"
                    required
                    placeholder="u1... or zs1..."
                    value={addWalletInput.address}
                    onChange={(e) => setAddWalletInput({ ...addWalletInput, address: e.target.value })}
                    className="w-full bg-black border-2 border-black p-2.5 text-white font-mono text-xs focus:outline-none focus:border-[#FF8800]"
                  />
                </div>
                <div>
                  <label className="font-pixel text-[10px] text-zinc-400 block mb-1">NOTES (OPTIONAL)</label>
                  <input
                    type="text"
                    placeholder="e.g. Genesis Contributor"
                    value={addWalletInput.notes}
                    onChange={(e) => setAddWalletInput({ ...addWalletInput, notes: e.target.value })}
                    className="w-full bg-black border-2 border-black p-2 text-white font-mono text-xs"
                  />
                </div>
                <PixelButton type="submit" variant="primary" size="sm">
                  [ + ADD TO WHITELIST ]
                </PixelButton>
              </form>
            </PixelCard>

            {/* CSV Import */}
            <PixelCard title="IMPORT WALLETS VIA CSV">
              <form onSubmit={handleCsvImport} className="space-y-3 text-xs">
                <div>
                  <label className="font-pixel text-[10px] text-zinc-400 block mb-1">
                    PASTE CSV TEXT OR UPLOAD FILE
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="cursor-pointer font-pixel text-[10px] px-3 py-1.5 bg-[#222436] border-2 border-black text-[#FFC107] hover:bg-[#2C2F46] inline-flex items-center gap-1.5">
                      <Upload size={12} />
                      <span>SELECT .CSV FILE</span>
                      <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                    </label>
                    <span className="text-[10px] text-zinc-500 font-mono">Format: wallet_address,notes</span>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="u1ga08vee...,Genesis Tier&#10;zs1z7rejl...,Waitlist Wave 1"
                    value={csvUploadText}
                    onChange={(e) => setCsvUploadText(e.target.value)}
                    className="w-full bg-black border-2 border-black p-2 text-white font-mono text-xs"
                  />
                </div>

                <PixelButton type="submit" variant="secondary" size="sm" disabled={!csvUploadText.trim()}>
                  [ IMPORT CSV BATCH ]
                </PixelButton>

                {csvResult && (
                  <div className="bg-[#1A251E] p-2.5 border border-black text-[11px] text-[#10B981] font-mono">
                    ✓ Imported: {csvResult.imported} | Duplicates: {csvResult.duplicates} | Invalid: {csvResult.invalid}
                  </div>
                )}
              </form>
            </PixelCard>

          </div>

          {/* Wallets Table */}
          <div className="space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search eligible wallets..."
                value={walletsSearch}
                onChange={(e) => setWalletsSearch(e.target.value)}
                className="w-full bg-black border-2 border-black pl-9 pr-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#FF8800]"
              />
            </div>

            <div className="border-4 border-black bg-[#12131D] shadow-[6px_6px_0px_#000] overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-black bg-[#1A1B28] text-[#FFC107] font-pixel text-[10px]">
                    <th className="p-3">WALLET ADDRESS</th>
                    <th className="p-3">NOTES</th>
                    <th className="p-3">ADDED BY</th>
                    <th className="p-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/50 font-mono">
                  {wallets.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-zinc-500 font-pixel text-xs">
                        No eligible wallets found.
                      </td>
                    </tr>
                  ) : (
                    wallets.map(w => (
                      <tr key={w.id} className="hover:bg-black/30">
                        <td className="p-3 text-[#10B981] font-bold break-all">
                          {w.wallet_address}
                        </td>
                        <td className="p-3 text-zinc-400">
                          {w.notes || '—'}
                        </td>
                        <td className="p-3 text-zinc-500 text-[11px]">
                          {w.added_by}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteWallet(w.id, w.wallet_address)}
                            className="text-red-400 hover:text-red-300 text-[11px]"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ===================================================
          TAB 5: GLOBAL SETTINGS
         =================================================== */}
      {activeTab === 'settings' && (
        <div className="space-y-6 animate-fade-in max-w-2xl">
          <PixelCard title="GLOBAL PROJECT SETTINGS">
            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div>
                <label className="font-pixel text-[10px] text-zinc-400 block mb-1">PROJECT NAME</label>
                <input
                  type="text"
                  value={globalSettings.project_name || ''}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, project_name: e.target.value })}
                  className="w-full bg-black border-2 border-black p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="font-pixel text-[10px] text-zinc-400 block mb-1">HERO HEADLINE</label>
                <input
                  type="text"
                  value={globalSettings.hero_headline || ''}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, hero_headline: e.target.value })}
                  className="w-full bg-black border-2 border-black p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="font-pixel text-[10px] text-zinc-400 block mb-1">HERO SUBHEADLINE</label>
                <input
                  type="text"
                  value={globalSettings.hero_subheadline || ''}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, hero_subheadline: e.target.value })}
                  className="w-full bg-black border-2 border-black p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="font-pixel text-[10px] text-zinc-400 block mb-1">OFFICIAL X USERNAME</label>
                <input
                  type="text"
                  value={globalSettings.x_account_username || ''}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, x_account_username: e.target.value })}
                  className="w-full bg-black border-2 border-black p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="font-pixel text-[10px] text-zinc-400 block mb-1">X ACCOUNT URL</label>
                <input
                  type="text"
                  value={globalSettings.x_account_url || ''}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, x_account_url: e.target.value })}
                  className="w-full bg-black border-2 border-black p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="font-pixel text-[10px] text-zinc-400 block mb-1">X VERIFICATION ENGINE MODE</label>
                <select
                  value={globalSettings.x_verification_mode || 'DEMO'}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, x_verification_mode: e.target.value })}
                  className="w-full bg-black border-2 border-black p-2 text-white font-mono"
                >
                  <option value="DEMO">DEMO / MOCK (Simulated server-side checking)</option>
                  <option value="PRODUCTION">PRODUCTION (Real Twitter / X API v2)</option>
                </select>
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  In DEMO mode, verification executes server-side with realistic latency without requiring active Twitter API secrets.
                </span>
              </div>

              {globalSettings.x_verification_mode === 'PRODUCTION' && (
                <div className="space-y-3 bg-black/40 p-3 border border-zinc-800">
                  <div>
                    <label className="font-pixel text-[10px] text-[#FFC107] block mb-1">X BEARER TOKEN</label>
                    <input
                      type="password"
                      placeholder="AAAAAAAAAAAAAAAAAAAA..."
                      value={globalSettings.x_bearer_token || ''}
                      onChange={(e) => setGlobalSettings({ ...globalSettings, x_bearer_token: e.target.value })}
                      className="w-full bg-black border-2 border-black p-2 text-white font-mono text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2">
                <PixelButton type="submit" variant="primary" size="md" disabled={savingGeneralSettings}>
                  {savingGeneralSettings ? '[ SAVING TO SUPABASE... ]' : '[ SAVE CONFIGURATION ]'}
                </PixelButton>
              </div>
            </form>
          </PixelCard>
        </div>
      )}

      {/* ===================================================
          TAB 6: IMMUTABLE AUDIT LOGS
         =================================================== */}
      {activeTab === 'audit' && (
        <div className="space-y-4 animate-fade-in">
          <div>
            <h2 className="font-pixel text-lg text-[#FFC107]">SYSTEM AUDIT LOGS</h2>
            <p className="text-xs text-zinc-400">
              Immutable record of all administrative actions. Normal UI cannot delete audit logs.
            </p>
          </div>

          <div className="border-4 border-black bg-[#12131D] shadow-[6px_6px_0px_#000] overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-black bg-[#1A1B28] text-[#FFC107] font-pixel text-[10px]">
                  <th className="p-3">TIMESTAMP</th>
                  <th className="p-3">ADMIN</th>
                  <th className="p-3">ACTION</th>
                  <th className="p-3">TARGET</th>
                  <th className="p-3">DETAILS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/50 font-mono">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-black/30">
                    <td className="p-3 text-zinc-500 text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3 text-white font-bold">
                      @{log.admin_username}
                    </td>
                    <td className="p-3 text-[#FF8800]">
                      {log.action}
                    </td>
                    <td className="p-3 text-zinc-300">
                      {log.target}
                    </td>
                    <td className="p-3 text-zinc-500 text-[11px] truncate max-w-xs">
                      {log.details || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
