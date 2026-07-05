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
};
