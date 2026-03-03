import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from 'recharts';
import { getAnalyticsSummary, getTimeseries, getLiveCount } from '../services/api';

const COLORS = ['#4fffb0', '#4f9fff', '#b84fff', '#ffb84f', '#ff4f6b', '#4fffff'];

const CATEGORY_LABELS = {
  technology: 'Technology',
  food_beverage: 'Food & Beverage',
  automotive: 'Automotive',
  entertainment: 'Entertainment',
  finance: 'Finance',
  health_wellness: 'Health & Wellness',
  retail: 'Retail',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: 13, fontFamily: 'var(--font-mono)' }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [timeseries, setTimeseries] = useState([]);
  const [liveCount, setLiveCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, t, lc] = await Promise.all([
        getAnalyticsSummary(),
        getTimeseries(24),
        getLiveCount(),
      ]);
      setSummary(s);
      setTimeseries(t.timeseries || []);
      setLiveCount(lc.liveViewers || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [load]);

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  const avgDiversity = summary?.recentSessions?.length
    ? (summary.recentSessions.reduce((s, r) => s + r.diversityScore, 0) / summary.recentSessions.length * 100).toFixed(0)
    : 0;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Analytics Dashboard</div>
        <div className="page-subtitle">
          Real-time ad delivery intelligence — refreshes every 15s
        </div>
      </div>

      {/* Stat Row */}
      <div className="stat-grid">
        <div className="stat-card green">
          <div className="stat-label">Total Impressions</div>
          <div className="stat-value">{(summary?.totalImpressions || 0).toLocaleString()}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Live Viewers</div>
          <div className="stat-value">{liveCount}</div>
          <div className="stat-sub">Active sessions</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Repetition Rate</div>
          <div className="stat-value">{summary?.repetitionRate ?? 0}%</div>
          <div className="stat-sub">Consecutive repeats</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Avg Diversity Score</div>
          <div className="stat-value">{avgDiversity}%</div>
          <div className="stat-sub">Across recent sessions</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* Impressions over time */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Impressions — Last 24h</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={timeseries}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tickFormatter={(v) => new Date(v).getHours() + 'h'}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="impression_count" stroke="var(--accent)"
                strokeWidth={2} dot={false} name="Impressions" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Category breakdown */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Impressions by Category</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={(summary?.categoryBreakdown || []).map(c => ({
                  ...c,
                  name: CATEGORY_LABELS[c.category] || c.category,
                }))}
                cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                paddingAngle={3} dataKey="impression_count"
              >
                {(summary?.categoryBreakdown || []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Ads Table */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Top Performing Ads</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Ad Title</th>
                <th>Advertiser</th>
                <th>Category</th>
                <th>Impressions</th>
                <th>Unique Sessions</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.topContent || []).map((ad, i) => (
                <tr key={ad.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{i + 1}</td>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{ad.title}</td>
                  <td>{ad.advertiser}</td>
                  <td>
                    <span className="badge badge-blue">
                      {CATEGORY_LABELS[ad.category] || ad.category}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                    {parseInt(ad.impression_count).toLocaleString()}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{ad.unique_sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Session Diversity */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent Session Diversity Scores</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            1.0 = perfect diversity
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(summary?.recentSessions || []).slice(0, 8).map((s) => (
            <div key={s.sessionId}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {s.userId}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {s.impressionCount} ads · score {s.diversityScore.toFixed(2)}
                </span>
              </div>
              <div className="diversity-bar">
                <div
                  className="diversity-fill"
                  style={{
                    width: `${s.diversityScore * 100}%`,
                    background: s.diversityScore > 0.7 ? 'var(--accent)' : s.diversityScore > 0.4 ? 'var(--amber)' : 'var(--red)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
