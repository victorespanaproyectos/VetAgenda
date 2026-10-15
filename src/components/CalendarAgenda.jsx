import { useState } from "react";
import PropTypes from "prop-types";
import { localDate, STATUSES, filterAppointments } from "../lib/appointments";
import {
  calendarDays,
  calendarLayout,
  minutes,
  shiftDate,
  timeLabel,
} from "../lib/overview";
const dayLabel = (date) =>
  new Intl.DateTimeFormat("es-UY", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00`));
export default function CalendarAgenda({
  records,
  onEdit,
  onCreate,
  onOpenPet,
  blocked,
}) {
  const [mode, setMode] = useState("week");
  const [anchor, setAnchor] = useState(localDate);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const days = calendarDays(anchor, mode);
  const selected = filterAppointments(records, search, status, "").filter(
    (item) => days.includes(item.fecha),
  );
  const start = Math.min(
    480,
    ...selected.map((item) => Math.floor(minutes(item.hora) / 60) * 60),
  );
  const end = Math.max(
    1080,
    ...selected.map(
      (item) =>
        Math.ceil((minutes(item.hora) + Number(item.duracion || 30)) / 60) * 60,
    ),
  );
  const slots = Array.from(
    { length: (end - start) / 30 },
    (_, i) => start + i * 30,
  );
  return (
    <section
      id="calendar-agenda"
      className="panel calendar-panel"
      aria-labelledby="calendar-title"
    >
      <div className="calendar-toolbar">
        <div>
          <p className="eyebrow">EL TIEMPO PARA CUIDAR</p>
          <h2 id="calendar-title">Agenda visual</h2>
          <p>
            {dayLabel(days[0])}
            {mode === "week" && ` — ${dayLabel(days[6])}`} · {selected.length}{" "}
            citas
          </p>
        </div>
        <div className="calendar-controls">
          <div className="segmented" role="group" aria-label="Vista de agenda">
            {[
              ["day", "Día"],
              ["week", "Semana"],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="button secondary"
            aria-label="Período anterior"
            onClick={() =>
              setAnchor(shiftDate(anchor, mode === "week" ? -7 : -1))
            }
          >
            ←
          </button>
          <button
            className="button secondary"
            onClick={() => setAnchor(localDate())}
          >
            Hoy
          </button>
          <button
            className="button secondary"
            aria-label="Período siguiente"
            onClick={() =>
              setAnchor(shiftDate(anchor, mode === "week" ? 7 : 1))
            }
          >
            →
          </button>
        </div>
      </div>
      <div className="calendar-filters">
        <label>
          Ir a fecha
          <input
            type="date"
            value={anchor}
            onChange={(e) => e.target.value && setAnchor(e.target.value)}
          />
        </label>
        <label>
          Buscar
          <input
            type="search"
            placeholder="Mascota o responsable"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Estado
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(STATUSES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="medical-note calendar-help">
        Selecciona un espacio para preparar una cita o una cita para editarla.
        La duración se muestra en cada bloque. Los espacios se validan al
        guardar.
      </p>
      {!selected.length && (
        <p className="calendar-empty" role="status">
          No hay citas para este período y estos filtros.
        </p>
      )}
      <div
        className="calendar-scroll"
        tabIndex="0"
        role="region"
        aria-label="Horarios de agenda; desplázate para ver todos los días"
      >
        <div
          className={`calendar-grid ${mode}`}
          style={{ "--days": days.length }}
        >
          <div className="calendar-corner">Hora</div>
          {days.map((day) => (
            <div
              key={day}
              className={`calendar-day-title ${day === localDate() ? "is-today" : ""}`}
            >
              {dayLabel(day)}
            </div>
          ))}
          <div className="calendar-times">
            {slots.map((slot) => (
              <div key={slot}>{timeLabel(slot)}</div>
            ))}
          </div>
          {days.map((day) => (
            <div
              key={day}
              className="calendar-day"
              style={{ height: slots.length * 40 }}
            >
              {slots.map((slot) => (
                <button
                  key={slot}
                  className="calendar-slot"
                  disabled={blocked || day < localDate()}
                  aria-label={`Preparar cita el ${day} a las ${timeLabel(slot)}`}
                  onClick={() => onCreate(day, timeLabel(slot))}
                >
                  <span className="sr-only">Nueva cita</span>
                </button>
              ))}
              {calendarLayout(
                selected.filter((item) => item.fecha === day),
              ).map(({ record, lane, lanes }) => (
                <div
                  key={record.id}
                  className={`calendar-event ${record.estado}`}
                  style={{
                    top: ((minutes(record.hora) - start) * 40) / 30,
                    height: Math.max(
                      20,
                      (Number(record.duracion || 30) * 40) / 30 - 2,
                    ),
                    left: `calc(${(lane * 100) / lanes}% + 2px)`,
                    width: `calc(${100 / lanes}% - 4px)`,
                  }}
                >
                  <button
                    className="calendar-event-edit"
                    disabled={blocked}
                    onClick={() => onEdit(record)}
                    title={`${record.nombre} · ${record.hora} · ${record.duracion || 30} min · ${STATUSES[record.estado]}`}
                  >
                    <strong>
                      {record.hora} · {record.nombre}
                    </strong>
                    <span>
                      {record.duracion || 30} min · {STATUSES[record.estado]}
                    </span>
                  </button>
                  {Number(record.duracion || 30) >= 45 && (
                    <button
                      className="calendar-pet-link"
                      onClick={() => onOpenPet(record.petId)}
                    >
                      Ver ficha
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="calendar-legend">
        <span>● Pendiente</span>
        <span>✓ Atendida</span>
        <span>— Cancelada</span>
        <small>
          Una agenda compartida · Sin envío automático de recordatorios
        </small>
      </div>
    </section>
  );
}
CalendarAgenda.propTypes = {
  records: PropTypes.array.isRequired,
  onEdit: PropTypes.func.isRequired,
  onCreate: PropTypes.func.isRequired,
  onOpenPet: PropTypes.func.isRequired,
  blocked: PropTypes.bool,
};
