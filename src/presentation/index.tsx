import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { HistoryView } from "./pages/HistoryView";
import { SettingsView } from "./pages/SettingsView";
import { DiagnosticsView } from "./pages/DiagnosticsView";
import { CalibrationView } from "./pages/CalibrationView";
import { ReportsView } from "./pages/ReportsView";

const queryClient = new QueryClient();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
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
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
