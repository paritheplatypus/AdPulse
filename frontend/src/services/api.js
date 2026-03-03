import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adpulse_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error('API error:', err.response?.data || err.message);
    return Promise.reject(err);
  }
);

// Auth
export const getToken = (userId) =>
  api.post('/auth/token', { userId }).then((r) => r.data);

// Ads
export const getAds = () => api.get('/ads').then((r) => r.data);
export const createAd = (data) => api.post('/ads', data).then((r) => r.data);
export const updateAd = (id, data) => api.patch(`/ads/${id}`, data).then((r) => r.data);
export const deleteAd = (id) => api.delete(`/ads/${id}`).then((r) => r.data);

// Sessions
export const createSession = (userId) =>
  api.post('/sessions', { userId }).then((r) => r.data);
export const getNextAd = (sessionId) =>
  api.post(`/sessions/${sessionId}/next-ad`).then((r) => r.data);
export const getSession = (sessionId) =>
  api.get(`/sessions/${sessionId}`).then((r) => r.data);
export const expireSession = (sessionId) =>
  api.delete(`/sessions/${sessionId}`).then((r) => r.data);
export const getLiveCount = () =>
  api.get('/sessions/live-count').then((r) => r.data);

// Analytics
export const getAnalyticsSummary = () =>
  api.get('/analytics/summary').then((r) => r.data);
export const getTopAds = (limit = 10) =>
  api.get(`/analytics/top-ads?limit=${limit}`).then((r) => r.data);
export const getTimeseries = (hours = 24) =>
  api.get(`/analytics/timeseries?hours=${hours}`).then((r) => r.data);
