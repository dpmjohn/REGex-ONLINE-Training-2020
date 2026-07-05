import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Shell from "@/components/Shell";
import Dashboard from "@/pages/Dashboard";
import Signals from "@/pages/Signals";
import Portfolio from "@/pages/Portfolio";
import Watchlist from "@/pages/Watchlist";
import Heatmap from "@/pages/Heatmap";
import Journal from "@/pages/Journal";
import Performance from "@/pages/Performance";
import News from "@/pages/News";
import Paper from "@/pages/Paper";

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/signals" element={<Signals />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/paper" element={<Paper />} />
            <Route path="/heatmap" element={<Heatmap />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/performance" element={<Performance />} />
            <Route path="/news" element={<News />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}
