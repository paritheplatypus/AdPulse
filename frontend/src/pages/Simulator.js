import React, { useState, useRef } from 'react';
import { createSession, getNextAd, expireSession } from '../services/api';

const CATEGORY_COLORS = {
  technology: 'badge-blue',
  food_beverage: 'badge-green',
  automotive: 'badge-amber',
  entertainment: 'badge-purple',
  finance: 'badge-gray',
  health_wellness: 'badge-green',
  retail: 'badge-amber',
};

const computeLocalDiversity = (history) => {
  if (history.length < 2) return 1;
  let repeats = 0;
  const advertisers = new Set();
  for (let i = 0; i < history.length; i++) {
    advertisers.add(history[i].ad.advertiser);
    if (i > 0 && history[i].ad.id === history[i - 1].ad.id) repeats++;
  }
  const repeatPenalty = repeats / (history.length - 1);
  const advDiversity = advertisers.size / history.length;
  return Math.max(0, Math.min(1, advDiversity - repeatPenalty));
};

export default function Simulator() {
  const [userId, setUserId] = useState('viewer_' + Math.random().toString(36).slice(2, 7));
  const [sessionId, setSessionId] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | active | ended
  const autoRef = useRef(null);
  const feedRef = useRef(null);

  const startSession = async () => {
    setLoading(true);
    try {
      const { sessionId: sid } = await createSession(userId);
      setSessionId(sid);
      setHistory([]);
      setStatus('active');
    } catch (e) {
      alert('Could not connect to backend. Make sure Docker is running.');
    } finally {
      setLoading(false);
    }
  };

  const fetchNextAd = async (sid) => {
    const data = await getNextAd(sid || sessionId);
    const entry = { ad: data.ad, meta: data.meta, id: Date.now() };
    setHistory(h => {
      const next = [...h, entry];
      setTimeout(() => {
        feedRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
      return next;
    });
    return entry;
  };

  const handleNextAd = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      await fetchNextAd();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoRun = () => {
    if (autoRunning) {
      clearInterval(autoRef.current);
      setAutoRunning(false);
      return;
    }
    setAutoRunning(true);
    autoRef.current = setInterval(async () => {
      try {
        await fetchNextAd();
      } catch {
        clearInterval(autoRef.current);
        setAutoRunning(false);
      }
    }, 1200);
  };

  const handleEndSession = async () => {
    clearInterval(autoRef.current);
    setAutoRunning(false);
    if (sessionId) await expireSession(sessionId);
    setStatus('ended');
    setSessionId(null);
  };

  const handleReset = () => {
    setHistory([]);
    setStatus('idle');
    setSessionId(null);
    setUserId('viewer_' + Math.random().toString(36).slice(2, 7));
  };

  const diversity = computeLocalDiversity(history);
  const diversityPct = (diversity * 100).toFixed(0);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Ad Delivery Simulator</div>
        <div className="page-subtitle">
          Simulate a viewing session to see AdPulse's selection algorithm in action
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Session Controls</span>
              {sessionId && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                  {sessionId.slice(0, 12)}…
                </span>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Viewer ID</div>
              <input
                className="input"
                value={userId}
                onChange={e => setUserId(e.target.value)}
                disabled={status === 'active'}
                placeholder="viewer_id"
              />
            </div>

            {status === 'idle' && (
              <button className="btn btn-primary" onClick={startSession} disabled={loading} style={{ width: '100%' }}>
                {loading ? 'Connecting…' : '▶ Start Session'}
              </button>
            )}

            {status === 'active' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={handleNextAd} disabled={loading || autoRunning} style={{ flex: 1 }}>
                    Next Ad
                  </button>
                  <button
                    className={`btn ${autoRunning ? 'btn-danger' : 'btn-ghost'}`}
                    onClick={handleAutoRun}
                    style={{ flex: 1 }}
                  >
                    {autoRunning ? '⏹ Stop Auto' : '⏩ Auto Run'}
                  </button>
                </div>
                <button className="btn btn-ghost" onClick={handleEndSession} style={{ width: '100%' }}>
                  End Session
                </button>
              </div>
            )}

            {status === 'ended' && (
              <button className="btn btn-primary" onClick={handleReset} style={{ width: '100%' }}>
                New Session
              </button>
            )}
          </div>

          {/* Live stats */}
          {history.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Session Stats</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <div className="stat-label">Ads Served</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--text-primary)' }}>
                    {history.length}
                  </div>
                </div>
                <div>
                  <div className="stat-label">Unique Advertisers</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--text-primary)' }}>
                    {new Set(history.map(h => h.ad.advertiser)).size}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="stat-label">Diversity Score</span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 13,
                    color: diversity > 0.7 ? 'var(--accent)' : diversity > 0.4 ? 'var(--amber)' : 'var(--red)'
                  }}>
                    {diversityPct}%
                  </span>
                </div>
                <div className="diversity-bar">
                  <div className="diversity-fill" style={{
                    width: `${diversityPct}%`,
                    background: diversity > 0.7 ? 'var(--accent)' : diversity > 0.4 ? 'var(--amber)' : 'var(--red)',
                  }} />
                </div>
              </div>
            </div>
          )}

          {/* Algorithm explanation */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">How the Algorithm Works</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'No consecutive repeats', desc: 'Same ad never served back-to-back', color: 'var(--accent)' },
                { label: 'Frequency cap', desc: 'Per-advertiser limit per session', color: 'var(--blue)' },
                { label: 'Category diversity', desc: 'Rotates ad categories', color: 'var(--purple)' },
                { label: 'Recency penalty', desc: 'Penalizes recently shown ads', color: 'var(--amber)' },
                { label: 'Weighted random', desc: 'Score-proportional selection', color: 'var(--red)' },
              ].map(({ label, desc, color }) => (
                <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ad feed */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Ad Delivery Feed</span>
            {autoRunning && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--accent)' }}>
                <span className="status-dot" style={{ width: 5, height: 5 }} /> Live
              </span>
            )}
          </div>

          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              {status === 'idle' ? 'Start a session to begin' : 'Click "Next Ad" to serve the first ad'}
            </div>
          ) : (
            <div className="sim-feed" ref={feedRef}>
              {history.map((entry, i) => (
                <div key={entry.id} className={`sim-item ${i === history.length - 1 ? 'new' : ''}`}>
                  <div className="sim-position">{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div className="sim-ad-title">{entry.ad.title}</div>
                    <div className="sim-advertiser">{entry.ad.advertiser} · {entry.ad.duration_seconds}s</div>
                  </div>
                  <span className={`badge ${CATEGORY_COLORS[entry.ad.category] || 'badge-gray'}`}>
                    {entry.ad.category?.replace('_', ' ')}
                  </span>
                  {entry.meta?.selectionReason === 'frequency_cap_relaxed' && (
                    <span className="badge badge-amber" title="Frequency cap was relaxed">⚠</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
