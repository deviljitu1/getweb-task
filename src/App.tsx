import { Toaster } from "@/components/ui/toaster";
import { lazy, Suspense } from 'react';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { CallProvider } from "@/components/CallModal";
import { PresenceProvider } from '@/contexts/PresenceContext';
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import OAuthConsent from "@/pages/OAuthConsent";
import WorkspaceLoader from '@/components/WorkspaceLoader';

const queryClient = new QueryClient();
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const TeamWorkspace = lazy(() => import('@/pages/TeamWorkspace'));
const TeamStatus = lazy(() => import('@/pages/TeamStatus'));
const AgencyCRM = lazy(() => import('@/pages/AgencyCRM'));
const Tools = lazy(() => import('@/pages/Tools'));
const Invoices = lazy(() => import('@/pages/Invoices'));
const Finance = lazy(() => import('@/pages/Finance'));
const DailyTools = lazy(() => import('@/pages/DailyTools'));
const Members = lazy(() => import('@/pages/Members'));

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <DataProvider>
          <PresenceProvider>
          <CallProvider>
            <BrowserRouter>
              <Suspense fallback={<WorkspaceLoader />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<Layout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/members" element={<TeamWorkspace />} />
                    <Route path="/team-status" element={<TeamStatus />} />
                    <Route path="/chat" element={<Navigate to="/members" replace />} />
                    <Route path="/tools" element={<Tools />} />
                    <Route element={<ProtectedRoute adminOnly />}>
                      <Route path="/directory" element={<Members />} />
                      <Route path="/crm" element={<AgencyCRM />} />
                      <Route path="/tools/invoices" element={<Invoices />} />
                      <Route path="/tools/finance" element={<Finance />} />
                    </Route>
                    <Route path="/tools/:tool" element={<DailyTools />} />
                  </Route>
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
          </CallProvider>
          </PresenceProvider>
        </DataProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
