import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout({ role = 'admin' }) {
  const [collapsed, setCollapsed] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  const toggleSidebar = () => setCollapsed(prev => !prev);

  // Lock body scroll when mobile sidebar is open
  // On mobile: collapsed=true means sidebar is visible (`.active` class shows it)
  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    if (collapsed && isMobile) {
      document.body.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
    }
    return () => document.body.classList.remove('sidebar-open');
  }, [collapsed]);

  // On resize to desktop, remove scroll lock (sidebar state is unrelated on desktop)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        document.body.classList.remove('sidebar-open');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="container">
      <Sidebar role={role} collapsed={collapsed} onToggle={toggleSidebar} globalSearch={globalSearch} />
      {/* Overlay: dark backdrop behind sidebar on mobile, click to close */}
      <div className="sidebar-overlay" onClick={toggleSidebar} />
      <main className={`main${collapsed ? ' active' : ''}`} id="main">
        <TopBar onToggle={toggleSidebar} globalSearch={globalSearch} onGlobalSearch={setGlobalSearch} />
        <Outlet context={{ globalSearch }} />
      </main>
    </div>
  );
}
