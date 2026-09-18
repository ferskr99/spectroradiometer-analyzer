import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";

// ─── Code-Splitting: cada vista se carga bajo demanda ───────
// Esto reduce el bundle principal y mejora los tiempos de carga.
const Dashboard = React.lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const HistoryView = React.lazy(() => import("./pages/HistoryView").then(m => ({ default: m.HistoryView })));
const DiagnosticsView = React.lazy(() => import("./pages/DiagnosticsView").then(m => ({ default: m.DiagnosticsView })));
const CalibrationView = React.lazy(() => import("./pages/CalibrationView").then(m => ({ default: m.CalibrationView })));
const ReportsView = React.lazy(() => import("./pages/ReportsView").then(m => ({ default: m.ReportsView })));
const SettingsView = React.lazy(() => import("./pages/SettingsView").then(m => ({ default: m.SettingsView })));

const queryClient = new QueryClient();

// Fallback de carga minimalista
const LoadingFallback = () => (
  <div style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "calc(100vh - 48px)",
    color: "#666",
    fontSize: 13,
    fontFamily: "'Inter', system-ui, sans-serif",
  }}>
    Cargando...
  </div>
);

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="history" element={<HistoryView />} />
              <Route path="diagnostics" element={<DiagnosticsView />} />
              <Route path="calibration" element={<CalibrationView />} />
              <Route path="reports" element={<ReportsView />} />
              <Route path="settings" element={<SettingsView />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
