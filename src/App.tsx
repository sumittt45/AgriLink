import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { LocationProvider } from "@/contexts/LocationContext";

// Onboarding pages
import LanguagePage from "./pages/onboarding/LanguagePage";
import LocationPage from "./pages/onboarding/LocationPage";

// App pages
import Index from "./pages/Index";
import CategoryPage from "./pages/CategoryPage";
import OrdersPage from "./pages/OrdersPage";
import FarmerPortal from "./pages/FarmerPortal";
import FarmerLogin from "./pages/FarmerLogin";
import FarmerRegister from "./pages/FarmerRegister";
import FarmerDashboard from "./pages/FarmerDashboard";
import AvailableFarmersPage from "./pages/AvailableFarmersPage";
import CartPage from "./pages/CartPage";
import OrderTrackingPage from "./pages/OrderTrackingPage";
import OrderDetailsPage from "./pages/OrderDetailsPage";
import ProfilePage from "./pages/ProfilePage";
import AICropPredictionPage from "./pages/AICropPredictionPage";
import BulkMarketplacePage from "./pages/BulkMarketplacePage";
import QuickOrderPage from "./pages/QuickOrderPage";
import LoginPage from "./pages/LoginPage";
import CheckoutPage from "./pages/CheckoutPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import FarmDealsPage from "./pages/FarmDealsPage";
import FarmProfilePage from "./pages/FarmProfilePage";
import TrendingCropsPage from "./pages/TrendingCropsPage";
import LocalFarmersPage from "./pages/LocalFarmersPage";
import ChatPage from "./pages/ChatPage";
import AdminPanel from "./pages/AdminPanel";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import AIInsightsPage from "./pages/AIInsightsPage";
import AICropForecastPage from "./pages/AICropForecastPage";
import NotFound from "./pages/NotFound";
import AuthCallback from "./pages/AuthCallback";
import RoleGuard from "@/components/agrilink/RoleGuard";
import FloatingCartButton from "@/components/agrilink/FloatingCartButton";
import AgriChat from "@/components/agrilink/AgriChat";

const queryClient = new QueryClient();

const AgriChatGated = () => {
  const location = useLocation();
  return location.pathname === "/" ? <AgriChat /> : null;
};

/**
 * Redirects to /onboarding/language if language hasn't been selected yet,
 * or to /onboarding/location if location setup hasn't been seen yet.
 * Uses <Outlet /> so it can be used as a layout route.
 */
const OnboardingGuard = () => {
  const language = localStorage.getItem("language");
  // null  → key was never written (haven't seen the screen)
  // ""    → user skipped (key exists but empty)
  const state = localStorage.getItem("state");

  if (!language) return <Navigate to="/onboarding/language" replace />;
  if (state === null) return <Navigate to="/onboarding/location" replace />;

  return <Outlet />;
};




const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <LocationProvider>
        <CartProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <FloatingCartButton />
            <AgriChatGated />
            <Routes>
              {/* ── Auth callback (always reachable — handles email verification) ── */}
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* ── Onboarding (always reachable — no guard) ── */}
              <Route path="/onboarding/language" element={<LanguagePage />} />
              <Route path="/onboarding/location" element={<LocationPage />} />

              {/* ── Main app (guarded) ── */}
              <Route element={<OnboardingGuard />}>
                <Route path="/" element={<Index />} />
                <Route path="/category" element={<CategoryPage />} />
                <Route path="/farmers" element={<FarmerPortal />} />
                <Route path="/farmers/login" element={<FarmerLogin />} />
                <Route path="/farmers/register" element={<FarmerRegister />} />
                <Route path="/farmers/dashboard" element={<RoleGuard allowedRole="farmer"><FarmerDashboard /></RoleGuard>} />
                <Route path="/available-farmers" element={<AvailableFarmersPage />} />
                <Route path="/cart" element={<RoleGuard allowedRole="buyer"><CartPage /></RoleGuard>} />
                <Route path="/order-tracking" element={<OrderTrackingPage />} />
                <Route path="/order-details" element={<OrderDetailsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/orders" element={<RoleGuard allowedRole="buyer"><OrdersPage /></RoleGuard>} />
                <Route path="/ai-predictions" element={<AICropPredictionPage />} />
                <Route path="/bulk-marketplace" element={<BulkMarketplacePage />} />
                <Route path="/quick-order" element={<QuickOrderPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/checkout" element={<RoleGuard allowedRole="buyer"><CheckoutPage /></RoleGuard>} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/deals" element={<FarmDealsPage />} />
                <Route path="/farm-profile" element={<FarmProfilePage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/admin-login" element={<AdminLoginPage />} />
                <Route path="/admin-dashboard" element={<AdminDashboard />} />
                <Route path="/ai-insights" element={<AIInsightsPage />} />
                <Route path="/ai-crop-forecast" element={<AICropForecastPage />} />
                <Route path="/trending-crops" element={<TrendingCropsPage />} />
                <Route path="/local-farmers" element={<LocalFarmersPage />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </CartProvider>
        </LocationProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
