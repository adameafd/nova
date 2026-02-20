import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout({ role = 'admin' }) {
  const [collapsed, setCollapsed] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  const toggleSidebar = () => setCollapsed(prev => !prev);

  return (
    <div className="container">
      <Sidebar role={role} collapsed={collapsed} onToggle={toggleSidebar} globalSearch={globalSearch} />
      <main className={`main${collapsed ? ' active' : ''}`} id="main">
        <TopBar onToggle={toggleSidebar} globalSearch={globalSearch} onGlobalSearch={setGlobalSearch} />
        <Outlet context={{ globalSearch }} />
      </main>
    </div>
  );
}
