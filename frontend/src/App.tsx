import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";

import { Icon, type IconName } from "./components/brand";
import { AuthScreen, FullPageLoader, Splash, WelcomeScreen } from "./screens/auth";
import { CustomerHome, OrdersScreen, PricesScreen, VehiclesScreen } from "./screens/customer";
import { SettingsScreen } from "./screens/settings";
import { SupplierHome, SupplierJobs } from "./screens/supplier";
import { useSession } from "./state";
import { MotoristAppScreen } from "./ui/screens/MotoristAppScreen";
import { ProviderDashboardScreen } from "./ui/screens/ProviderDashboardScreen";
import { GarageDashboardScreen } from "./ui/screens/GarageDashboardScreen";
import { DriverAppScreen } from "./ui/screens/DriverAppScreen";

type Tab = { to: string; label: string; icon: IconName };

const CUSTOMER_TABS: Tab[] = [
  { to: "/", label: "Request", icon: "map" },
  { to: "/orders", label: "Orders", icon: "wallet" },
  { to: "/settings", label: "Profile", icon: "gear" },
];

function TabBar({ tabs }: { tabs: Tab[] }) {
  return (
    <nav className="nav">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === "/"}
          className={({ isActive }) => (isActive ? "is-active" : undefined)}
        >
          <Icon name={tab.icon} size={20} />
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

function AuthenticatedApp() {
  const { user } = useSession();
  const isSupplier = user?.role === "supplier";

  return (
    <div className={isSupplier ? "app app--dash" : "app"}>
      <Routes>
        {isSupplier ? (
          <>
            <Route path="/" element={<SupplierHome />} />
            <Route path="/earnings" element={<SupplierJobs />} />
          </>
        ) : (
          <>
            <Route path="/" element={<CustomerHome />} />
            <Route path="/prices" element={<PricesScreen />} />
            <Route path="/orders" element={<OrdersScreen />} />
            <Route path="/vehicles" element={<VehiclesScreen />} />
          </>
        )}
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!isSupplier && <TabBar tabs={CUSTOMER_TABS} />}
    </div>
  );
}

export default function App() {
  const { user, ready } = useSession();
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), 2100);
    return () => window.clearTimeout(timer);
  }, []);

  if (booting) return <Splash />;
  if (!ready) return <FullPageLoader label="Restoring your session" />;

  return (
    <Routes>
      {/* Design-library previews — reachable before login; a signed-in user is redirected into the app. */}
      <Route path="/design" element={user ? <Navigate to="/" replace /> : <ProviderDashboardScreen />} />
      <Route path="/motorist" element={user ? <Navigate to="/" replace /> : <MotoristAppScreen />} />
      <Route path="/garage" element={user ? <Navigate to="/" replace /> : <GarageDashboardScreen />} />
      <Route path="/driver" element={user ? <Navigate to="/" replace /> : <DriverAppScreen />} />
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthScreen />} />
      <Route path="/*" element={user ? <AuthenticatedApp /> : <WelcomeScreen />} />
    </Routes>
  );
}
