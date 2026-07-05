import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, timeout: 60000 });

export const endpoints = {
  scanStatus: () => api.get("/scan/status"),
  runScan: () => api.post("/scan/run"),
  signals: (params = {}) => api.get("/signals", { params }),
  highConviction: () => api.get("/signals/high-conviction"),
  stock: (symbol) => api.get(`/stock/${encodeURIComponent(symbol)}`),
  aiAnalysis: (symbol) => api.post(`/stock/${encodeURIComponent(symbol)}/analyze`),
  heatmap: () => api.get("/market/heatmap"),
  marketTrend: () => api.get("/market/trend"),
  news: () => api.get("/news"),
  watchlist: () => api.get("/watchlist"),
  addWatchlist: (symbol) => api.post("/watchlist", { symbol }),
  removeWatchlist: (symbol) => api.delete(`/watchlist/${encodeURIComponent(symbol)}`),
  trades: (status) => api.get("/trades", { params: status ? { status } : {} }),
  createTrade: (payload) => api.post("/trades", payload),
  closeTrade: (id, exit_price, notes) => api.post(`/trades/${id}/close`, { exit_price, notes }),
  deleteTrade: (id) => api.delete(`/trades/${id}`),
  portfolio: () => api.get("/portfolio"),
  universe: () => api.get("/universe"),
  // Paper trading
  paperPortfolio: () => api.get("/paper/portfolio"),
  paperTrades: (status) => api.get("/paper/trades", { params: status ? { status } : {} }),
  paperClose: (id, exit_price) => api.post(`/paper/trades/${id}/close`, { exit_price }),
  paperReset: () => api.post("/paper/reset"),
  paperSimulate: () => api.post("/paper/simulate-scan"),
  // Alerts
  alerts: (unread_only) => api.get("/alerts", { params: unread_only ? { unread_only: true } : {} }),
  markAlertRead: (id) => api.post(`/alerts/${id}/read`),
  markAllRead: () => api.post("/alerts/read-all"),
  schedulerStatus: () => api.get("/scheduler/status"),
};
