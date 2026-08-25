import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Icon } from "../../components/brand";
import { EmptyState, Field, SelectField, TopBar } from "../../components/ui";
import { api, ApiError, type Vehicle } from "../../lib/api";
import { useSession, useToast } from "../../state";

const FUEL_OPTIONS = [
  { value: "petrol", label: "Petrol" },
  { value: "diesel", label: "Diesel" },
];

type Draft = {
  make: string;
  model: string;
  plate_number: string;
  fuel_type: string;
  tank_capacity_litres: string;
};

const BLANK: Draft = {
  make: "",
  model: "",
  plate_number: "",
  fuel_type: "petrol",
  tank_capacity_litres: "50",
};

export function VehiclesScreen({ standalone = true }: { standalone?: boolean }) {
  const { user, refresh } = useSession();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>(user?.vehicles ?? []);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [busy, setBusy] = useState(false);

  const reload = () =>
    api.vehicles().then((list) => {
      setVehicles(list);
      void refresh();
    });

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEdit(vehicle?: Vehicle) {
    setEditing(vehicle ?? null);
    setDraft(
      vehicle
        ? {
            make: vehicle.make,
            model: vehicle.model,
            plate_number: vehicle.plate_number,
            fuel_type: vehicle.fuel_type,
            tank_capacity_litres: String(vehicle.tank_capacity_litres ?? 50),
          }
        : BLANK,
    );
  }

  async function save() {
    if (!draft.make.trim() || !draft.model.trim() || draft.plate_number.trim().length < 3) {
      notify("Add a make, model and a valid plate number.", "error");
      return;
    }
    setBusy(true);
    const body = {
      make: draft.make.trim(),
      model: draft.model.trim(),
      plate_number: draft.plate_number.trim(),
      fuel_type: draft.fuel_type,
      tank_capacity_litres: Number(draft.tank_capacity_litres) || 50,
      is_default: vehicles.length === 0,
    };
    try {
      if (editing) {
        await api.updateVehicle(editing.id, body);
        notify("Vehicle updated.");
      } else {
        await api.createVehicle(body);
        notify("Vehicle added.");
      }
      setEditing(null);
      await reload();
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Could not save the vehicle.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function setDefault(vehicle: Vehicle) {
    try {
      await api.updateVehicle(vehicle.id, {
        make: vehicle.make,
        model: vehicle.model,
        plate_number: vehicle.plate_number,
        fuel_type: vehicle.fuel_type,
        tank_capacity_litres: vehicle.tank_capacity_litres ?? 50,
        is_default: true,
      });
      await reload();
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Could not update the default.", "error");
    }
  }

  async function remove(vehicle: Vehicle) {
    try {
      await api.deleteVehicle(vehicle.id);
      notify("Vehicle removed.");
      await reload();
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Could not remove the vehicle.", "error");
    }
  }

  return (
    <div className="screen">
      <TopBar
        title="My vehicles"
        onBack={standalone ? () => navigate(-1) : undefined}
        action={
          <button type="button" className="btn btn--sm" onClick={() => startEdit()}>
            <Icon name="plus" size={15} />
            Add
          </button>
        }
      />

      <div className="pad stack">
        {vehicles.length === 0 && (
          <EmptyState
            icon="truck"
            title="No vehicle yet"
            body="Add your car so providers know what to look for at your pin."
          />
        )}

        {vehicles.map((vehicle) => (
          <div key={vehicle.id} className="tile">
            <div className="between" style={{ alignItems: "flex-start" }}>
              <div className="row" style={{ gap: 12 }}>
                <span className="service-card__icon">
                  <Icon name="truck" size={18} />
                </span>
                <div>
                  <div className="row" style={{ gap: 8 }}>
                    <strong style={{ fontSize: 14 }}>
                      {vehicle.make} {vehicle.model}
                    </strong>
                    {vehicle.is_default && (
                      <span className="badge badge--ok">
                        <Icon name="check" size={11} />
                        Default
                      </span>
                    )}
                  </div>
                  <p className="small muted">
                    <span className="data">{vehicle.plate_number}</span> · {vehicle.fuel_type} ·{" "}
                    {vehicle.tank_capacity_litres.toFixed(0)} L tank
                  </p>
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {!vehicle.is_default && (
                  <button type="button" className="btn btn--sm" onClick={() => setDefault(vehicle)}>
                    Set default
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => startEdit(vehicle)}
                  aria-label={`Edit ${vehicle.plate_number}`}
                >
                  <Icon name="gear" size={15} />
                </button>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => remove(vehicle)}
                  aria-label={`Remove ${vehicle.plate_number}`}
                >
                  <Icon name="dots" size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {editing || vehicles.length === 0 ? (
          <div className="tile stack" style={{ gap: 10 }}>
            <p className="eyebrow">{editing ? `Edit ${editing.plate_number}` : "Add a vehicle"}</p>
            <div className="grid-2">
              <Field
                label="Make"
                value={draft.make}
                onChange={(e) => setDraft({ ...draft, make: e.target.value })}
                placeholder="Toyota"
              />
              <Field
                label="Model"
                value={draft.model}
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                placeholder="Wish"
              />
            </div>
            <div className="grid-2">
              <Field
                label="Number plate"
                value={draft.plate_number}
                onChange={(e) => setDraft({ ...draft, plate_number: e.target.value.toUpperCase() })}
                placeholder="AEK 4412"
              />
              <Field
                label="Tank size (L)"
                type="number"
                value={draft.tank_capacity_litres}
                onChange={(e) => setDraft({ ...draft, tank_capacity_litres: e.target.value })}
                min={10}
                max={200}
              />
            </div>
            <SelectField
              label="Fuel it takes"
              value={draft.fuel_type}
              onChange={(e) => setDraft({ ...draft, fuel_type: e.target.value })}
              options={FUEL_OPTIONS}
            />
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn--primary btn--block" disabled={busy} onClick={save}>
                {busy ? <span className="spinner" /> : editing ? "Save changes" : "Add vehicle"}
              </button>
              {editing && (
                <button type="button" className="btn" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        ) : null}

        {standalone && (
          <Link to="/settings" className="small muted" style={{ textAlign: "center" }}>
            Back to profile
          </Link>
        )}
      </div>
    </div>
  );
}
