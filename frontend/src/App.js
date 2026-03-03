import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Simulator from './pages/Simulator';
import Inventory from './pages/Inventory';
import { getToken } from './services/api';
import './index.css';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '▦' },
  { path: '/simulator', label: 'Ad Simulator', icon: '▶' },
  { path: '/inventory', label: 'Ad Inventory', icon: '≡' },
];

export default function App() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('adpulse_token');
    if (stored) { setAuthed(true); return; }
    getToken('demo_admin').then(({ token }) => {
      localStorage.setItem('adpulse_token', token);
      setAuthed(true);
    }).catch(() => setAuthed(true)); // proceed without token in demo
  }, []);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <span className="brand-icon">◈</span>
            <div>
              <div className="brand-name">AdPulse</div>
              <div className="brand-sub">Frequency Intelligence</div>
            </div>
          </div>
          <nav className="sidebar-nav">
            {NAV_ITEMS.map(({ path, label, icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">{icon}</span>
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="status-dot" />
            <span>System Operational</span>
          </div>
        </aside>
        <main className="main-content">
          {authed ? (
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/simulator" element={<Simulator />} />
              <Route path="/inventory" element={<Inventory />} />
            </Routes>
          ) : (
            <div className="loading-screen">
              <div className="spinner" />
              <p>Connecting to AdPulse...</p>
            </div>
          )}
        </main>
      </div>
    </BrowserRouter>
  );
}
