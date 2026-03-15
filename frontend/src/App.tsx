import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Routes, Route, useNavigate, useLocation, Navigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, ShieldOff } from 'lucide-react';

import Sidebar from './components/Sidebar';
import CopilotDialog from './components/CopilotDialog';
import { ToastContainer } from './components/ToastContainer';
import ErrorBoundary from './components/ErrorBoundary';

import LoginView from './views/LoginView';
import AuthCallbackView from './views/AuthCallbackView';
import AdminUsersView from './views/AdminUsersView';
import AdminDictionaryView from './views/AdminDictionaryView';
import FeatureFlagsView from './views/FeatureFlagsView';
import CRMView from './views/CRMView';
import CustomerDetailView from './views/CustomerDetailView';
import CustomerPortraitView from './views/CustomerPortraitView';
import SurveySessionsView from './views/SurveySessionsView';
import SurveyTemplatesView from './views/SurveyTemplatesView';
import SurveyTemplateEditorView from './views/SurveyTemplateEditorView';
import SurveyWorkspaceView from './views/SurveyWorkspaceView';
import SurveyInsightsView from './views/SurveyInsightsView';
import CaseLibraryView from './views/CaseLibraryView';
import ExpertWorkbenchView from './views/ExpertWorkbenchView';
import MemoryManagementView from './views/MemoryManagementView';
import TenantsListView from './views/TenantsListView';
import AuditLogsView from './views/AuditLogsView';

import { type ViewType, type TemplatePayload, type UserRole } from './types';
import { useAuthStore } from './stores/authStore';
import { authApi } from './services/auth';

// ── Route → ViewType mapping ──

function pathnameToViewType(pathname: string): ViewType {
  if (pathname === '/admin/users') return 'admin-users';
  if (pathname === '/admin/dictionary') return 'admin-dictionary';
  if (pathname === '/admin/settings') return 'admin-settings';
  if (pathname === '/admin/tenants') return 'admin-tenants';
  if (pathname === '/admin/audit-logs') return 'admin-audit-logs';
  if (pathname === '/sessions/templates' ) return 'survey-templates';
  if (/^\/sessions\/templates\/.+$/.test(pathname)) return 'survey-template-editor';
  if (pathname === '/sessions') return 'survey-sessions';
  if (/^\/sessions\/.+\/workspace$/.test(pathname)) return 'survey-workspace';
  if (/^\/sessions\/.+\/insights$/.test(pathname)) return 'survey-insights';
  if (pathname === '/cases') return 'case-library';
  if (pathname === '/expert') return 'expert-pending';
  if (pathname === '/settings') return 'settings';
  if (pathname === '/crm' || pathname.startsWith('/crm/')) return 'crm';
  return 'admin-users';
}

// ── Protected route guard ──

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// ── Role guard ──

function RoleGuard({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}) {
  const user = useAuthStore((s) => s.user);
  if (!user || !allowedRoles.includes(user.role as UserRole)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
}

// ── Role-based redirect for root path ──

function RoleBasedRedirect() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin/users" replace />;
  if (user.role === 'EXPERT') return <Navigate to="/crm" replace />;
  return <Navigate to="/crm" replace />;
}

// ── Unauthorized page ──

function UnauthorizedPage() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] gap-4">
      <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
        <ShieldOff className="w-8 h-8 text-red-400" />
      </div>
      <h2 className="text-xl font-bold text-slate-900">无访问权限</h2>
      <p className="text-slate-500 text-sm">你没有权限访问此页面</p>
      <button
        onClick={() => navigate(-1)}
        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
      >
        返回上一页
      </button>
    </div>
  );
}

// ── Wrapper components that bridge old onViewChange prop API to React Router ──

function CRMViewWrapper() {
  const navigate = useNavigate();
  const handleViewChange = (view: ViewType, data?: unknown) => {
    const d = data as { customerId?: string } | undefined;
    if (view === 'crm' && d?.customerId) {
      navigate(`/crm/${d.customerId}`);
    } else if (view === 'customer-portrait') {
      navigate(`/crm/${d?.customerId ?? 'C-001'}/portrait`);
    } else {
      const routeMap: Partial<Record<ViewType, string>> = {
        'crm': '/crm',
        'survey-workspace': '/sessions',
        'survey-sessions': '/sessions',
        'survey-templates': '/sessions/templates',
      };
      const route = routeMap[view];
      if (route) navigate(route);
    }
  };
  return <CRMView onViewChange={handleViewChange} />;
}

function CustomerDetailWrapper() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const handleViewChange = (view: ViewType, _data?: unknown) => {
    if (view === 'customer-portrait') {
      navigate(`/crm/${customerId}/portrait`);
    } else if (view === 'crm') {
      navigate('/crm');
    }
  };
  return (
    <CustomerDetailView
      customerId={customerId ?? 'C-001'}
      onBack={() => navigate('/crm')}
      onViewChange={handleViewChange}
    />
  );
}

function CustomerPortraitWrapper() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const handleViewChange = (view: ViewType, _data?: unknown) => {
    if (view === 'crm') navigate('/crm');
  };
  return (
    <CustomerPortraitView
      customerId={customerId ?? 'C-001'}
      onBack={() => navigate('/crm')}
      onViewChange={handleViewChange}
    />
  );
}

function SurveySessionsWrapper() {
  const navigate = useNavigate();
  const handleViewChange = (view: ViewType, data?: unknown) => {
    const sessionData = data as { sessionId?: string } | undefined;
    if (view === 'survey-workspace') {
      const sessionId = sessionData?.sessionId;
      navigate(sessionId ? `/sessions/${sessionId}/workspace` : '/sessions');
    } else if (view === 'survey-insights') {
      const sessionId = sessionData?.sessionId;
      navigate(sessionId ? `/sessions/${sessionId}/insights` : '/sessions');
    } else if (view === 'survey-sessions') {
      navigate('/sessions');
    } else if (view === 'survey-templates') {
      navigate('/sessions/templates');
    } else if (view === 'survey-template-editor') {
      navigate('/sessions/templates/new', { state: data });
    }
  };
  return <SurveySessionsView onViewChange={handleViewChange} />;
}

function SurveyTemplatesWrapper() {
  const navigate = useNavigate();
  const handleViewChange = (view: ViewType, data?: unknown) => {
    if (view === 'survey-template-editor') {
      navigate('/sessions/templates/new', { state: data ?? null });
    }
  };
  return <SurveyTemplatesView onViewChange={handleViewChange} />;
}

function SurveyTemplateEditorWrapper() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialData = (location.state as TemplatePayload | null) ?? null;
  return (
    <SurveyTemplateEditorView
      onBack={() => navigate('/sessions/templates')}
      initialData={initialData}
    />
  );
}

function SurveyWorkspaceWrapper() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const handleViewChange = (view: ViewType, _data?: unknown) => {
    const routeMap: Partial<Record<ViewType, string>> = {
      'crm': '/crm',
      'survey-sessions': '/sessions',
      'survey-insights': `/sessions/${id}/insights`,
    };
    const route = routeMap[view];
    if (route) navigate(route);
  };
  return (
    <SurveyWorkspaceView
      onBack={() => navigate('/sessions')}
      onViewChange={handleViewChange}
    />
  );
}

// ── Animated page wrapper ──

function AnimatedPage({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ── Full-screen routes (no sidebar) ──

function LoginWrapper() {
  return <LoginView />;
}

function shouldHideHeader(pathname: string) {
  return (
    pathname.includes('/workspace') ||
    pathname.includes('/portrait') ||
    pathname === '/sessions/templates/new' ||
    /\/sessions\/templates\/[^/]+$/.test(pathname)
  );
}

// ── Main layout (sidebar + header + content) ──

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  // User menu state
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click outside handler to close menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  // Logout handler
  const handleLogout = async () => {
    setShowUserMenu(false);
    try {
      await authApi.logout();
    } catch {
      // Ignore server errors during logout
    }
    useAuthStore.getState().clearAuth();
    navigate('/login');
  };

  // Helper function to map role to Chinese display text
  const getRoleDisplayName = (role: string): string => {
    switch (role) {
      case 'ADMIN': return '超级管理员';
      case 'SALES': return '销售专员';
      case 'EXPERT': return '专家顾问';
      default: return '用户';
    }
  };

  const handleViewChange = (view: ViewType, data?: unknown) => {
    const routeMap: Partial<Record<ViewType, string>> = {
      'login': '/login',
      'admin-users': '/admin/users',
      'admin-dictionary': '/admin/dictionary',
      'admin-settings': '/admin/settings',
      'admin-tenants': '/admin/tenants',
      'admin-audit-logs': '/admin/audit-logs',
      'crm': '/crm',
      'survey-sessions': '/sessions',
      'survey-templates': '/sessions/templates',
      'survey-template-editor': '/sessions/templates/new',
      'survey-workspace': '/sessions',
      'survey-insights': '/sessions',
      'case-library': '/cases',
      'expert-pending': '/expert',
      'settings': '/settings',
    };
    const route = routeMap[view];
    if (route) {
      navigate(route, { state: data ?? null });
    }
  };

  const hideHeader = shouldHideHeader(location.pathname);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar currentView={pathnameToViewType(location.pathname)} onViewChange={handleViewChange} />

      <main className="flex-1 overflow-y-auto h-screen">
        {!hideHeader && (
          <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 px-8 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="font-medium text-slate-400">系统</span>
              <span className="text-slate-300">/</span>
              <span className="font-bold text-slate-900 capitalize">
                {location.pathname.replace(/^\//, '').replace(/\//g, ' / ')}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-slate-600">系统在线</span>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-all">
                <AlertCircle className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
              </button>
              <div className="flex items-center gap-3 pl-2 relative">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-900 leading-none">
                    {user?.displayName || '用户'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {user?.role ? getRoleDisplayName(user.role) : '未知角色'}
                  </p>
                </div>
                <div
                  className="w-8 h-8 rounded-lg border border-slate-200 bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold cursor-pointer hover:bg-indigo-200 transition-colors"
                  onClick={() => setShowUserMenu(v => !v)}
                >
                  {(user?.displayName || 'U')[0].toUpperCase()}
                </div>

                {showUserMenu && (
                  <div ref={menuRef} className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user?.displayName || user?.email}</p>
                      <p className="text-xs text-gray-500">{user?.role ? getRoleDisplayName(user.role) : '未知角色'}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <span>退出登录</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        <ErrorBoundary>
        <AnimatedPage>
          <Routes>
            <Route index element={<RoleBasedRedirect />} />
            <Route path="unauthorized" element={<UnauthorizedPage />} />

            {/* ADMIN + EXPERT routes */}
            <Route
              path="admin/users"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'EXPERT']}>
                  <AdminUsersView />
                </RoleGuard>
              }
            />
            <Route
              path="admin/dictionary"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'EXPERT']}>
                  <AdminDictionaryView />
                </RoleGuard>
              }
            />
            <Route
              path="admin/settings"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'EXPERT']}>
                  <FeatureFlagsView />
                </RoleGuard>
              }
            />
            <Route
              path="admin/tenants"
              element={
                <RoleGuard allowedRoles={['ADMIN']}>
                  <TenantsListView />
                </RoleGuard>
              }
            />
            <Route
              path="admin/audit-logs"
              element={
                <RoleGuard allowedRoles={['ADMIN']}>
                  <AuditLogsView />
                </RoleGuard>
              }
            />

            {/* ADMIN + SALES + EXPERT routes */}
            <Route
              path="crm"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'SALES', 'EXPERT']}>
                  <CRMViewWrapper />
                </RoleGuard>
              }
            />
            <Route
              path="crm/:customerId"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'SALES', 'EXPERT']}>
                  <CustomerDetailWrapper />
                </RoleGuard>
              }
            />
            <Route
              path="crm/:customerId/portrait"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'SALES', 'EXPERT']}>
                  <CustomerPortraitWrapper />
                </RoleGuard>
              }
            />
            <Route
              path="sessions"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'SALES', 'EXPERT']}>
                  <SurveySessionsWrapper />
                </RoleGuard>
              }
            />
            <Route
              path="sessions/:id/workspace"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'SALES', 'EXPERT']}>
                  <SurveyWorkspaceWrapper />
                </RoleGuard>
              }
            />
            <Route
              path="sessions/:id/insights"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'SALES', 'EXPERT']}>
                  <SurveyInsightsView />
                </RoleGuard>
              }
            />
            <Route
              path="sessions/templates"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'SALES', 'EXPERT']}>
                  <SurveyTemplatesWrapper />
                </RoleGuard>
              }
            />
            <Route
              path="sessions/templates/new"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'SALES', 'EXPERT']}>
                  <SurveyTemplateEditorWrapper />
                </RoleGuard>
              }
            />
            <Route
              path="sessions/templates/:id"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'SALES', 'EXPERT']}>
                  <SurveyTemplateEditorWrapper />
                </RoleGuard>
              }
            />
            <Route
              path="cases"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'SALES', 'EXPERT']}>
                  <CaseLibraryView />
                </RoleGuard>
              }
            />

            {/* ADMIN + EXPERT routes */}
            <Route
              path="expert"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'EXPERT']}>
                  <ExpertWorkbenchView />
                </RoleGuard>
              }
            />

            {/* All roles */}
            <Route
              path="settings"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'SALES', 'EXPERT']}>
                  <MemoryManagementView />
                </RoleGuard>
              }
            />

            <Route path="*" element={<RoleBasedRedirect />} />
          </Routes>
        </AnimatedPage>
        </ErrorBoundary>
      </main>

      <CopilotDialog />
    </div>
  );
}

// ── Root App ──

const App: React.FC = () => {
  const { isLoggedIn, accessToken, refreshToken, user, setAuth, clearAuth } = useAuthStore();
  const [authRestored, setAuthRestored] = useState(false);

  // On page refresh: isLoggedIn + refreshToken are persisted, but accessToken is memory-only.
  // Silently exchange refreshToken for a new accessToken before rendering protected routes.
  useEffect(() => {
    if (isLoggedIn && !accessToken && refreshToken && user) {
      axios.post<{ accessToken: string; refreshToken: string }>(
        '/api/v1/auth/refresh',
        { refreshToken },
      )
        .then(({ data }) => {
          setAuth(user, data.accessToken, data.refreshToken);
        })
        .catch(() => {
          // Refresh token expired or revoked — force re-login
          clearAuth();
        })
        .finally(() => {
          setAuthRestored(true);
        });
    } else {
      setAuthRestored(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prevent flash-redirect to /login while token is being restored
  if (!authRestored) return null;

  return (
    <>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackView />} />
        <Route path="/login" element={<LoginWrapper />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
      <ToastContainer />
    </>
  );
};

export default App;
