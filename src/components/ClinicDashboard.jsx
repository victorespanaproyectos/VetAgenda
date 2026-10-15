import PropTypes from "prop-types";
import { useClinic } from "../lib/useClinic";
import { clinicSummary } from "../lib/overview";
import { localDate } from "../lib/appointments";
const money = (value, currency) =>
  new Intl.NumberFormat("es-UY", { style: "currency", currency }).format(
    value / 100,
  );
export default function ClinicDashboard({ onOpenPet }) {
  const { data } = useClinic();
  const { todayRecords, reminders, balances } = clinicSummary(data);
  return (
    <section
      id="clinic-dashboard"
      className="dashboard-grid"
      aria-label="Actividad del consultorio"
    >
      <article className="panel dashboard-card">
        <p className="eyebrow">HOY EN EL CONSULTORIO</p>
        <h2>
          Atenciones del día{" "}
          <span className="count">{todayRecords.length}</span>
        </h2>
        <div className="dashboard-list">
          {todayRecords.slice(0, 5).map((item) => (
            <button
              key={item.id}
              onClick={() => onOpenPet(item.petId, "citas")}
            >
              <strong>{item.hora}</strong>
              <span>
                {item.nombre}
                <small>
                  {item.servicio} ·{" "}
                  {item.estado === "atendida" ? "Atendida" : "Pendiente"}
                </small>
              </span>
              <span aria-hidden="true">↗</span>
            </button>
          ))}
          {!todayRecords.length && (
            <p className="medical-note">
              No hay atenciones previstas para hoy.
            </p>
          )}
        </div>
        <a href="#calendar-agenda">Ver agenda completa →</a>
      </article>
      <article className="panel dashboard-card">
        <p className="eyebrow">SEGUIMIENTO PREVENTIVO</p>
        <h2>
          Controles por revisar{" "}
          <span className="count">{reminders.length}</span>
        </h2>
        <div className="dashboard-list">
          {reminders.slice(0, 5).map((item) => (
            <button
              key={item.id}
              onClick={() => onOpenPet(item.petId, "prevencion")}
            >
              <span
                className={`badge ${item.proxima < localDate() ? "cancelada" : "pendiente"}`}
              >
                {item.proxima < localDate() ? "Vencido" : "Próximo"}
              </span>
              <span>
                {data.pets.find((pet) => pet.id === item.petId)?.nombre}
                <small>
                  {item.producto} · {item.proxima}
                </small>
              </span>
            </button>
          ))}
          {!reminders.length && (
            <p className="medical-note">
              Sin controles vencidos ni próximos en siete días.
            </p>
          )}
        </div>
        <a href="#patient-care">Revisar fichas y controles →</a>
      </article>
      <article className="panel dashboard-card dashboard-balances">
        <p className="eyebrow">ADMINISTRACIÓN</p>
        <h2>Saldos pendientes</h2>
        {Object.entries(balances).map(([currency, value]) => (
          <div className="balance-line" key={currency}>
            <span>{currency}</span>
            <strong>{money(value, currency)}</strong>
          </div>
        ))}
        <p className="medical-note">
          Saldos acumulados de todos los pacientes. Cada moneda se calcula por
          separado.
        </p>
        <p className="medical-note">
          {data.pets.length} mascotas registradas · Cobros internos
        </p>
      </article>
    </section>
  );
}
ClinicDashboard.propTypes = { onOpenPet: PropTypes.func.isRequired };
