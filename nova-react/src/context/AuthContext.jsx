import { createContext, useContext, useState } from 'react';
import monkeyDefault from '../assets/monkey.jpeg';

const AuthContext = createContext();

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export const ORIGIN = API_BASE.replace('/api', '');

export function resolvePhotoUrl(photo_url) {
  if (!photo_url) return monkeyDefault;
  if (photo_url.startsWith('/uploads/')) return ORIGIN + photo_url;
  if (photo_url.startsWith('http')) return photo_url;
  return photo_url;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('nova_user'));
    } catch {
      return null;
    }
  });
  const [loggingOut, setLoggingOut] = useState(false);

  const login = (userData) => {
    localStorage.setItem('nova_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    setLoggingOut(true);
    localStorage.removeItem('nova_user');
    setUser(null);
  };

  const finishLogout = () => {
    setLoggingOut(false);
  };

  const updateUser = (userData) => {
    localStorage.setItem('nova_user', JSON.stringify(userData));
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, finishLogout, loggingOut, updateUser, API_BASE, ORIGIN }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
