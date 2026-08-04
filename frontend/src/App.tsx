import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";

import { Icon, type IconName } from "./components/brand";
import { AuthScreen, FullPageLoader, Splash } from "./screens/auth";
import { ActivityScreen, CustomerHome, PricesScreen } from "./screens/customer";
import { SettingsScreen } from "./screens/settings";
import { SupplierHome, SupplierJobs } from "./screens/supplier";
import { useSession } from "./state";

type Tab = { to: string; label: string; icon: IconName };

const CUSTOMER_TABS: Tab[] = [
  { to: "/", label: "Request", icon: "map" },
  { to: "/prices", label: "Prices", icon: "nozzle" },
  { to: "/activity", label: "Activity", icon: "clock" },
  { to: "/settings", label: "Settings", icon: "gear" },
];

const SUPPLIER_TABS: Tab[] = [
  { to: "/", label: "Dispatch", icon: "map" },
  { to: "/earnings", label: "Earnings", icon: "wallet" },
  { to: "/settings", label: "Settings", icon: "gear" },
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

export default function App() {
  const { user, ready } = useSession();
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), 2100);
    return () => window.clearTimeout(timer);
  }, []);

  if (booting) return <Splash />;
  if (!ready) return <FullPageLoader label="Restoring your session" />;
  if (!user) return <AuthScreen />;

  const isSupplier = user.role === "supplier";

  return (
    <div className="app">
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
            <Route path="/activity" element={<ActivityScreen />} />
          </>
        )}
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TabBar tabs={isSupplier ? SUPPLIER_TABS : CUSTOMER_TABS} />
    </div>
  );
}
