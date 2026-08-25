import { Suspense, lazy, useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";

import { Icon, Loader, Wordmark, type IconName } from "./components/brand";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthScreen, FullPageLoader, Splash, WelcomeScreen } from "./screens/auth";
import { SettingsScreen } from "./screens/settings";
import { useMediaQuery, MOBILE_QUERY } from "./lib/useMediaQuery";
import { useSession } from "./state";

const CustomerHome = lazy(() => import("./screens/customer").then((m) => ({ default: m.CustomerHome })));
const OrdersScreen = lazy(() => import("./screens/customer").then((m) => ({ default: m.OrdersScreen })));
const VehiclesScreen = lazy(() => import("./screens/customer").then((m) => ({ default: m.VehiclesScreen })));
const SupplierHome = lazy(() => import("./screens/supplier").then((m) => ({ default: m.SupplierHome })));
const SupplierJobs = lazy(() => import("./screens/supplier").then((m) => ({ default: m.SupplierJobs })));

type Tab = { to: string; label: string; icon: IconName };

const CUSTOMER_TABS: Tab[] = [
  { to: "/", label: "Service", icon: "map" },
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

function CustomerSidebar() {
  const { user, signOut } = useSession();
  const navigate = useNavigate();

  const NAV_ITEMS: { to: string; label: string; icon: IconName }[] = [
    { to: "/", label: "Request Service", icon: "map" },
    { to: "/orders", label: "My orders", icon: "wallet" },
    { to: "/vehicles", label: "My vehicles", icon: "truck" },
    { to: "/settings", label: "Profile & settings", icon: "gear" },
  ];

  return (
    <aside className="cust-sidebar">
      <div className="cust-sidebar__brand">
        <Wordmark size={18} />
      </div>

      <div className="cust-sidebar__profile">
        <span className="avatar" style={{ width: 34, height: 34, fontSize: 14 }}>
          {user?.full_name?.charAt(0).toUpperCase() ?? "?"}
        </span>
        <div>
          <strong>{user?.full_name}</strong>
          <p>{user?.phone_number}</p>
        </div>
      </div>

      <nav className="cust-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => (isActive ? "is-active" : undefined)}
          >
            <Icon name={item.icon} size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="cust-sidebar__foot">
        <button
          type="button"
          className="cust-nav"
          onClick={() => { signOut(); navigate("/auth"); }}
          style={{ justifyContent: "flex-start" }}
        >
          <Icon name="siren" size={18} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function RouteSpinner() {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
      <Loader size={40} />
    </div>
  );
}

function AuthenticatedApp() {
  const { user } = useSession();
  const isSupplier = user?.role === "supplier";
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isCustomerDesktop = !isSupplier && !isMobile;

  return (
    <div className={isSupplier ? "app app--dash" : isCustomerDesktop ? "app--customer-desktop" : "app"}>
      {isCustomerDesktop && <CustomerSidebar />}
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
        <Suspense fallback={<RouteSpinner />}>
          <Routes>
            {isSupplier ? (
              <>
                <Route path="/" element={<SupplierHome />} />
                <Route path="/earnings" element={<SupplierJobs />} />
              </>
            ) : (
              <>
                <Route path="/" element={<CustomerHome />} />
                <Route path="/orders" element={<OrdersScreen />} />
                <Route path="/vehicles" element={<VehiclesScreen />} />
              </>
            )}
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        {!isSupplier && isMobile && <TabBar tabs={CUSTOMER_TABS} />}
      </div>
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
    <ErrorBoundary>
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthScreen />} />
        <Route path="/*" element={user ? <AuthenticatedApp /> : <WelcomeScreen />} />
      </Routes>
    </ErrorBoundary>
  );
}
