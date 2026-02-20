import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth, resolvePhotoUrl } from '../context/AuthContext';
import ProfileModal from './ProfileModal';

export default function TopBar({ onToggle, globalSearch, onGlobalSearch }) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef(null);
  const userBtnRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          userBtnRef.current && !userBtnRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <button className="toggle" id="toggle" onClick={onToggle}>
            <i className="fa-solid fa-bars"></i>
          </button>
        </div>

        <div className="topbar-search">
          <input
            type="text"
            placeholder="Rechercher..."
            value={globalSearch || ''}
            onChange={e => onGlobalSearch && onGlobalSearch(e.target.value)}
          />
        </div>

        <div className="user-area">
          <div
            className="user-info"
            ref={userBtnRef}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <img src={resolvePhotoUrl(user?.photo_url)} alt="user" />
            <span>{user?.nom || 'Utilisateur'}</span>
            <i className="fa-solid fa-caret-down" style={{ color: 'var(--muted)' }}></i>
          </div>

          <div className={`user-dropdown${dropdownOpen ? ' show' : ''}`} ref={dropdownRef}>
            <div className="item" onClick={() => { setProfileOpen(true); setDropdownOpen(false); }}>
              <i className="fa-regular fa-user"></i> Profil
            </div>
            <div className="sep"></div>
            <div className="theme-toggle">
              <span><i className="fa-regular fa-moon"></i> Mode sombre</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={theme === 'dark'}
                  onChange={toggleTheme}
                />
                <span className="slider"></span>
              </label>
            </div>
            <div className="sep"></div>
            <div className="item" onClick={handleLogout}>
              <i className="fa-solid fa-right-from-bracket"></i> Déconnexion
            </div>
          </div>
        </div>
      </header>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}
