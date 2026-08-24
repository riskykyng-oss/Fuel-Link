import { NavLink } from "react-router-dom";

import { Icon, Mark, type IconName } from "../../components/brand";
import { useSession, useTheme } from "../../state";
import type { Section } from "./useSupplier";

export const NAV: { id: Section; label: string; icon: IconName }[] = [
  { id: "requests", label: "Requests", icon: "route" },
  { id: "active", label: "Active jobs", icon: "clock" },
  { id: "couriers", label: "Team", icon: "truck" },
  { id: "stock", label: "Fuel stock", icon: "box" },
  { id: "services", label: "Services", icon: "grid" },
];

export function Sidebar({
  section,
  setSection,
  online,
  toggleOnline,
}: {
  section: Section;
  setSection: (section: Section) => void;
  online: boolean;
  toggleOnline: () => void;
}) {
  const { user, signOut } = useSession();
  const { resolved, setChoice } = useTheme();
  const profile = user?.supplier_profile ?? null;
  const initials = (user?.full_name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="dash__sidebar">
      <div className="dash__brand">
        <Mark size={28} className="acid" />
        <span className="dash__brand-name">
          Fuel<span className="acid">Link</span>
          <span className="dash__brand-sub">{profile?.company_name ?? "Provider"}</span>
        </span>
      </div>

      <div className="dash__availability">
        <span className="row" style={{ gap: 7 }}>
          <span className={`dot ${online ? "dot--live" : "dot--off"}`} />
          <strong style={{ fontSize: 13 }}>{online ? "Online" : "Offline"}</strong>
        </span>
        <button
          type="button"
          className="switch"
          role="switch"
          aria-checked={online}
          aria-label="Toggle availability"
          onClick={toggleOnline}
        />
      </div>

      <nav className="dashnav">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={section === item.id ? "is-active" : undefined}
            onClick={() => setSection(item.id)}
          >
            <Icon name={item.icon} size={18} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="dash__foot">
        <NavLink to="/earnings">
          <Icon name="chart" size={18} />
          Earnings
        </NavLink>
        <NavLink to="/settings">
          <Icon name="gear" size={18} />
          Settings
        </NavLink>

        {import.meta.env.DEV && (
          <>
            <div className="dash__dev">
              <span className="small muted">Design previews</span>
            </div>
            <NavLink to="/design">
              <Icon name="grid" size={18} />
              Design
            </NavLink>
            <NavLink to="/motorist">
              <Icon name="tow" size={18} />
              Motorist
            </NavLink>
            <NavLink to="/garage">
              <Icon name="wrench" size={18} />
              Garage
            </NavLink>
            <NavLink to="/driver">
              <Icon name="truck" size={18} />
              Driver
            </NavLink>
          </>
        )}

        <div className="dash__profile">
          <span className="avatar">{initials}</span>
          <div className="grow">
            <strong style={{ fontSize: 13 }}>{user?.full_name}</strong>
            <p className="small muted">
              {profile?.is_verified ? (
                <>
                  <Icon name="shield" size={11} />
                  Verified · {profile.company_name}
                </>
              ) : (
                "Unverified"
              )}
            </p>
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            style={{ padding: 6 }}
            onClick={signOut}
            aria-label="Sign out"
          >
            <Icon name="logout" size={17} />
          </button>
        </div>

        <div className="dash__theme">
          <span className="small muted">Theme</span>
          <div className="seg" style={{ width: "100%" }}>
            {(["dark", "light", "system"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={resolved === t}
                className={resolved === t ? "is-active" : undefined}
                onClick={() => setChoice(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
