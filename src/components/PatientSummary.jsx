import PropTypes from "prop-types";
import { useClinic } from "../lib/useClinic";
import { upcomingPreventive } from "../lib/clinic";
import { localDate } from "../lib/appointments";
import { shiftDate } from "../lib/overview";
export default function PatientSummary({ pet, onTab }) {
  const { records, entries, preventive, weights, documents, invoices } =
    useClinic();
  const own = (items) => items.filter((item) => item.petId === pet.id);
  const visits = own(records)
    .filter((item) => item.estado === "pendiente" && item.fecha >= localDate())
    .sort((a, b) =>
      `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`),
    );
  const controls = upcomingPreventive(
    own(preventive),
    shiftDate(localDate(), 7),
  );
  const activity = [
    ...own(entries).map((item) => ({
      id: `entry-${item.id}`,
      fecha: item.fecha,
      tipo: "Consulta",
      text: item.motivo,
      tab: "historia",
    })),
    ...own(preventive).map((item) => ({
      id: `preventive-${item.id}`,
      fecha: item.fecha,
      tipo: item.tipo,
      text: item.producto,
      tab: "prevencion",
    })),
    ...own(weights).map((item) => ({
      id: `weight-${item.id}`,
      fecha: item.fecha,
      tipo: "Peso",
      text: `${item.kg} kg`,
      tab: "peso",
    })),
    ...own(documents).map((item) => ({
      id: `document-${item.id}`,
      fecha: item.createdAt.slice(0, 10),
      tipo: "Documento",
      text: item.name,
      tab: "documentos",
    })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha) || a.id.localeCompare(b.id));
  return (
    <div className="patient-summary">
      <h3>Resumen de {pet.nombre}</h3>
      <p className="medical-note">
        Su agenda, historia y cuidados en una sola ficha.
      </p>
      <div className="patient-summary-grid">
        <article>
          <h4>Próxima cita</h4>
          <p>
            {visits.length
              ? `${visits[0].fecha} · ${visits[0].hora} · ${visits[0].servicio}`
              : "Sin próximas citas pendientes"}
          </p>
          <button onClick={() => onTab("citas")}>
            Ver citas ({own(records).length}) →
          </button>
        </article>
        <article>
          <h4>Prevención</h4>
          <p>
            {controls.length
              ? `${controls.length} controles vencidos o próximos en siete días`
              : "Sin controles próximos o vencidos"}
          </p>
          <button onClick={() => onTab("prevencion")}>Ver controles →</button>
        </article>
        <article>
          <h4>Saldos pendientes</h4>
          {["UYU", "USD"].map((currency) => (
            <p key={currency}>
              {currency}:{" "}
              {new Intl.NumberFormat("es-UY", {
                style: "currency",
                currency,
              }).format(
                own(invoices)
                  .filter((item) => item.moneda === currency)
                  .reduce((sum, item) => sum + item.total - item.pagado, 0) /
                  100,
              )}
            </p>
          ))}
          <button onClick={() => onTab("cobros")}>Ver cobros →</button>
        </article>
      </div>
      <h4 className="care-subheading">Actividad clínica reciente</h4>
      <div className="patient-timeline">
        {activity.slice(0, 12).map((item) => (
          <button key={item.id} onClick={() => onTab(item.tab)}>
            <time dateTime={item.fecha}>{item.fecha}</time>
            <span>
              <strong>{item.tipo}</strong>
              <small>{item.text}</small>
            </span>
            <span aria-hidden="true">→</span>
          </button>
        ))}
      </div>
      {!activity.length && (
        <p className="medical-note">
          Todavía no hay consultas ni cuidados registrados para esta mascota.
        </p>
      )}
    </div>
  );
}
PatientSummary.propTypes = {
  pet: PropTypes.object.isRequired,
  onTab: PropTypes.func.isRequired,
};
