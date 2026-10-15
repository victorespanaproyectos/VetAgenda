import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useClinic } from "../lib/useClinic";
import PropTypes from "prop-types";
import { downloadDocument } from "../lib/clinic";
import { localDate } from "../lib/appointments";
import {
  emptyMedicalEntry,
  entriesForPatient,
  validateMedicalEntry,
} from "../lib/medicalHistory";

const labels = {
  motivo: "Motivo de la consulta",
  diagnostico: "Diagnóstico",
  tratamiento: "Tratamiento e indicaciones",
  notas: "Notas y seguimiento",
};
const formatDate = (value) =>
  new Intl.DateTimeFormat("es-UY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));

export default function MedicalHistory({ appointments, onNotice, petId }) {
  const {
    entries,
    setEntries,
    setData,
    documents,
    pets,
    conflict: blocked,
  } = useClinic();
  const [printed, setPrinted] = useState(null);
  useEffect(() => {
    if (printed) {
      const timer = setTimeout(() => window.print(), 100);
      return () => clearTimeout(timer);
    }
  }, [printed]);
  const [selected, setSelected] = useState("");
  const [form, setForm] = useState(emptyMedicalEntry);
  const [errors, setErrors] = useState({});
  const profiles = pets.map((pet) => ({ ...pet, key: pet.id }));
  const activeKey = petId || selected || profiles[0]?.key || "";
  useEffect(() => {
    setForm(emptyMedicalEntry());
    setErrors({});
  }, [petId]);
  const patient = profiles.find((profile) => profile.key === activeKey);
  const history = entriesForPatient(entries, activeKey);
  const visits = appointments.filter(
    (appointment) => appointment.petId === activeKey,
  );
  useEffect(() => {
    if (!selected && activeKey) setSelected(activeKey);
  }, [selected, activeKey]);

  useEffect(() => {
    if (selected && !pets.some((pet) => pet.id === selected)) {
      setSelected(pets[0]?.id || "");
      setForm(emptyMedicalEntry());
      setErrors({});
    }
  }, [pets, selected]);
  const reset = () => {
    setForm(emptyMedicalEntry());
    setErrors({});
  };
  const submit = (event) => {
    event.preventDefault();
    if (!patient || blocked) return;
    const validation = validateMedicalEntry(form);
    setErrors(validation);
    if (Object.keys(validation).length) {
      document.getElementById(`medical-${Object.keys(validation)[0]}`)?.focus();
      return;
    }
    const profile = {
      nombre: patient.nombre,
      propietario: patient.propietario,
      email: patient.email,
      especie: patient.especie,
    };
    const entry = {
      ...form,
      ...Object.fromEntries(
        Object.keys(labels).map((key) => [key, form[key].trim()]),
      ),
      id: form.id || crypto.randomUUID(),
      petId: activeKey,
      patient: profile,
      createdAt: form.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEntries((previous) =>
      form.id
        ? previous.map((item) => (item.id === form.id ? entry : item))
        : [...previous, entry],
    );
    onNotice(
      form.id
        ? "Registro médico actualizado."
        : "Consulta agregada a la historia médica.",
    );
    reset();
  };
  const exportHistory = () => {
    try {
      const data = JSON.stringify(petId ? history : entries, null, 2);
      const url = URL.createObjectURL(
        new Blob([data], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `vetagenda-historias-${localDate()}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      onNotice("No se pudo exportar la historia médica.");
    }
  };
  return (
    <section
      className="medical-section"
      id="medical-history"
      aria-labelledby="medical-title"
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">SU SALUD, A LO LARGO DEL TIEMPO</p>
          <h2 id="medical-title">Historia médica</h2>
          <p>Un registro de consultas y cuidados para cada mascota.</p>
        </div>
        <button className="button secondary" onClick={exportHistory}>
          ↓ Exportar historia
        </button>
      </div>
      {!profiles.length ? (
        <div className="panel empty-state">
          <span aria-hidden="true">♡</span>
          <h3>Primero, conoce a tu paciente</h3>
          <p>
            Crea una cita o carga la demostración para empezar a registrar su
            historia médica.
          </p>
          <a className="button secondary" href="#patient-care">
            Ir a fichas
          </a>
        </div>
      ) : (
        <>
          {!petId && (
            <div className="panel patient-selector">
              <div className="field">
                <label htmlFor="medical-patient">Seleccionar mascota</label>
                <select
                  id="medical-patient"
                  value={activeKey}
                  onChange={(event) => {
                    setSelected(event.target.value);
                    reset();
                  }}
                >
                  <option value="" disabled>
                    Selecciona una mascota
                  </option>
                  {profiles.map((profile) => (
                    <option key={profile.key} value={profile.key}>
                      {profile.nombre} · {profile.especie} ·{" "}
                      {profile.propietario} · {profile.email}
                    </option>
                  ))}
                </select>
              </div>
              <p>
                {patient ? (
                  <>
                    <strong>{patient.nombre}</strong> · {patient.propietario}
                    <span>
                      {history.length} registros médicos · {visits.length} citas
                      asociadas
                    </span>
                  </>
                ) : (
                  "Selecciona una mascota para consultar su historia."
                )}
              </p>
            </div>
          )}
          <div className="workspace medical-workspace">
            <section
              className="panel form-panel"
              id="medical-entry-form"
              aria-labelledby="medical-form-title"
            >
              <div className="panel-heading">
                <span className="section-icon" aria-hidden="true">
                  ✚
                </span>
                <div>
                  <h3 id="medical-form-title">
                    {form.id ? "Editar registro" : "Registrar consulta"}
                  </h3>
                  <p>Datos ingresados por el profesional.</p>
                </div>
              </div>
              <form onSubmit={submit} noValidate>
                <fieldset disabled={blocked || !patient}>
                  <div className="field">
                    <label htmlFor="medical-fecha">
                      Fecha de atención <span>*</span>
                    </label>
                    <input
                      id="medical-fecha"
                      name="fecha"
                      type="date"
                      value={form.fecha}
                      max={localDate()}
                      required
                      aria-invalid={Boolean(errors.fecha)}
                      aria-describedby={
                        errors.fecha ? "medical-fecha-error" : undefined
                      }
                      onChange={(event) => {
                        setForm((previous) => ({
                          ...previous,
                          fecha: event.target.value,
                        }));
                        setErrors((previous) => ({ ...previous, fecha: "" }));
                      }}
                    />
                    {errors.fecha && (
                      <small className="field-error" id="medical-fecha-error">
                        {errors.fecha}
                      </small>
                    )}
                  </div>
                  {Object.entries(labels).map(([key, label]) => (
                    <div className="field" key={key}>
                      <label htmlFor={`medical-${key}`}>
                        {label}{" "}
                        {key === "motivo" ? (
                          <span>*</span>
                        ) : (
                          <small>Opcional</small>
                        )}
                      </label>
                      <textarea
                        id={`medical-${key}`}
                        rows={key === "tratamiento" ? 3 : 2}
                        name={key}
                        value={form[key]}
                        maxLength={4000}
                        required={key === "motivo"}
                        aria-invalid={Boolean(errors[key])}
                        aria-describedby={
                          errors[key] ? `medical-${key}-error` : undefined
                        }
                        placeholder={
                          key === "motivo"
                            ? "¿Por qué vino a consulta?"
                            : key === "diagnostico"
                              ? "Hallazgos del profesional…"
                              : key === "tratamiento"
                                ? "Medicación, dosis y cuidados indicados…"
                                : "Evolución, controles o próximos pasos…"
                        }
                        onChange={(event) => {
                          setForm((previous) => ({
                            ...previous,
                            [key]: event.target.value,
                          }));
                          setErrors((previous) => ({ ...previous, [key]: "" }));
                        }}
                      />
                      {errors[key] && (
                        <small
                          className="field-error"
                          id={`medical-${key}-error`}
                        >
                          {errors[key]}
                        </small>
                      )}
                    </div>
                  ))}
                  <button className="button primary full" type="submit">
                    {form.id ? "Guardar registro" : "＋ Agregar a la historia"}
                  </button>
                  {form.id && (
                    <button
                      type="button"
                      className="button secondary full cancel-edit"
                      onClick={reset}
                    >
                      Cancelar edición del registro
                    </button>
                  )}
                  <p className="form-note">
                    * Campos obligatorios · Se conserva aunque elimines la cita.
                  </p>
                </fieldset>
              </form>
            </section>
            <section
              className="panel medical-timeline"
              aria-label="Consultas registradas"
            >
              <div className="agenda-heading">
                <div>
                  <p className="eyebrow">EVOLUCIÓN Y CUIDADOS</p>
                  <h3>
                    {patient?.nombre || "Paciente"}{" "}
                    <span className="count">{history.length}</span>
                  </h3>
                </div>
                <span className="calendar-label">Más recientes primero</span>
              </div>
              <div className="appointments">
                {!history.length && (
                  <div className="empty-state">
                    <span aria-hidden="true">✚</span>
                    <h3>Una historia por escribir</h3>
                    <p>
                      Las consultas médicas que registres aparecerán aquí. Las
                      citas no generan diagnósticos automáticamente.
                    </p>
                  </div>
                )}
                {history.map((entry) => (
                  <article className="appointment medical-entry" key={entry.id}>
                    <div className="appointment-top">
                      <h3>{formatDate(entry.fecha)}</h3>
                      <span className="badge atendida">Consulta</span>
                    </div>
                    {Object.entries(labels)
                      .filter(([key]) => entry[key])
                      .map(([key, label]) => (
                        <div className="clinical-detail" key={key}>
                          <h4>{label}</h4>
                          <p>{entry[key]}</p>
                        </div>
                      ))}
                    {documents.filter((item) => item.entryId === entry.id)
                      .length > 0 && (
                      <div className="consultation-documents">
                        <h4>Documentos de esta consulta</h4>
                        {documents
                          .filter((item) => item.entryId === entry.id)
                          .map((item) => (
                            <button
                              key={item.id}
                              className="button secondary"
                              onClick={() => downloadDocument(item)}
                            >
                              ↓ {item.name}
                            </button>
                          ))}
                      </div>
                    )}
                    <div className="appointment-actions">
                      <small>Registro manual</small>
                      <div className="action-buttons">
                        <button
                          onClick={() =>
                            setPrinted({
                              ...entry,
                              patient: patient || entry.patient,
                            })
                          }
                        >
                          Imprimir indicaciones
                        </button>
                        <button
                          disabled={blocked}
                          onClick={() => {
                            setForm({ ...entry });
                            setErrors({});
                            document
                              .getElementById("medical-entry-form")
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                            document
                              .getElementById("medical-fecha")
                              ?.focus({ preventScroll: true });
                          }}
                          aria-label={`Editar registro del ${entry.fecha}`}
                        >
                          Editar
                        </button>
                        <button
                          disabled={blocked}
                          className="danger-link"
                          onClick={() => {
                            if (
                              window.confirm(
                                `¿Eliminar el registro médico del ${formatDate(entry.fecha)}? Sus documentos se conservarán en la ficha general. No se puede deshacer.`,
                              )
                            ) {
                              setData((previous) => ({
                                ...previous,
                                entries: previous.entries.filter(
                                  (item) => item.id !== entry.id,
                                ),
                                documents: previous.documents.map((item) =>
                                  item.entryId === entry.id
                                    ? { ...item, entryId: "" }
                                    : item,
                                ),
                              }));
                              if (form.id === entry.id) reset();
                              onNotice("Registro médico eliminado.");
                            }
                          }}
                          aria-label={`Eliminar registro del ${entry.fecha}`}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <div className="agenda-footer">
                Guardada por mascota{" "}
                <span>Información ingresada manualmente</span>
              </div>
            </section>
          </div>
          <p className="medical-note">
            La historia se asocia al identificador permanente de la mascota.
            Editar su nombre o responsable no separa los registros.
          </p>
        </>
      )}
      {printed &&
        createPortal(
          <section className="print-sheet">
            <header>
              <h1>VetAgenda · Indicaciones de consulta</h1>
              <p>{formatDate(printed.fecha)}</p>
            </header>
            <h2>{printed.patient.nombre}</h2>
            <p>
              Responsable: {printed.patient.propietario} ·{" "}
              {printed.patient.email}
            </p>
            {Object.entries(labels)
              .filter(([key]) => printed[key])
              .map(([key, label]) => (
                <div className="clinical-detail" key={key}>
                  <h3>{label}</h3>
                  <p>{printed[key]}</p>
                </div>
              ))}
            <p className="print-signature">
              Profesional: ____________________ Firma: ____________________
            </p>
          </section>,
          document.body,
        )}
    </section>
  );
}
MedicalHistory.propTypes = {
  petId: PropTypes.string,
  appointments: PropTypes.arrayOf(
    PropTypes.shape({
      nombre: PropTypes.string.isRequired,
      propietario: PropTypes.string.isRequired,
      email: PropTypes.string.isRequired,
      especie: PropTypes.string.isRequired,
    }),
  ).isRequired,
  onNotice: PropTypes.func.isRequired,
};
