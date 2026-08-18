import { useCallback, useEffect, useState } from "react";

import { Icon } from "../../components/brand";
import { Field, SelectField } from "../../components/ui";
import { api, ApiError, type Staff } from "../../lib/api";
import { useToast } from "../../state";

const ROLES: { value: string; label: string }[] = [
  { value: "courier", label: "Courier" },
  { value: "mechanic", label: "Mechanic" },
  { value: "tow_driver", label: "Tow driver" },
];

const ROLE_ICON: Record<string, "truck" | "wrench" | "tow"> = {
  courier: "truck",
  mechanic: "wrench",
  tow_driver: "tow",
};

function shiftLabel(state: string): string {
  if (state === "on_job") return "On a job";
  if (state === "available") return "On shift";
  return "Off shift";
}

/**
 * Provider roster: the people who actually execute jobs. Owners add staff,
 * toggle their accounts, and watch shift state. Staff sign in through the
 * staff app only — their tokens never reach this dashboard (invariant #6).
 */
export function CouriersSection() {
  const { notify } = useToast();
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone_number: "", password: "", role_label: "courier" });

  const load = useCallback(() => {
    api
      .supplierStaff()
      .then(setStaff)
      .catch(() => notify("Could not load your team.", "error"));
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!form.full_name.trim() || !form.phone_number.trim() || form.password.length < 6) {
      notify("Name, phone and a password of at least 6 characters are required.", "error");
      return;
    }
    setAdding(true);
    try {
      await api.supplierAddStaff({
        full_name: form.full_name.trim(),
        phone_number: form.phone_number.trim(),
        password: form.password,
        role_label: form.role_label,
      });
      setForm({ full_name: "", phone_number: "", password: "", role_label: "courier" });
      notify("Staff member added. They sign in with the staff app.");
      load();
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Could not add the staff member.", "error");
    } finally {
      setAdding(false);
    }
  }

  async function toggleActive(member: Staff) {
    try {
      await api.supplierSetStaffActive(member.id, !member.is_active);
      notify(member.is_active ? `${member.full_name} deactivated.` : `${member.full_name} activated.`);
      load();
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Could not update the staff member.", "error");
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card__head">
          <h3>Team</h3>
          <span className="badge">{staff ? staff.length : "…"}</span>
        </div>
        <p className="small muted" style={{ marginBottom: 10 }}>
          Your staff sign in with the FuelLink staff app and advance the jobs you accept. Toggling
          an account off blocks their sign-in but keeps their history.
        </p>

        {staff && staff.length === 0 ? (
          <div className="empty" style={{ padding: "24px 8px" }}>
            <span className="muted">
              <Icon name="truck" size={30} />
            </span>
            <h3>No staff yet</h3>
            <p className="muted small">
              Add a courier, mechanic or tow driver so jobs can be dispatched to real people.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Staff id</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Phone</th>
                  <th>Shift</th>
                  <th>Account</th>
                </tr>
              </thead>
              <tbody>
                {(staff ?? []).map((member) => (
                  <tr key={member.id}>
                    <td>
                      <span className="row" style={{ gap: 7 }}>
                        <Icon name={ROLE_ICON[member.role_label] ?? "truck"} size={15} />
                        <strong className="data">{member.staff_id}</strong>
                      </span>
                    </td>
                    <td>{member.full_name}</td>
                    <td className="muted">{member.role_label.replace("_", " ")}</td>
                    <td className="data muted">{member.phone_number}</td>
                    <td>
                      <span
                        className={`badge ${member.shift_state === "on_job" ? "badge--lime" : member.shift_state === "available" ? "badge--ok" : ""}`}
                      >
                        {shiftLabel(member.shift_state)}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="switch"
                        role="switch"
                        aria-checked={member.is_active}
                        aria-label={`Toggle ${member.full_name}'s account`}
                        title={member.is_active ? "Deactivate account" : "Activate account"}
                        onClick={() => void toggleActive(member)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card__head">
          <h3>Add a staff member</h3>
          <span className="badge badge--ok">Staff app</span>
        </div>
        <form className="grid-2" onSubmit={add} style={{ gap: 12 }}>
          <Field label="Full name" value={form.full_name} onChange={set("full_name")} placeholder="e.g. Bongani Ndlovu" />
          <Field
            label="Phone number"
            inputMode="tel"
            value={form.phone_number}
            onChange={set("phone_number")}
            placeholder="07…"
          />
          <Field
            label="Password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            placeholder="6+ characters"
          />
          <SelectField label="Role" value={form.role_label} onChange={set("role_label")} options={ROLES} />
          <button type="submit" className="btn btn--primary" disabled={adding} style={{ alignSelf: "end" }}>
            {adding ? <span className="spinner" /> : (
              <>
                <Icon name="plus" size={16} />
                Add to roster
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
