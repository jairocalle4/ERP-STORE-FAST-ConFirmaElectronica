import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useThemeStore } from './store/useThemeStore';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProductListPage from './pages/ProductListPage';
import ProductFormPage from './pages/ProductFormPage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import CategoryListPage from './pages/CategoryListPage';
import ClientListPage from './pages/ClientListPage';
import EmployeeListPage from './pages/EmployeeListPage';
import SalesHistoryPage from './pages/SalesHistoryPage';
import PointOfSalePage from './pages/PointOfSalePage';
import ExpensesPage from './pages/ExpensesPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';
import CashRegisterPage from './pages/CashRegisterPage';
import SupplierListPage from './pages/SupplierListPage';
import PurchaseListPage from './pages/PurchaseListPage';
import PurchaseFormPage from './pages/PurchaseFormPage';
import PurchaseDetailsPage from './pages/PurchaseDetailsPage';
import MainLayout from './components/layout/MainLayout'; // Import Layout
import { useAuthStore } from './store/useAuthStore';

// Protected Route Component
const ProtectedRoute = ({ children, permission }: { children: React.ReactNode, permission?: string }) => {
  const { token, user } = useAuthStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (permission && user?.role !== 'Admin') {
    const hasPerm = user?.permissions?.includes(permission);
    if (!hasPerm) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

// Root Redirect Component to find the first available page
const RootRedirect = () => {
  const { user } = useAuthStore();

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'Admin') return <Navigate to="/dashboard" replace />;

  // Check permissions in order of priority
  if (user.permissions.includes('dashboard.view')) return <Navigate to="/dashboard" replace />;
  if (user.permissions.includes('pos.access')) return <Navigate to="/pos" replace />;
  if (user.permissions.includes('products.view')) return <Navigate to="/products" replace />;
  if (user.permissions.includes('sales.view')) return <Navigate to="/sales" replace />;
  if (user.permissions.includes('cash.manage')) return <Navigate to="/cash-register" replace />;
  if (user.permissions.includes('purchases.view')) return <Navigate to="/purchases" replace />;

  return <Navigate to="/profile" replace />; // Profile is always accessible
};

// Custom Error Boundary
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full">
            <h2 className="text-2xl font-bold text-rose-600 mb-4">Algo salió mal</h2>
            <p className="text-slate-600 mb-4">La aplicación ha encontrado un error crítico.</p>
            <pre className="bg-slate-100 p-4 rounded-lg text-xs font-mono text-slate-800 overflow-auto max-h-48">
              {this.state.error?.toString()}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition"
            >
              Recargar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const { applyTheme } = useThemeStore();

  // Aplicar tema al montar y escuchar cambios del sistema
  useEffect(() => {
    applyTheme();
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme();
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Layout Routes */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<ProtectedRoute permission="dashboard.view"><DashboardPage /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute permission="products.view"><ProductListPage /></ProtectedRoute>} />
            <Route path="/products/new" element={<ProtectedRoute permission="products.manage"><ProductFormPage /></ProtectedRoute>} />
            <Route path="/products/edit/:id" element={<ProtectedRoute permission="products.manage"><ProductFormPage /></ProtectedRoute>} />
            <Route path="/products/:id/details" element={<ProtectedRoute permission="products.view"><ProductDetailsPage /></ProtectedRoute>} />
            <Route path="/categories" element={<ProtectedRoute permission="products.view"><CategoryListPage /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute permission="sales.view"><ClientListPage /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute permission="users.manage"><EmployeeListPage /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute permission="sales.view"><SalesHistoryPage /></ProtectedRoute>} />
            <Route path="/pos" element={<ProtectedRoute permission="pos.access"><PointOfSalePage /></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute permission="expenses.manage"><ExpensesPage /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute permission="reports.view"><ReportsPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute permission="settings.manage"><SettingsPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/cash-register" element={<ProtectedRoute permission="cash.manage"><CashRegisterPage /></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute permission="purchases.view"><SupplierListPage /></ProtectedRoute>} />
            <Route path="/purchases" element={<ProtectedRoute permission="purchases.view"><PurchaseListPage /></ProtectedRoute>} />
            <Route path="/purchases/new" element={<ProtectedRoute permission="purchases.manage"><PurchaseFormPage /></ProtectedRoute>} />
            <Route path="/purchases/:id" element={<ProtectedRoute permission="purchases.view"><PurchaseDetailsPage /></ProtectedRoute>} />
            <Route path="/" element={<RootRedirect />} />
          </Route>

          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
