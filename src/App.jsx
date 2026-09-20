import React, { useState, useEffect } from 'react';
import { StatsProvider } from './context/StatsContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import WaitlistPage from './pages/WaitlistPage';
import CheckerPage from './pages/CheckerPage';
import RoadmapPage from './pages/RoadmapPage';
import FaqPage from './pages/FaqPage';
import AdminPage from './pages/AdminPage';

function getInitialPage() {
  if (typeof window === 'undefined') return 'home';
  const path = window.location.pathname.toLowerCase().replace(/\/$/, '');
  if (path === '/admin') return 'admin';
  if (path === '/waitlist') return 'waitlist';
  if (path === '/checker') return 'checker';
  if (path === '/roadmap') return 'roadmap';
  if (path === '/faq') return 'faq';
  return 'home';
}

export default function App() {
  const [activePage, setActivePage] = useState(getInitialPage);

  // Sync browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setActivePage(getInitialPage());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update browser URL on page change
  const navigate = (pageId) => {
    setActivePage(pageId);
    const targetUrl = pageId === 'home' ? '/' : `/${pageId}`;
    if (window.location.pathname !== targetUrl) {
      window.history.pushState(null, '', targetUrl);
    }
  };

  const isAdminRoute = activePage === 'admin';

  return (
    <StatsProvider>
      <div className="min-h-screen flex flex-col bg-[#0A0B0E] text-white">
        {/* PUBLIC NAVBAR: Shown ONLY for non-admin pages. 
            Strictly contains only: HOME, WAITLIST, WALLET CHECKER, ROADMAP, FAQ.
            Never displays Admin or Dashboard. */}
        {!isAdminRoute && (
          <Navbar activePage={activePage} setActivePage={navigate} />
        )}

        {/* Main Content View */}
        <main className="flex-grow">
          {activePage === 'home' && <HomePage setActivePage={navigate} />}
          {activePage === 'waitlist' && <WaitlistPage setActivePage={navigate} />}
          {activePage === 'checker' && <CheckerPage setActivePage={navigate} />}
          {activePage === 'roadmap' && <RoadmapPage setActivePage={navigate} />}
          {activePage === 'faq' && <FaqPage />}
          {activePage === 'admin' && <AdminPage />}
        </main>

        {/* Public Footer (Never displayed on Admin route) */}
        {!isAdminRoute && (
          <Footer setActivePage={navigate} />
        )}
      </div>
    </StatsProvider>
  );
}
