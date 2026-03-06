import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GuestRoute } from "@/components/GuestRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader2 } from "lucide-react";

// Lazy load pages
const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const VehicleList = lazy(() => import("@/pages/vehicles/VehicleList"));
const VehicleNew = lazy(() => import("@/pages/vehicles/VehicleNew"));
const VehicleDetail = lazy(() => import("@/pages/vehicles/VehicleDetail"));
const VehicleEdit = lazy(() => import("@/pages/vehicles/VehicleEdit"));
const CustomerList = lazy(() => import("@/pages/customers/CustomerList"));
const CustomerNew = lazy(() => import("@/pages/customers/CustomerNew"));
const CustomerDetail = lazy(() => import("@/pages/customers/CustomerDetail"));
const CustomerEdit = lazy(() => import("@/pages/customers/CustomerEdit"));
const SalesList = lazy(() => import("@/pages/sales/SalesList"));
const SupplierList = lazy(() => import("@/pages/suppliers/SupplierList"));
const SupplierNew = lazy(() => import("@/pages/suppliers/SupplierNew"));
const SupplierDetail = lazy(() => import("@/pages/suppliers/SupplierDetail"));
const SupplierEdit = lazy(() => import("@/pages/suppliers/SupplierEdit"));
const Finances = lazy(() => import("@/pages/Finances"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Redirect root to dashboard */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Navigate to="/dashboard" replace />
                  </ProtectedRoute>
                }
              />

              {/* Auth routes (guest only) */}
              <Route
                path="/login"
                element={
                  <GuestRoute>
                    <Login />
                  </GuestRoute>
                }
              />

              {/* Protected app routes with layout */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Dashboard />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* Vehicle routes */}
              <Route
                path="/vehicles"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <VehicleList />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vehicles/new"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <VehicleNew />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vehicles/:id"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <VehicleDetail />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vehicles/:id/edit"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <VehicleEdit />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* Customer routes */}
              <Route
                path="/customers"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <CustomerList />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customers/new"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <CustomerNew />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customers/:id"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <CustomerDetail />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customers/:id/edit"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <CustomerEdit />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* Sales routes */}
              <Route
                path="/sales"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SalesList />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* Supplier routes */}
              <Route
                path="/suppliers"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SupplierList />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/suppliers/new"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SupplierNew />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/suppliers/:id"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SupplierDetail />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/suppliers/:id/edit"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SupplierEdit />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* Finances route */}
              <Route
                path="/finances"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Finances />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
