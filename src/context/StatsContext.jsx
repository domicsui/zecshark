import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchApi } from '../utils/api';

const StatsContext = createContext(null);

export function StatsProvider({ children }) {
  const [registeredUsers, setRegisteredUsers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Direct fetch fallback / initial loader
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetchApi('/stats');
      if (res.ok && res.data && typeof res.data.registeredUsers === 'number') {
        setRegisteredUsers(res.data.registeredUsers);
        setError(false);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let sseSource = null;
    let pollInterval = null;

    // 1. Initial immediate fetch
    fetchStats();

    // 2. Connect Server-Sent Events for real-time live synchronization
    try {
      sseSource = new EventSource('/api/stats/stream');

      sseSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && typeof data.registeredUsers === 'number') {
            setRegisteredUsers(data.registeredUsers);
            setLoading(false);
            setError(false);
          }
        } catch (e) {
          console.error('Error parsing SSE event:', e);
        }
      };

      sseSource.onerror = () => {
        // If SSE fails (e.g. proxy dropped connection), fall back to short polling
        if (sseSource) {
          sseSource.close();
          sseSource = null;
        }
        if (!pollInterval) {
          pollInterval = setInterval(fetchStats, 4000);
        }
      };
    } catch (err) {
      pollInterval = setInterval(fetchStats, 4000);
    }

    return () => {
      if (sseSource) sseSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [fetchStats]);

  return (
    <StatsContext.Provider value={{ registeredUsers, loading, error, refreshStats: fetchStats }}>
      {children}
    </StatsContext.Provider>
  );
}

export function useStats() {
  const context = useContext(StatsContext);
  if (!context) {
    throw new Error('useStats must be used within a StatsProvider');
  }
  return context;
}
