import { localDate } from "./appointments.js";
export const HISTORY_KEY = "vetagenda-historia-v1";
export const patientKey = (patient) =>
  JSON.stringify(
    [patient.nombre, patient.propietario, patient.email, patient.especie].map(
      (value) => (value || "").trim().toLocaleLowerCase("es"),
    ),
  );
export const emptyMedicalEntry = () => ({
  fecha: localDate(),
  motivo: "",
  diagnostico: "",
  tratamiento: "",
  notas: "",
});
export function validateMedicalEntry(entry, today = localDate()) {
  const errors = {};
  if (!entry.motivo?.trim()) errors.motivo = "Indica el motivo de la consulta.";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(entry.fecha) ||
    Number.isNaN(Date.parse(`${entry.fecha}T12:00:00`)) ||
    localDate(new Date(`${entry.fecha}T12:00:00`)) !== entry.fecha
  )
    errors.fecha = "Selecciona una fecha válida.";
  else if (entry.fecha > today)
    errors.fecha = "Una consulta médica no puede estar en el futuro.";
  return errors;
}
export function parseMedicalHistory(raw) {
  if (raw === null) return [];
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error("Historia no válida");
  const ids = new Set();
  for (const entry of data) {
    if (
      !entry ||
      [
        "id",
        "patientKey",
        "fecha",
        "motivo",
        "diagnostico",
        "tratamiento",
        "notas",
      ].some((key) => typeof entry[key] !== "string") ||
      !entry.patient ||
      ["nombre", "propietario", "email", "especie"].some(
        (key) => typeof entry.patient[key] !== "string",
      ) ||
      entry.patientKey !== patientKey(entry.patient) ||
      ids.has(entry.id) ||
      Object.keys(validateMedicalEntry(entry)).length
    )
      throw new Error("Registro médico no válido");
    ids.add(entry.id);
  }
  return data;
}
export function patientProfiles(appointments, entries) {
  const profiles = new Map();
  for (const patient of [
    ...entries.map((entry) => entry.patient),
    ...appointments,
  ])
    profiles.set(patientKey(patient), {
      nombre: patient.nombre,
      propietario: patient.propietario,
      email: patient.email,
      especie: patient.especie,
    });
  return [...profiles.entries()]
    .map(([key, patient]) => ({ key, ...patient }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
export const entriesForPatient = (entries, key) =>
  entries
    .filter((entry) => (entry.petId || entry.patientKey) === key)
    .sort(
      (a, b) =>
        b.fecha.localeCompare(a.fecha) ||
        (b.createdAt || "").localeCompare(a.createdAt || ""),
    );
