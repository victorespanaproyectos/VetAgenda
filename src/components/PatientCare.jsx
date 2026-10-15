import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import MedicalHistory from "./MedicalHistory";
import PatientSummary from "./PatientSummary";
import WeightChart from "./WeightChart";
import { useClinic } from "../lib/useClinic";
import { localDate } from "../lib/appointments";
import {
  emptyPet,
  moneyToCents,
  validatePet,
  upcomingPreventive,
  downloadDocument,
} from "../lib/clinic";
const dateText = (value) =>
  new Intl.DateTimeFormat("es-UY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
const money = (cents, currency) =>
  new Intl.NumberFormat("es-UY", { style: "currency", currency }).format(
    cents / 100,
  );
const emptyPrevention = () => ({
  tipo: "Vacuna",
  producto: "",
  fecha: localDate(),
  proxima: "",
  lote: "",
  notas: "",
});
const emptyInvoice = () => ({
  fecha: localDate(),
  concepto: "Consulta veterinaria",
  moneda: "UYU",
  total: "",
  pagado: "0",
});
const petFields = {
  nombre: "Nombre de la mascota",
  raza: "Raza",
  microchip: "Microchip",
  propietario: "Responsable",
  email: "Correo electrónico",
  telefono: "Teléfono",
};
const notesFields = {
  alergias: "Alergias",
  cronicas: "Enfermedades crónicas",
  medicacion: "Medicación habitual",
  notas: "Otros antecedentes",
};
export default function PatientCare({ onNotice, request }) {
  const {
    setData,
    pets,
    records,
    entries,
    preventive,
    setPreventive,
    weights,
    setWeights,
    documents,
    setDocuments,
    invoices,
    setInvoices,
    conflict: blocked,
  } = useClinic();
  const [selected, setSelected] = useState("");
  const [tab, setTab] = useState("resumen");
  const [petForm, setPetForm] = useState(emptyPet);
  const [petErrors, setPetErrors] = useState({});
  const [creating, setCreating] = useState(false);
  const [prevention, setPrevention] = useState(emptyPrevention);
  const [weight, setWeight] = useState({ fecha: localDate(), kg: "" });
  const [invoice, setInvoice] = useState(emptyInvoice);
  const [uploading, setUploading] = useState(false);
  const [documentEntry, setDocumentEntry] = useState("");
  useEffect(() => {
    if (!request) return;
    setSelected(request.petId);
    setTab(request.tab);
    setCreating(false);
    setInvoice(emptyInvoice());
    setPrevention(emptyPrevention());
    setWeight({ fecha: localDate(), kg: "" });
    setDocumentEntry("");
  }, [request]);
  const key = selected || pets[0]?.id || "";
  const pet = pets.find((item) => item.id === key);
  const today = localDate();
  const patientEntries = entries
    .filter((item) => item.petId === key)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const patientAppointments = records
    .filter((item) => item.petId === key)
    .sort((a, b) =>
      `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`),
    );
  useEffect(() => {
    if (!selected && key) setSelected(key);
  }, [key, selected]);
  useEffect(() => {
    if (pet && !creating) setPetForm({ ...emptyPet(), ...pet });
    setPetErrors({});
  }, [pet, creating]);
  useEffect(() => {
    if (selected && !pets.some((pet) => pet.id === selected)) {
      setSelected(pets[0]?.id || "");
      setCreating(false);
      setInvoice(emptyInvoice());
      setPrevention(emptyPrevention());
    }
  }, [pets, selected]);
  const patientPreventive = preventive
    .filter((item) => item.petId === key)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const patientWeights = weights
    .filter((item) => item.petId === key)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
  const patientInvoices = invoices
    .filter((item) => item.petId === key)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const patientDocuments = documents
    .filter((item) => item.petId === key)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const upcoming = upcomingPreventive(
    preventive,
    localDate(new Date(Date.now() + 7 * 86400000)),
  );
  const remove = (collection, id, label) => {
    if (window.confirm(`¿Eliminar ${label}? No se puede deshacer.`)) {
      setData((previous) => ({
        ...previous,
        [collection]: previous[collection].filter((item) => item.id !== id),
      }));
      onNotice("Registro eliminado.");
    }
  };
  const savePet = (event) => {
    event.preventDefault();
    const validation = validatePet(petForm);
    setPetErrors(validation);
    if (Object.keys(validation).length) {
      document.getElementById(`pet-${Object.keys(validation)[0]}`)?.focus();
      return;
    }
    const record = Object.fromEntries(
      Object.entries(petForm).map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() : value,
      ]),
    );
    record.id = creating ? crypto.randomUUID() : pet?.id || crypto.randomUUID();
    setData((previous) => ({
      ...previous,
      pets: previous.pets.some((item) => item.id === record.id)
        ? previous.pets.map((item) => (item.id === record.id ? record : item))
        : [...previous.pets, record],
      records: previous.records.map((item) =>
        item.petId === record.id
          ? {
              ...item,
              nombre: record.nombre,
              propietario: record.propietario,
              email: record.email,
              especie: record.especie,
              telefono: record.telefono,
            }
          : item,
      ),
    }));
    setSelected(record.id);
    setCreating(false);
    onNotice("Ficha de mascota guardada.");
  };
  const addPrevention = (event) => {
    event.preventDefault();
    if (!pet) return;
    if (
      !prevention.producto.trim() ||
      !prevention.fecha ||
      prevention.fecha > today ||
      (prevention.proxima && prevention.proxima < prevention.fecha)
    ) {
      onNotice(
        "Revisa el producto, la fecha de aplicación y el próximo control.",
      );
      return;
    }
    setPreventive((previous) => [
      ...previous,
      {
        ...prevention,
        producto: prevention.producto.trim(),
        id: crypto.randomUUID(),
        petId: key,
      },
    ]);
    setPrevention(emptyPrevention());
    onNotice("Control preventivo registrado.");
  };
  const addWeight = (event) => {
    event.preventDefault();
    const kg = Number(weight.kg);
    if (
      !pet ||
      !weight.fecha ||
      weight.fecha > today ||
      !Number.isFinite(kg) ||
      kg <= 0 ||
      kg > 1000
    ) {
      onNotice("Indica una fecha válida y un peso entre 0 y 1.000 kg.");
      return;
    }
    setWeights((previous) => [
      ...previous,
      { id: crypto.randomUUID(), petId: key, fecha: weight.fecha, kg },
    ]);
    setWeight({ fecha: today, kg: "" });
    onNotice("Peso registrado.");
  };
  const saveInvoice = (event) => {
    event.preventDefault();
    try {
      if (
        !pet ||
        !invoice.concepto.trim() ||
        !invoice.fecha ||
        invoice.fecha > today
      )
        throw new Error("Revisa la fecha y el concepto del cobro.");
      const total = moneyToCents(invoice.total),
        pagado = moneyToCents(invoice.pagado);
      if (pagado > total)
        throw new Error("El importe pagado no puede superar el total.");
      const item = {
        ...invoice,
        id: invoice.id || crypto.randomUUID(),
        petId: key,
        total,
        pagado,
        concepto: invoice.concepto.trim(),
      };
      setInvoices((previous) =>
        invoice.id
          ? previous.map((entry) => (entry.id === invoice.id ? item : entry))
          : [...previous, item],
      );
      setInvoice(emptyInvoice());
      onNotice("Cobro guardado.");
    } catch (error) {
      onNotice(error.message);
    }
  };
  const upload = async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file || !pet) return;
    setUploading(true);
    try {
      if (
        !["application/pdf", "image/png", "image/jpeg"].includes(file.type) ||
        file.size > 2 * 1024 * 1024 ||
        !file.size
      )
        throw new Error("Adjunta un PDF, PNG o JPG de hasta 2 MB.");
      if (
        documents.reduce((sum, item) => sum + item.base64.length, 0) +
          Math.ceil((file.size * 4) / 3) >
        20 * 1024 * 1024
      )
        throw new Error(
          "Se alcanzó el límite de documentos de esta versión (20 MB). Exporta una copia y revisa los adjuntos.",
        );
      const buffer = new Uint8Array(await file.arrayBuffer());
      const signature =
        file.type === "application/pdf"
          ? [37, 80, 68, 70, 45]
          : file.type === "image/png"
            ? [137, 80, 78, 71, 13, 10, 26, 10]
            : [255, 216, 255];
      if (!signature.every((byte, i) => buffer[i] === byte))
        throw new Error("El archivo no corresponde a su formato.");
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
        reader.readAsDataURL(file);
      });
      setDocuments((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          petId: key,
          entryId: documentEntry,
          name: file.name,
          mime: file.type,
          base64,
          size: file.size,
          createdAt: new Date().toISOString(),
        },
      ]);
      onNotice("Documento adjuntado a la ficha.");
    } catch (error) {
      onNotice(error.message);
    } finally {
      setUploading(false);
    }
  };
  const changePet = (event) => {
    setSelected(event.target.value);
    setDocumentEntry("");
    setCreating(false);
    setInvoice(emptyInvoice());
    setPrevention(emptyPrevention());
    setWeight({ fecha: today, kg: "" });
  };
  return (
    <section
      className="medical-section"
      id="patient-care"
      aria-labelledby="pet-care-title"
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">MUCHO MÁS QUE UNA CITA</p>
          <h2 id="pet-care-title">Ficha integral del paciente</h2>
          <p>Pacientes, prevención y administración del consultorio.</p>
        </div>
        <button
          disabled={blocked}
          className="button primary"
          onClick={() => {
            setCreating(true);
            setPetForm(emptyPet());
            setPetErrors({});
            setTab("ficha");
          }}
        >
          ＋ Nueva mascota
        </button>
      </div>
      {upcoming.length > 0 && (
        <details className="panel reminders">
          <summary>
            ◷ {upcoming.length} controles vencidos o próximos (7 días)
          </summary>
          {upcoming.map((item) => (
            <div className="reminder" key={item.id}>
              <strong>
                {pets.find((pet) => pet.id === item.petId)?.nombre}
              </strong>
              <span>
                {item.tipo} · {item.producto}
              </span>
              <span
                className={`badge ${item.proxima < today ? "cancelada" : "pendiente"}`}
              >
                {item.proxima < today
                  ? "Vencido"
                  : item.proxima === today
                    ? "Hoy"
                    : "Próximo"}{" "}
                · {dateText(item.proxima)}
              </span>
              <button
                onClick={() => {
                  setSelected(item.petId);
                  setCreating(false);
                  setTab("prevencion");
                }}
              >
                Ver ficha
              </button>
            </div>
          ))}
        </details>
      )}
      {pets.length > 0 && (
        <div className="panel patient-selector">
          <label htmlFor="care-patient">Mascota</label>
          <select id="care-patient" value={key} onChange={changePet}>
            {pets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre} · {item.especie} · {item.propietario}
              </option>
            ))}
          </select>
          {pet && !creating && (
            <p>
              <strong>{pet.nombre}</strong> · {pet.especie} · Responsable:{" "}
              {pet.propietario}
              <span>
                {patientWeights.length
                  ? `Último peso: ${patientWeights[0].kg} kg (${dateText(patientWeights[0].fecha)})`
                  : "Sin peso registrado"}
              </span>
            </p>
          )}
        </div>
      )}
      {!creating && pet && (pet.alergias || pet.cronicas || pet.medicacion) && (
        <div className="clinical-alert">
          <strong>Antecedentes a tener presentes</strong>
          {pet.alergias && <p>Alergias: {pet.alergias}</p>}
          {pet.cronicas && <p>Enfermedades crónicas: {pet.cronicas}</p>}
          {pet.medicacion && <p>Medicación habitual: {pet.medicacion}</p>}
        </div>
      )}
      <div
        className="care-tabs"
        role="group"
        aria-label="Secciones de la ficha"
      >
        {[
          ["resumen", "Resumen"],
          ["ficha", "Ficha y antecedentes"],
          ["citas", "Citas"],
          ["historia", "Historia clínica"],
          ["prevencion", "Vacunas y desparasitación"],
          ["peso", "Peso"],
          ["documentos", "Documentos"],
          ["cobros", "Cobros"],
        ].map(([value, label]) => (
          <button
            disabled={creating && value !== "ficha"}
            key={value}
            className={tab === value ? "active" : ""}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {!pets.length && !creating ? (
        <div className="panel empty-state">
          <span aria-hidden="true">🐾</span>
          <h3>Crea tu primera ficha</h3>
          <p>
            Una mascota puede tener muchas citas y consultas. Sus datos se
            conservan en una sola ficha.
          </p>
          <button
            className="button primary"
            disabled={blocked}
            onClick={() => {
              setCreating(true);
              setPetForm(emptyPet());
              setPetErrors({});
              setTab("ficha");
            }}
          >
            Registrar mascota
          </button>
        </div>
      ) : (
        <div className="panel care-content">
          {tab === "resumen" && pet && (
            <PatientSummary pet={pet} onTab={setTab} />
          )}
          {tab === "historia" && pet && (
            <MedicalHistory
              appointments={records}
              onNotice={onNotice}
              petId={pet.id}
            />
          )}
          {tab === "citas" && pet && (
            <>
              <h3>Citas de {pet.nombre}</h3>
              <div className="record-list">
                {patientAppointments.map((item) => (
                  <article className="appointment" key={item.id}>
                    <div className="appointment-top">
                      <strong>
                        {dateText(item.fecha)} · {item.hora}
                      </strong>
                      <span className={`badge ${item.estado}`}>
                        {item.estado}
                      </span>
                    </div>
                    <p>
                      {item.servicio} · {item.duracion || 30} min
                    </p>
                    <p className="medical-note">{item.sintomas}</p>
                  </article>
                ))}
              </div>
              {!patientAppointments.length && (
                <p className="medical-note">
                  Esta mascota todavía no tiene citas.
                </p>
              )}
              <a className="button secondary" href="#appointment-form">
                Ir al formulario de citas
              </a>
            </>
          )}
          {tab === "ficha" && (
            <form onSubmit={savePet} noValidate>
              <fieldset disabled={blocked}>
                <h3>{creating ? "Nueva mascota" : "Ficha del paciente"}</h3>
                <div className="care-grid">
                  {Object.entries(petFields).map(([field, label]) => (
                    <div className="field" key={field}>
                      <label htmlFor={`pet-${field}`}>
                        {label}{" "}
                        {["nombre", "propietario", "email"].includes(field) && (
                          <span>*</span>
                        )}
                      </label>
                      <input
                        id={`pet-${field}`}
                        value={petForm[field]}
                        type={
                          field === "email"
                            ? "email"
                            : field === "telefono"
                              ? "tel"
                              : "text"
                        }
                        maxLength={160}
                        required={["nombre", "propietario", "email"].includes(
                          field,
                        )}
                        onChange={(event) => {
                          setPetForm((previous) => ({
                            ...previous,
                            [field]: event.target.value,
                          }));
                          setPetErrors((previous) => ({
                            ...previous,
                            [field]: "",
                          }));
                        }}
                        aria-invalid={Boolean(petErrors[field])}
                        aria-describedby={
                          petErrors[field] ? `pet-error-${field}` : undefined
                        }
                      />
                      {petErrors[field] && (
                        <small
                          className="field-error"
                          id={`pet-error-${field}`}
                        >
                          {petErrors[field]}
                        </small>
                      )}
                    </div>
                  ))}
                  <div className="field">
                    <label htmlFor="pet-species">Especie</label>
                    <select
                      id="pet-species"
                      value={petForm.especie}
                      onChange={(e) =>
                        setPetForm((previous) => ({
                          ...previous,
                          especie: e.target.value,
                        }))
                      }
                    >
                      {["Perro", "Gato", "Ave", "Conejo", "Otra"].map(
                        (item) => (
                          <option key={item}>{item}</option>
                        ),
                      )}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="pet-sex">Sexo</label>
                    <select
                      id="pet-sex"
                      value={petForm.sexo}
                      onChange={(e) =>
                        setPetForm((previous) => ({
                          ...previous,
                          sexo: e.target.value,
                        }))
                      }
                    >
                      {["Sin especificar", "Hembra", "Macho"].map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="pet-nacimiento">Fecha de nacimiento</label>
                    <input
                      id="pet-nacimiento"
                      type="date"
                      max={today}
                      value={petForm.nacimiento}
                      onChange={(e) =>
                        setPetForm((previous) => ({
                          ...previous,
                          nacimiento: e.target.value,
                        }))
                      }
                      aria-invalid={Boolean(petErrors.nacimiento)}
                      aria-describedby={
                        petErrors.nacimiento ? "birth-error" : undefined
                      }
                    />
                    {petErrors.nacimiento && (
                      <small id="birth-error" className="field-error">
                        {petErrors.nacimiento}
                      </small>
                    )}
                  </div>
                </div>
                <h3 className="care-subheading">Antecedentes y alertas</h3>
                <div className="care-grid">
                  {Object.entries(notesFields).map(([field, label]) => (
                    <div className="field" key={field}>
                      <label htmlFor={`pet-${field}`}>{label}</label>
                      <textarea
                        id={`pet-${field}`}
                        rows={3}
                        value={petForm[field]}
                        maxLength={4000}
                        onChange={(e) =>
                          setPetForm((previous) => ({
                            ...previous,
                            [field]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="care-actions">
                  <button className="button primary">Guardar ficha</button>
                  {creating && pets.length > 0 && (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setCreating(false)}
                    >
                      Cancelar nueva ficha
                    </button>
                  )}
                </div>
                <p className="form-note">
                  * Campos obligatorios · Un mismo responsable puede tener
                  varias mascotas.
                </p>
              </fieldset>
            </form>
          )}
          {tab === "prevencion" && pet && (
            <>
              <h3>Vacunas y desparasitación</h3>
              <form onSubmit={addPrevention}>
                <fieldset disabled={blocked}>
                  <div className="care-grid">
                    <div className="field">
                      <label htmlFor="prevent-type">Tipo</label>
                      <select
                        id="prevent-type"
                        value={prevention.tipo}
                        onChange={(e) =>
                          setPrevention((previous) => ({
                            ...previous,
                            tipo: e.target.value,
                          }))
                        }
                      >
                        <option>Vacuna</option>
                        <option>Desparasitación</option>
                      </select>
                    </div>
                    {[
                      ["producto", "Producto *", "text"],
                      ["fecha", "Fecha de aplicación *", "date"],
                      ["proxima", "Próximo control", "date"],
                      ["lote", "Lote / referencia", "text"],
                    ].map(([field, label, type]) => (
                      <div className="field" key={field}>
                        <label htmlFor={`prevent-${field}`}>{label}</label>
                        <input
                          id={`prevent-${field}`}
                          type={type}
                          value={prevention[field]}
                          required={["producto", "fecha"].includes(field)}
                          max={field === "fecha" ? today : undefined}
                          min={
                            field === "proxima" ? prevention.fecha : undefined
                          }
                          maxLength={160}
                          onChange={(e) =>
                            setPrevention((previous) => ({
                              ...previous,
                              [field]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    ))}
                    <div className="field">
                      <label htmlFor="prevent-notes">Observaciones</label>
                      <textarea
                        id="prevent-notes"
                        rows={2}
                        maxLength={2000}
                        value={prevention.notas}
                        onChange={(e) =>
                          setPrevention((previous) => ({
                            ...previous,
                            notas: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <button className="button primary">
                    Registrar aplicación
                  </button>
                </fieldset>
              </form>
              <div className="record-list">
                {patientPreventive.map((item) => (
                  <article className="appointment" key={item.id}>
                    <div className="appointment-top">
                      <h3>{item.producto}</h3>
                      <span className="badge atendida">{item.tipo}</span>
                    </div>
                    <p className="visit-reason">
                      Aplicación: {dateText(item.fecha)}
                      {item.proxima &&
                        ` · Próximo control: ${dateText(item.proxima)}`}
                      {item.lote && `\nLote: ${item.lote}`}
                      {item.notas && `\n${item.notas}`}
                    </p>
                    <div className="action-buttons">
                      <button
                        disabled={blocked}
                        className="danger-link"
                        onClick={() =>
                          remove("preventive", item.id, "este control")
                        }
                      >
                        Eliminar control
                      </button>
                    </div>
                  </article>
                ))}
                {!patientPreventive.length && (
                  <p className="medical-note">
                    Aún no hay aplicaciones registradas. Las fechas se ingresan
                    según las indicaciones del profesional.
                  </p>
                )}
              </div>
            </>
          )}
          {tab === "peso" && pet && (
            <>
              <h3>Evolución del peso</h3>
              <WeightChart records={patientWeights} />
              <form onSubmit={addWeight}>
                <fieldset disabled={blocked}>
                  <div className="care-grid">
                    <div className="field">
                      <label htmlFor="weight-date">Fecha</label>
                      <input
                        id="weight-date"
                        type="date"
                        max={today}
                        value={weight.fecha}
                        required
                        onChange={(e) =>
                          setWeight((previous) => ({
                            ...previous,
                            fecha: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="weight-kg">Peso en kg</label>
                      <input
                        id="weight-kg"
                        type="number"
                        min="0.001"
                        max="1000"
                        step="0.001"
                        value={weight.kg}
                        required
                        onChange={(e) =>
                          setWeight((previous) => ({
                            ...previous,
                            kg: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <button className="button primary">Registrar peso</button>
                </fieldset>
              </form>
              <div className="record-list">
                {patientWeights.map((item) => (
                  <article className="weight-row" key={item.id}>
                    <span>{dateText(item.fecha)}</span>
                    <strong>{item.kg} kg</strong>
                    <button
                      disabled={blocked}
                      className="danger-link"
                      onClick={() => remove("weights", item.id, "este peso")}
                    >
                      Eliminar
                    </button>
                  </article>
                ))}
                {!patientWeights.length && (
                  <p className="medical-note">
                    Registra el primer peso para comenzar el seguimiento.
                  </p>
                )}
              </div>
            </>
          )}
          {tab === "documentos" && pet && (
            <>
              <h3>Estudios y documentos</h3>
              <p className="medical-note">
                Adjunta análisis, imágenes o informes: PDF, PNG y JPG de hasta 2
                MB cada uno. Límite total de adjuntos: 20 MB.
              </p>
              <div className="field">
                <label htmlFor="document-entry">
                  Consulta asociada al nuevo documento
                </label>
                <select
                  id="document-entry"
                  value={documentEntry}
                  disabled={uploading || blocked}
                  onChange={(e) => setDocumentEntry(e.target.value)}
                >
                  <option value="">Documento general de la mascota</option>
                  {patientEntries.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.fecha} · {item.motivo.slice(0, 80)}
                    </option>
                  ))}
                </select>
              </div>
              <label className="button secondary upload-button document-upload">
                {uploading ? "Adjuntando…" : "＋ Adjuntar documento"}
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  disabled={blocked || uploading}
                  onChange={upload}
                />
              </label>
              <div className="record-list">
                {patientDocuments.map((item) => (
                  <article className="appointment" key={item.id}>
                    <h3>{item.name}</h3>
                    <p className="medical-note">
                      {dateText(item.createdAt.slice(0, 10))} ·{" "}
                      {(item.size / 1024).toFixed(0)} KB
                    </p>
                    <div className="field">
                      <label htmlFor={`document-link-${item.id}`}>
                        Asociar a consulta
                      </label>
                      <select
                        id={`document-link-${item.id}`}
                        value={item.entryId || ""}
                        disabled={blocked}
                        onChange={(e) => {
                          const entryId = e.target.value;
                          setDocuments((previous) =>
                            previous.map((document) =>
                              document.id === item.id
                                ? { ...document, entryId }
                                : document,
                            ),
                          );
                        }}
                      >
                        <option value="">
                          Documento general de la mascota
                        </option>
                        {patientEntries.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.fecha} · {entry.motivo.slice(0, 80)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="action-buttons">
                      <button onClick={() => downloadDocument(item)}>
                        Descargar documento
                      </button>
                      <button
                        disabled={blocked}
                        className="danger-link"
                        onClick={() =>
                          remove("documents", item.id, "este documento")
                        }
                      >
                        Eliminar documento
                      </button>
                    </div>
                  </article>
                ))}
                {!patientDocuments.length && (
                  <p className="medical-note">
                    No hay documentos adjuntos para esta mascota.
                  </p>
                )}
              </div>
            </>
          )}
          {tab === "cobros" && pet && (
            <>
              <h3>Consultas y pagos</h3>
              <div className="payment-summary">
                {["UYU", "USD"].map((currency) => (
                  <div className="stat" key={currency}>
                    <div>
                      <p>Saldo pendiente · {currency}</p>
                      <strong>
                        {money(
                          patientInvoices
                            .filter((item) => item.moneda === currency)
                            .reduce(
                              (sum, item) => sum + item.total - item.pagado,
                              0,
                            ),
                          currency,
                        )}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={saveInvoice}>
                <fieldset disabled={blocked}>
                  <h3>{invoice.id ? "Actualizar cobro" : "Nuevo cobro"}</h3>
                  <div className="care-grid">
                    {[
                      ["fecha", "Fecha", "date"],
                      ["concepto", "Concepto", "text"],
                      ["total", "Total", "number"],
                      ["pagado", "Pagado acumulado", "number"],
                    ].map(([field, label, type]) => (
                      <div className="field" key={field}>
                        <label htmlFor={`invoice-${field}`}>{label}</label>
                        <input
                          id={`invoice-${field}`}
                          type={type}
                          value={invoice[field]}
                          required
                          max={field === "fecha" ? today : undefined}
                          min={type === "number" ? 0 : undefined}
                          step={type === "number" ? "0.01" : undefined}
                          maxLength={160}
                          onChange={(e) =>
                            setInvoice((previous) => ({
                              ...previous,
                              [field]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    ))}
                    <div className="field">
                      <label htmlFor="invoice-currency">Moneda</label>
                      <select
                        id="invoice-currency"
                        value={invoice.moneda}
                        onChange={(e) =>
                          setInvoice((previous) => ({
                            ...previous,
                            moneda: e.target.value,
                          }))
                        }
                      >
                        <option>UYU</option>
                        <option>USD</option>
                      </select>
                    </div>
                  </div>
                  <div className="care-actions">
                    <button className="button primary">Guardar cobro</button>
                    {invoice.id && (
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => setInvoice(emptyInvoice())}
                      >
                        Cancelar actualización
                      </button>
                    )}
                  </div>
                </fieldset>
              </form>
              <div className="record-list">
                {patientInvoices.map((item) => (
                  <article className="appointment" key={item.id}>
                    <div className="appointment-top">
                      <h3>{item.concepto}</h3>
                      <span
                        className={`badge ${item.pagado === item.total ? "atendida" : "pendiente"}`}
                      >
                        {item.pagado === item.total ? "Pagado" : "Pendiente"}
                      </span>
                    </div>
                    <p className="visit-reason">
                      {dateText(item.fecha)} · Total:{" "}
                      {money(item.total, item.moneda)}
                      <br />
                      Pagado: {money(item.pagado, item.moneda)} · Saldo:{" "}
                      {money(item.total - item.pagado, item.moneda)}
                    </p>
                    <div className="action-buttons">
                      <button
                        disabled={blocked}
                        onClick={() => {
                          setInvoice({
                            ...item,
                            total: (item.total / 100).toFixed(2),
                            pagado: (item.pagado / 100).toFixed(2),
                          });
                          document.getElementById("invoice-pagado")?.focus();
                        }}
                      >
                        Actualizar pago
                      </button>
                      <button
                        disabled={blocked}
                        className="danger-link"
                        onClick={() =>
                          remove("invoices", item.id, "este cobro")
                        }
                      >
                        Eliminar cobro
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <p className="medical-note">
                Control interno de cobros. Las monedas se mantienen separadas;
                no genera facturas fiscales.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
PatientCare.propTypes = {
  onNotice: PropTypes.func.isRequired,
  request: PropTypes.shape({
    petId: PropTypes.string.isRequired,
    tab: PropTypes.string.isRequired,
    token: PropTypes.string.isRequired,
  }),
};
