import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { scheduleDailyTokenReset } from "./utils/hospitalUtils";
import { TooltipProvider } from "@/components/ui/tooltip";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
// Index dashboard no longer used; root redirects to /tokens
import NotFound from "./pages/NotFound";
import DoctorPortal from "./components/doctor/DoctorPortal";
import PrescriptionHistory from "./components/doctor/PrescriptionHistory";
// IPD routes are handled via IpdRoutes
import LoginForm from "./components/LoginForm";
import PatientHistory from "./components/PatientHistory";
import LicenseActivation from "./components/LicenseActivation";
import InstallerScreen from './components/InstallerScreen';
import { BedPlan as IpdBedPlan } from '@/components/ipd/BedPlan';
import { PatientList } from './components/ipd/PatientList';
import { IpdAdmissions } from '@/components/ipd/Admissions';
import IpdSchedule from '@/components/ipd/Schedule';
import ReceptionCart from './components/reception/ReceptionCart';
import { IpdDashboard } from '@/components/ipd/IpdDashboard';
import { useNavigate } from 'react-router-dom';
import { IpdRoutes } from './routes/ipdRoutes';
import AdminLayout from '@/layouts/AdminLayout';
import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminUsers from '@/components/admin/AdminUsers';
import IpdSummary from '@/pages/IpdSummary';
import PharmacyApp from '@/Pharmacy pages/Index';
import PharmacyAddInvoicePage from '@/Pharmacy pages/AddInvoicePage';
import PatientPrescription from '@/components/Pharmacy components/PatientPrescription';
import DoctorReferrals from '@/components/lab compoenents/referrals/DoctorReferrals';
import LabApp from '@/lab pages/Index';
import Portal from './pages/Portal';
import FinanceApp from '@/Finance pages/Index';
// Pharmacy module providers
import { AuthProvider as PharmacyAuthProvider } from '@/Pharmacy contexts/AuthContext';
import { AuditLogProvider } from '@/Pharmacy contexts/AuditLogContext';
import { SettingsProvider as PharmacySettingsProvider } from '@/Pharmacy contexts/PharmacySettingsContext';
import { InventoryProvider } from '@/Pharmacy contexts/InventoryContext';
import { DataProvider } from '@/Pharmacy contexts/DataContext';
// Full-screen section components
import TokenGenerator from '@/components/TokenGenerator';
import TodayTokens from '@/components/TodayTokens';
import PatientSearch from '@/components/PatientSearch';
import DoctorManagement from '@/components/DoctorManagement';
import UsersManagement from '@/components/UsersManagement';
import Reports from '@/components/Reports';
import Backup from '@/components/Backup';
import SettingsPage from '@/components/Settings';
import TokenHistory from '@/components/TokenHistory';
import DepartmentOverview from '@/components/DepartmentOverview';
import CorporatePanelsPage from '@/pages/corporate/Panels';
import CorporateTransactionsPage from '@/pages/corporate/Transactions';
import CorporateDashboardPage from '@/pages/corporate/Dashboard';
import DailyViewPage from '@/pages/staff/DailyView';
import MonthlyViewPage from '@/pages/staff/MonthlyView';
import StaffManagementPage from '@/pages/staff/StaffManagement';
import StaffSettingsPage from '@/pages/staff/Settings';
import AuditPage from '@/pages/Audit';
// Corporate portal removed
// Simple form components (user-requested direct components)
import DischargedComp from '@/components/Discharged';
import ReceivedDeath from '@/components/receive death';
import ShortStay from '@/components/short stay';
import DeathForm from '@/components/death form';
// Staff module removed

// Role-based guard: unauthenticated -> /login, unauthorized -> fallback (default '/tokens')
const RequireAuth = ({ children, roles, fallback = '/tokens' }: { children: React.ReactNode, roles: string[], fallback?: string }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={fallback} replace />;
  return children;
};

const queryClient = new QueryClient();

// Secure license key validation for Mindspire signed keys


function base64urlDecode(input: string): string {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4) input += '=';
  // Use atob for browser compatibility
  return decodeURIComponent(escape(window.atob(input)));
}

async function verifySignature(encoded: string, signature: string): Promise<boolean> {
  const secret = 'mindspire-2025-secure-secret'; // Must match keygen_signed.js
  const enc = new TextEncoder();
  const key = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  const sigBuf = await window.crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(encoded)
  );
  const hex = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 16) === signature;
}

async function validateSignedLicenseKey(key: string): Promise<boolean> {
  const match = key.match(/^mindspire-(.+)-([a-f0-9]{16})$/);
  if (!match) return false;
  const encoded = match[1];
  const signature = match[2];
  return await verifySignature(encoded, signature);
}

const isLicenseActivated = async () => {
  const key = localStorage.getItem('licenseKey');
  return !!(key && await validateSignedLicenseKey(key));
};

const AppContent = () => {
  const [checking, setChecking] = React.useState(true);
  const [activated, setActivated] = React.useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const SHOW_CORPORATE = false;

  React.useEffect(() => {
    (async () => {
      const valid = await isLicenseActivated();
      setActivated(valid);
      setChecking(false);
      // Do not force navigate to portal; respect the current route (e.g., module login pages)
    })();
  }, [isAuthenticated]);

  if (checking) {
    return <div className="flex items-center justify-center min-h-screen">Checking license...</div>;
  }

  if (!activated) {
    return <LicenseActivation />;
  }
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<Portal />} />
        {/* Pharmacy: Add Invoice (unauthenticated renders within pharmacy providers) */}
        <Route
          path="/pharmacy/invoices/new"
          element={
            <PharmacySettingsProvider>
              <PharmacyAuthProvider>
                <AuditLogProvider>
                  <DataProvider>
                    <InventoryProvider>
                      <PharmacyAddInvoicePage />
                    </InventoryProvider>
                  </DataProvider>
                </AuditLogProvider>
              </PharmacyAuthProvider>
            </PharmacySettingsProvider>
          }
        />
        <Route
          path="/pharmacy/*"
          element={
            <PharmacySettingsProvider>
              <PharmacyAuthProvider>
                <AuditLogProvider>
                  <DataProvider>
                    <InventoryProvider>
                      {/* Pharmacy module handles its own login UI */}
                      <PharmacyApp />
                    </InventoryProvider>
                  </DataProvider>
                </AuditLogProvider>
              </PharmacyAuthProvider>
            </PharmacySettingsProvider>
          }
        />
        {/* Pharmacy: Patient Prescription intake (unauthenticated/global) */}
        <Route
          path="/pharmacy/prescriptions"
          element={
            <PharmacySettingsProvider>
              <PharmacyAuthProvider>
                <AuditLogProvider>
                  <DataProvider>
                    <InventoryProvider>
                      <PatientPrescription />
                    </InventoryProvider>
                  </DataProvider>
                </AuditLogProvider>
              </PharmacyAuthProvider>
            </PharmacySettingsProvider>
          }
        />
        {/* Direct lab referrals page (unauthenticated fallback) */}
        <Route path="/lab/doctor-referrals" element={<AdminLayout><DoctorReferrals /></AdminLayout>} />
        <Route path="/login" element={<LoginForm />} />
        {/* Reception module uses hospital login */}
        <Route path="/reception/login" element={<LoginForm />} />
        {/* Future modules */}
        <Route path="/lab/login" element={<LabApp />} />
        <Route path="/finance/*" element={<FinanceApp />} />
        <Route path="*" element={<Portal />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Portal />} />
      {/* When already authenticated, visiting /reception/login should redirect to /reception */}
      <Route path="/reception/login" element={<Navigate to="/reception" replace />} />
      
      {/* Pharmacy: Add Invoice (authenticated renders within providers; AdminLayout not needed since page has its own sidebar) */}
      <Route
        path="/pharmacy/invoices/new"
        element={
          <PharmacySettingsProvider>
            <PharmacyAuthProvider>
              <AuditLogProvider>
                <DataProvider>
                  <InventoryProvider>
                    <PharmacyAddInvoicePage />
                  </InventoryProvider>
                </DataProvider>
              </AuditLogProvider>
            </PharmacyAuthProvider>
          </PharmacySettingsProvider>
        }
      />
      <Route path="/patient-history" element={<PatientHistory />} />
      <Route path="/prescriptions-history" element={<PrescriptionHistory />} />
      <Route path="/doctor" element={<DoctorPortal />} />
      <Route 
        path="/reception" 
        element={<Navigate to="/tokens" replace />} 
      />
      <Route 
        path="/reception/cart" 
        element={(user?.role === 'receptionist' || user?.role === 'admin') ? <AdminLayout><ReceptionCart /></AdminLayout> : <Navigate to="/reception/login" />} 
      />
      <Route path="/ipd/*" element={<RequireAuth roles={['admin','ipd']} fallback="/tokens"><IpdRoutes /></RequireAuth>} />
      {/* Pharmacy module rendered inside AdminLayout so Admin sidebar is visible */}
      <Route
        path="/pharmacy/*"
        element={
          <AdminLayout>
            <PharmacySettingsProvider>
              <PharmacyAuthProvider>
                <AuditLogProvider>
                  {/* DataProvider must come after AuditLogProvider because it calls useAuditLog */}
                  <DataProvider>
                    <InventoryProvider>
                      <PharmacyApp />
                    </InventoryProvider>
                  </DataProvider>
                </AuditLogProvider>
              </PharmacyAuthProvider>
            </PharmacySettingsProvider>
          </AdminLayout>
        }
      />
      {/* Pharmacy: Patient Prescription intake */}
      <Route
        path="/pharmacy/prescriptions"
        element={
          <AdminLayout>
            <PharmacySettingsProvider>
              <PharmacyAuthProvider>
                <AuditLogProvider>
                  <DataProvider>
                    <InventoryProvider>
                      <PatientPrescription />
                    </InventoryProvider>
                  </DataProvider>
                </AuditLogProvider>
              </PharmacyAuthProvider>
            </PharmacySettingsProvider>
          </AdminLayout>
        }
      />
      {/* Lab module rendered inside AdminLayout so Admin sidebar is visible */}
      <Route
        path="/lab/*"
        element={
          <AdminLayout>
            <LabApp />
          </AdminLayout>
        }
      />
      {/* Direct lab referrals page */}
      <Route path="/lab/doctor-referrals" element={<AdminLayout><DoctorReferrals /></AdminLayout>} />
      {/* Finance portal manages its own auth and layout */}
      <Route path="/finance/*" element={<FinanceApp />} />
      {/* Direct component forms (opened from IPD Discharge Actions) */}
      <Route path="/forms" element={<AdminLayout><Outlet /></AdminLayout>}>
        <Route path="discharged" element={<DischargedComp />} />
        <Route path="received-death" element={<ReceivedDeath />} />
        <Route path="short-stay" element={<ShortStay />} />
        <Route path="death-cert" element={<DeathForm />} />
      </Route>
      {/* Full-screen dashboard sections under AdminLayout */}
      <Route path="/tokens" element={<AdminLayout><TokenGenerator /></AdminLayout>} />
      <Route path="/today-tokens" element={<AdminLayout><TodayTokens /></AdminLayout>} />
      <Route path="/token-history" element={<AdminLayout><TokenHistory /></AdminLayout>} />
      <Route path="/departments" element={<AdminLayout><DepartmentOverview /></AdminLayout>} />
      <Route path="/search" element={<AdminLayout><PatientSearch /></AdminLayout>} />
      <Route path="/doctors" element={<AdminLayout><DoctorManagement /></AdminLayout>} />
      <Route path="/users" element={<AdminLayout><UsersManagement /></AdminLayout>} />
      <Route path="/reports" element={<AdminLayout><Reports /></AdminLayout>} />
      <Route path="/expenses" element={<AdminLayout><Reports initialTab="expenses" /></AdminLayout>} />
      {/* Staff routes split into four pages */}
      <Route path="/staff" element={<RequireAuth roles={['admin']} fallback="/tokens"><Navigate to="/staff/daily" replace /></RequireAuth>} />
      <Route path="/staff/daily" element={<RequireAuth roles={['admin']} fallback="/tokens"><AdminLayout><DailyViewPage /></AdminLayout></RequireAuth>} />
      <Route path="/staff/monthly" element={<RequireAuth roles={['admin']} fallback="/tokens"><AdminLayout><MonthlyViewPage /></AdminLayout></RequireAuth>} />
      <Route path="/staff/management" element={<RequireAuth roles={['admin']} fallback="/tokens"><AdminLayout><StaffManagementPage /></AdminLayout></RequireAuth>} />
      <Route path="/staff/settings" element={<RequireAuth roles={['admin']} fallback="/tokens"><AdminLayout><StaffSettingsPage /></AdminLayout></RequireAuth>} />
      {/* Backwards compatibility */}
      <Route path="/staff-attendance" element={<Navigate to="/staff/daily" replace />} />
      <Route path="/audit" element={<AdminLayout><AuditPage /></AdminLayout>} />
      <Route path="/backup" element={<AdminLayout><Backup /></AdminLayout>} />
      <Route path="/settings" element={<AdminLayout><SettingsPage /></AdminLayout>} />
      {SHOW_CORPORATE && (
        <>
          <Route path="/corporate" element={<Navigate to="/corporate/dashboard" replace />} />
          <Route path="/corporate/dashboard" element={<AdminLayout><CorporateDashboardPage /></AdminLayout>} />
          <Route path="/corporate/panels" element={<AdminLayout><CorporatePanelsPage /></AdminLayout>} />
          <Route path="/corporate/transactions" element={<AdminLayout><CorporateTransactionsPage /></AdminLayout>} />
        </>
      )}
      {/* Staff portal removed */}
      {/* Corporate portal removed */}
      <Route path="/admin" element={<AdminLayout><Outlet /></AdminLayout>}>
        <Route path="ipd" element={<RequireAuth roles={['admin']}><Navigate to="/ipd" replace /></RequireAuth>} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="ipd-summary" element={<RequireAuth roles={['admin']}><IpdSummary /></RequireAuth>} />
      </Route>
      {/* Standalone invoice route removed with Corporate portal */}
      <Route path="/login" element={<LoginForm />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

import InstallLocationScreen from './components/InstallLocationScreen';

const App = () => {
  const [installerComplete, setInstallerComplete] = React.useState(
    !!localStorage.getItem('installerComplete')
  );
  const [installerStep, setInstallerStep] = React.useState<'welcome' | 'location' | 'done'>(
    installerComplete ? 'done' : 'welcome'
  );

  React.useEffect(() => {
    scheduleDailyTokenReset();
  }, []);

  const handleInstallerWelcomeComplete = () => {
    setInstallerStep('location');
  };

  const handleInstallerLocationComplete = () => {
    localStorage.setItem('installerComplete', 'true');
    setInstallerComplete(true);
    setInstallerStep('done');
    window.location.reload();
  };

  if (!installerComplete) {
    if (installerStep === 'welcome') {
      return <InstallerScreen onComplete={handleInstallerWelcomeComplete} />;
    }
    if (installerStep === 'location') {
      return <InstallLocationScreen onComplete={handleInstallerLocationComplete} />;
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
