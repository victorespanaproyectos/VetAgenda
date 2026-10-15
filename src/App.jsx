import { useEffect, useState } from "react";
import { useClinic } from "./lib/useClinic";
import PatientCare from "./components/PatientCare";
import { migrateLegacy } from "./lib/clinic";
import CalendarAgenda from "./components/CalendarAgenda";
import ClinicDashboard from "./components/ClinicDashboard";
import {
  STATUSES,
  demoAppointments,
  emptyAppointment,
  filterAppointments,
  hasConflict,
  localDate,
  validateAppointment,
} from "./lib/appointments";

const dateLabel = (date) =>
  new Intl.DateTimeFormat("es-UY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));

export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("vetagenda-theme");
      if (["light", "dark"].includes(saved)) return saved;
    } catch {
      /* El tema funciona también sin almacenamiento. */
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#14221f" : "#15796d");
    try {
      localStorage.setItem("vetagenda-theme", theme);
    } catch {
      /* Se mantiene la elección durante esta sesión. */
    }
  }, [theme]);
  const {
    records,
    setRecords,
    pets,
    setData,
    error: storageError,
    saving,
    conflict: blocked,
  } = useClinic();
  const [form, setForm] = useState(emptyAppointment);
  const [errors, setErrors] = useState({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [careRequest, setCareRequest] = useState(null);
  const openPet = (petId, tab = "resumen") => {
    setCareRequest({ petId, tab, token: crypto.randomUUID() });
    document
      .getElementById("patient-care")
      ?.scrollIntoView({ behavior: "smooth" });
  };
  const prepareAppointment = (fecha, hora) => {
    setForm({ ...emptyAppointment(), fecha, hora });
    setErrors({});
    document
      .getElementById("appointment-form")
      ?.scrollIntoView({ behavior: "smooth" });
    document.getElementById("nombre")?.focus({ preventScroll: true });
  };
  const today = localDate();
  const visible = filterAppointments(records, search, status, date);
  const pending = records.filter((record) => record.estado === "pendiente");

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const resetForm = () => {
    setForm(emptyAppointment());
    setErrors({});
  };
  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: "" }));
  };
  const submit = (event) => {
    event.preventDefault();
    const nextErrors = validateAppointment(form, records);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      document.getElementById(Object.keys(nextErrors)[0])?.focus();
      return;
    }
    const record = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() : value,
      ]),
    );
    record.id = form.id || crypto.randomUUID();
    if (!record.petId) {
      setErrors({ nombre: "Selecciona una mascota de la ficha." });
      return;
    }
    const selectedPet = pets.find((pet) => pet.id === record.petId);
    if (!selectedPet) {
      setNotice("La ficha seleccionada ya no existe.");
      return;
    }
    Object.assign(record, {
      nombre: selectedPet.nombre,
      propietario: selectedPet.propietario,
      email: selectedPet.email,
      especie: selectedPet.especie,
      telefono: selectedPet.telefono,
    });
    record.duracion = Number(record.duracion);
    setRecords((previous) =>
      form.id
        ? previous.map((item) => (item.id === form.id ? record : item))
        : [...previous, record],
    );
    setNotice(form.id ? "Cambios guardados." : "Cita creada. ¡Todo listo!");
    resetForm();
  };
  const edit = (record) => {
    setForm({ ...record });
    setErrors({});
    document
      .getElementById("appointment-form")
      .scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("nombre").focus({ preventScroll: true });
  };
  const changeStatus = (record, estado) => {
    if (hasConflict({ ...record, estado }, records)) {
      setNotice(
        "No se puede reabrir: ese horario ya tiene otra cita pendiente. Edita la hora primero.",
      );
      return;
    }
    setRecords((previous) =>
      previous.map((item) =>
        item.id === record.id ? { ...item, estado } : item,
      ),
    );
    if (form.id === record.id) setForm((previous) => ({ ...previous, estado }));
    setNotice("Estado actualizado.");
  };
  const exportData = () => {
    try {
      const data = JSON.stringify(records, null, 2);
      const url = URL.createObjectURL(
        new Blob([data], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `vetagenda-${today}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setNotice(
        "No pudimos exportar los datos. El navegador bloquea el almacenamiento.",
      );
    }
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Ir al contenido
      </a>
      <header className="topbar" inert={deleting ? "" : undefined}>
        <a href="#" className="brand" aria-label="VetAgenda, inicio">
          <span className="brand-mark" aria-hidden="true">
            ✚
          </span>
          <span>
            Vet<span className="brand-accent">Agenda</span>
            <small>CUIDADO QUE CONECTA</small>
          </span>
        </a>
        <div className="topbar-right">
          <div
            className="theme-switch"
            role="group"
            aria-label="Tema de la aplicación"
          >
            <button
              type="button"
              aria-label="Tema claro"
              title="Tema claro"
              aria-pressed={theme === "light"}
              onClick={() => setTheme("light")}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Tema oscuro"
              title="Tema oscuro"
              aria-pressed={theme === "dark"}
              onClick={() => setTheme("dark")}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M20.6 14.2A9 9 0 0 1 9.8 3.4 9 9 0 1 0 20.6 14.2Z" />
              </svg>
            </button>
          </div>
          <span className="local-tag">
            <span />
            {storageError
              ? "Sin guardar"
              : saving
                ? "Guardando…"
                : "Guardado en SQLite"}
          </span>
          <span className="avatar" aria-label="Perfil de demostración">
            VE
          </span>
        </div>
      </header>
      <main id="main" inert={deleting ? "" : undefined}>
        <nav className="section-nav" aria-label="Secciones">
          <a href="#clinic-dashboard">⌂ Inicio</a>
          <a href="#calendar-agenda">◷ Agenda visual</a>
          <a href="#appointment-form">＋ Citas</a>
          <a href="#patient-care">🐾 Fichas y cuidados</a>
        </nav>
        <section className="page-heading">
          <div>
            <p className="eyebrow">TU CONSULTORIO, EN ORDEN</p>
            <h1>Un buen día para cuidar.</h1>
            <p>Organiza las citas y acompaña a cada paciente.</p>
          </div>
          <button className="button secondary" onClick={exportData}>
            ↓ Exportar datos
          </button>
        </section>
        <section className="stats" aria-label="Resumen de citas">
          {[
            [
              "Citas de hoy",
              records.filter(
                (item) => item.fecha === today && item.estado !== "cancelada",
              ).length,
              "En tu agenda",
              "◷",
            ],
            ["Pendientes", pending.length, "Por atender", "↗"],
            [
              "Atendidas",
              records.filter((item) => item.estado === "atendida").length,
              "Cuidado completado",
              "✓",
            ],
          ].map(([label, count, detail, icon]) => (
            <article className="stat" key={label}>
              <span className="stat-icon" aria-hidden="true">
                {icon}
              </span>
              <div>
                <p>{label}</p>
                <strong>{count}</strong>
                <small>{detail}</small>
              </div>
            </article>
          ))}
        </section>
        <ClinicDashboard onOpenPet={openPet} />
        <CalendarAgenda
          records={records}
          onEdit={edit}
          onCreate={prepareAppointment}
          onOpenPet={openPet}
          blocked={blocked}
        />
        <div className="workspace">
          <section className="panel form-panel" id="appointment-form">
            <div className="panel-heading">
              <span className="section-icon" aria-hidden="true">
                ＋
              </span>
              <div>
                <h2>{form.id ? "Editar cita" : "Nueva cita"}</h2>
                <p>
                  {form.id
                    ? "Actualiza la información del paciente."
                    : "El próximo cuidado empieza aquí."}
                </p>
              </div>
            </div>
            <form onSubmit={submit} noValidate>
              <fieldset disabled={blocked}>
                <div className="field">
                  <label htmlFor="appointment-pet">
                    Mascota registrada <span>*</span>
                  </label>
                  <select
                    id="appointment-pet"
                    value={form.petId || ""}
                    required
                    onChange={(event) => {
                      const pet = pets.find(
                        (item) => item.id === event.target.value,
                      );
                      setForm((previous) => ({
                        ...previous,
                        petId: pet?.id || "",
                        nombre: pet?.nombre || "",
                        propietario: pet?.propietario || "",
                        email: pet?.email || "",
                        telefono: pet?.telefono || "",
                        especie: pet?.especie || "Perro",
                      }));
                      setErrors({});
                    }}
                  >
                    <option value="">Selecciona una mascota</option>
                    {pets.map((pet) => (
                      <option key={pet.id} value={pet.id}>
                        {pet.nombre} · {pet.propietario}
                      </option>
                    ))}
                  </select>
                  <small className="form-note">
                    Registra nuevas mascotas en{" "}
                    <a href="#patient-care">Fichas y cuidados</a>.
                  </small>
                </div>

                <div className="field">
                  <label htmlFor="nombre">
                    Nombre de la mascota <span>*</span>
                  </label>
                  <input
                    id="nombre"
                    readOnly
                    name="nombre"
                    value={form.nombre}
                    onChange={updateField}
                    placeholder="Ej. Luna"
                    maxLength={80}
                    required
                    aria-invalid={Boolean(errors.nombre)}
                    aria-describedby={
                      errors.nombre ? "nombre-error" : undefined
                    }
                  />
                  {errors.nombre && (
                    <small className="field-error" id="nombre-error">
                      {errors.nombre}
                    </small>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="especie">Especie</label>
                  <select
                    id="especie"
                    disabled
                    name="especie"
                    value={form.especie}
                    onChange={updateField}
                  >
                    {["Perro", "Gato", "Ave", "Conejo", "Otra"].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="propietario">
                    Responsable <span>*</span>
                  </label>
                  <input
                    id="propietario"
                    readOnly
                    name="propietario"
                    value={form.propietario}
                    onChange={updateField}
                    placeholder="Nombre y apellido"
                    maxLength={120}
                    autoComplete="name"
                    required
                    aria-invalid={Boolean(errors.propietario)}
                    aria-describedby={
                      errors.propietario ? "propietario-error" : undefined
                    }
                  />
                  {errors.propietario && (
                    <small className="field-error" id="propietario-error">
                      {errors.propietario}
                    </small>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="email">
                    Correo electrónico <span>*</span>
                  </label>
                  <input
                    id="email"
                    readOnly
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={updateField}
                    placeholder="nombre@ejemplo.com"
                    maxLength={160}
                    autoComplete="email"
                    required
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "email-error" : undefined}
                  />
                  {errors.email && (
                    <small className="field-error" id="email-error">
                      {errors.email}
                    </small>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="telefono">
                    Teléfono <small>Opcional</small>
                  </label>
                  <input
                    id="telefono"
                    readOnly
                    name="telefono"
                    type="tel"
                    value={form.telefono}
                    onChange={updateField}
                    placeholder="Ej. 099 123 456"
                    maxLength={30}
                    autoComplete="tel"
                  />
                </div>
                <div className="field-row">
                  {[
                    ["fecha", "Fecha", "date"],
                    ["hora", "Hora", "time"],
                  ].map(([name, label, type]) => (
                    <div className="field" key={name}>
                      <label htmlFor={name}>
                        {label} <span>*</span>
                      </label>
                      <input
                        id={name}
                        name={name}
                        type={type}
                        value={form[name]}
                        onChange={updateField}
                        min={name === "fecha" && !form.id ? today : undefined}
                        required
                        aria-invalid={Boolean(errors[name])}
                        aria-describedby={
                          errors[name] ? `${name}-error` : undefined
                        }
                      />
                      {errors[name] && (
                        <small className="field-error" id={`${name}-error`}>
                          {errors[name]}
                        </small>
                      )}
                    </div>
                  ))}
                </div>
                <div className="field">
                  <label htmlFor="duracion">Duración de la consulta</label>
                  <select
                    id="duracion"
                    name="duracion"
                    value={form.duracion || 30}
                    onChange={updateField}
                  >
                    {[15, 30, 45, 60, 90, 120].map((value) => (
                      <option key={value} value={value}>
                        {value} minutos
                      </option>
                    ))}
                  </select>
                  {errors.duracion && (
                    <small className="field-error">{errors.duracion}</small>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="servicio">Tipo de consulta</label>
                  <select
                    id="servicio"
                    name="servicio"
                    value={form.servicio}
                    onChange={updateField}
                  >
                    {[
                      "Consulta general",
                      "Control de salud",
                      "Vacunación",
                      "Seguimiento",
                    ].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="sintomas">
                    Motivo de la visita <span>*</span>
                  </label>
                  <textarea
                    id="sintomas"
                    name="sintomas"
                    rows={3}
                    value={form.sintomas}
                    onChange={updateField}
                    placeholder="Síntomas, observaciones o cuidados…"
                    maxLength={2000}
                    required
                    aria-invalid={Boolean(errors.sintomas)}
                    aria-describedby={
                      errors.sintomas ? "sintomas-error" : undefined
                    }
                  />
                  {errors.sintomas && (
                    <small className="field-error" id="sintomas-error">
                      {errors.sintomas}
                    </small>
                  )}
                </div>
                <button className="button primary full" type="submit">
                  {form.id ? "Guardar cambios" : "＋ Crear cita"}
                </button>
                {form.id && (
                  <button
                    className="button secondary full cancel-edit"
                    type="button"
                    onClick={resetForm}
                  >
                    Cancelar edición
                  </button>
                )}
                <p className="form-note">
                  * Campos obligatorios · Sin superposición de citas pendientes.
                </p>
              </fieldset>
            </form>
          </section>
          <section
            className="panel agenda-panel"
            aria-label="Agenda de pacientes"
          >
            <div className="agenda-heading">
              <div>
                <p className="eyebrow">CADA PACIENTE IMPORTA</p>
                <h2>
                  Tu agenda <span className="count">{visible.length}</span>
                </h2>
              </div>
              <span className="calendar-label">{dateLabel(today)}</span>
            </div>
            <div className="filters">
              <div className="search-field">
                <label className="sr-only" htmlFor="search">
                  Buscar por mascota, responsable o correo
                </label>
                <input
                  id="search"
                  type="search"
                  placeholder="Buscar mascota o responsable…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="filter-row">
                <div>
                  <label htmlFor="status-filter">Estado</label>
                  <select
                    id="status-filter"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">Todos los estados</option>
                    {Object.entries(STATUSES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="date-filter">Fecha</label>
                  <input
                    id="date-filter"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                {(search || status || date) && (
                  <button
                    className="clear-filters"
                    onClick={() => {
                      setSearch("");
                      setStatus("");
                      setDate("");
                    }}
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
            <div className="appointments">
              {!visible.length && (
                <div className="empty-state">
                  <span aria-hidden="true">♡</span>
                  <h3>
                    {records.length
                      ? "Sin resultados"
                      : "Tu agenda está por comenzar"}
                  </h3>
                  <p>
                    {records.length
                      ? "Prueba con otra búsqueda o limpia los filtros."
                      : "Agrega tu primera cita o explora el panel con pacientes de ejemplo."}
                  </p>
                  {!records.length && (
                    <button
                      className="button secondary"
                      disabled={blocked}
                      onClick={() => {
                        const demo = migrateLegacy(demoAppointments(), []);
                        setData((previous) => ({
                          ...previous,
                          records: demo.records,
                          pets: [...previous.pets, ...demo.pets],
                        }));
                        setNotice(
                          "Datos ficticios cargados para explorar la agenda.",
                        );
                      }}
                    >
                      Cargar demostración
                    </button>
                  )}
                </div>
              )}
              {visible.map((record) => (
                <article
                  key={record.id}
                  className={`appointment ${record.estado}`}
                >
                  <div className="appointment-top">
                    <div className="patient-title">
                      <span className="pet-icon" aria-hidden="true">
                        {record.especie === "Gato"
                          ? "🐈"
                          : record.especie === "Perro"
                            ? "🐕"
                            : record.especie === "Ave"
                              ? "🐦"
                              : record.especie === "Conejo"
                                ? "🐇"
                                : "🐾"}
                      </span>
                      <div>
                        <h3>{record.nombre}</h3>
                        <p>
                          {record.especie} <span>·</span> {record.servicio}
                        </p>
                      </div>
                    </div>
                    <span className={`badge ${record.estado}`}>
                      {STATUSES[record.estado]}
                    </span>
                  </div>
                  <div className="appointment-date">
                    <span aria-hidden="true">◷</span> {dateLabel(record.fecha)}{" "}
                    <span>·</span> <strong>{record.hora}</strong>
                    <span>· {record.duracion || 30} min</span>
                  </div>
                  <div className="patient-details">
                    <p>
                      <span>Responsable</span>
                      {record.propietario}
                    </p>
                    <p>
                      <span>Contacto</span>
                      <a href={`mailto:${record.email}`}>{record.email}</a>
                      {record.telefono && (
                        <a href={`tel:${record.telefono}`}>{record.telefono}</a>
                      )}
                    </p>
                  </div>
                  <p className="visit-reason">{record.sintomas}</p>
                  <div className="appointment-actions">
                    <div>
                      <label className="sr-only" htmlFor={`state-${record.id}`}>
                        Estado de la cita de {record.nombre}
                      </label>
                      <select
                        disabled={blocked}
                        id={`state-${record.id}`}
                        value={record.estado}
                        onChange={(e) => changeStatus(record, e.target.value)}
                      >
                        {Object.entries(STATUSES).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="action-buttons">
                      <button onClick={() => openPet(record.petId)}>
                        Ver ficha
                      </button>
                      <button
                        disabled={blocked}
                        onClick={() => edit(record)}
                        aria-label={`Editar cita de ${record.nombre}`}
                      >
                        Editar
                      </button>
                      <button
                        disabled={blocked}
                        className="danger-link"
                        onClick={() => setDeleting(record)}
                        aria-label={`Eliminar cita de ${record.nombre}`}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="agenda-footer">
              Ordenadas por fecha y hora <span>Hecho para cuidar mejor ♡</span>
            </div>
          </section>
        </div>
        <PatientCare onNotice={setNotice} request={careRequest} />
        <footer className="site-footer">
          <span>VetAgenda · Proyecto de Víctor España</span>
          <span>
            Datos guardados en tu servidor local. La demo utiliza pacientes
            ficticios.
          </span>
        </footer>
      </main>
      <div className="toast-region" role="status" aria-live="polite">
        {notice && (
          <div className="toast">
            {notice}
            <button onClick={() => setNotice("")} aria-label="Cerrar aviso">
              ×
            </button>
          </div>
        )}
      </div>
      {deleting && (
        <div
          className="modal-backdrop"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDeleting(null);
              document.getElementById(`state-${deleting.id}`)?.focus();
            }
            if (e.key === "Tab") {
              const buttons = e.currentTarget.querySelectorAll("button");
              if (e.shiftKey && document.activeElement === buttons[0]) {
                e.preventDefault();
                buttons[1].focus();
              } else if (!e.shiftKey && document.activeElement === buttons[1]) {
                e.preventDefault();
                buttons[0].focus();
              }
            }
          }}
        >
          <div
            className="dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            aria-describedby="delete-description"
          >
            <span className="delete-icon" aria-hidden="true">
              !
            </span>
            <h2 id="delete-title">¿Eliminar esta cita?</h2>
            <p id="delete-description">
              La cita de <strong>{deleting.nombre}</strong> se eliminará de la
              agenda. Esta acción no se puede deshacer.
            </p>
            <div className="dialog-actions">
              <button
                className="button secondary"
                autoFocus
                onClick={() => {
                  setDeleting(null);
                  document.getElementById(`state-${deleting.id}`)?.focus();
                }}
              >
                Conservar cita
              </button>
              <button
                className="button danger"
                onClick={() => {
                  setRecords((previous) =>
                    previous.filter((item) => item.id !== deleting.id),
                  );
                  if (form.id === deleting.id) resetForm();
                  setDeleting(null);
                  setNotice("Cita eliminada.");
                  document.getElementById("search")?.focus();
                }}
              >
                Eliminar cita
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
