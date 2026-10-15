import { localDate, parseStored, STORAGE_KEY } from "./appointments.js";
import {
  HISTORY_KEY,
  parseMedicalHistory,
  patientKey,
} from "./medicalHistory.js";
export const collections = [
  "records",
  "entries",
  "pets",
  "preventive",
  "weights",
  "documents",
  "invoices",
];
export const emptyClinic = () =>
  Object.fromEntries(collections.map((key) => [key, []]));
export const emptyPet = () => ({
  nombre: "",
  especie: "Perro",
  raza: "",
  sexo: "Sin especificar",
  nacimiento: "",
  microchip: "",
  propietario: "",
  email: "",
  telefono: "",
  alergias: "",
  cronicas: "",
  medicacion: "",
  notas: "",
});
export function migrateLegacy(records, entries) {
  const data = emptyClinic();
  const index = new Map();
  const getId = (patient) => {
    const key = patientKey(patient);
    if (!index.has(key)) {
      const pet = {
        ...emptyPet(),
        nombre: patient.nombre,
        especie: patient.especie,
        propietario: patient.propietario,
        email: patient.email,
        telefono: patient.telefono || "",
        id: crypto.randomUUID(),
      };
      data.pets.push(pet);
      index.set(key, pet.id);
    }
    return index.get(key);
  };
  data.records = records.map((record) => ({
    ...record,
    petId: getId(record),
    duracion: Number(record.duracion) || 30,
  }));
  data.entries = entries.map((entry) => ({
    ...entry,
    petId: getId(entry.patient),
  }));
  return data;
}
export function readLegacy() {
  return migrateLegacy(
    parseStored(localStorage.getItem(STORAGE_KEY)),
    parseMedicalHistory(localStorage.getItem(HISTORY_KEY)),
  );
}
export function validatePet(pet) {
  const errors = {};
  for (const key of ["nombre", "propietario", "email"])
    if (!pet[key]?.trim()) errors[key] = "Completa este campo.";
  if (pet.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pet.email.trim()))
    errors.email = "Escribe un correo válido.";
  if (
    pet.nacimiento &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(pet.nacimiento) ||
      Number.isNaN(Date.parse(`${pet.nacimiento}T12:00:00`)) ||
      localDate(new Date(`${pet.nacimiento}T12:00:00`)) !== pet.nacimiento ||
      pet.nacimiento > new Date().toLocaleDateString("sv-SE"))
  )
    errors.nacimiento = "Revisa la fecha de nacimiento.";
  return errors;
}
export function moneyToCents(value) {
  if (!/^\d+(\.\d{1,2})?$/.test(String(value)))
    throw new Error("Usa importes positivos con hasta dos decimales.");
  const [whole, decimal = ""] = String(value).split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 100000000)
    throw new Error("Importe demasiado grande.");
  return cents;
}
export function validateBackup(data) {
  if (
    !data ||
    collections.some((key) => !Array.isArray(data[key])) ||
    Object.keys(data).some((key) => !collections.includes(key))
  )
    throw new Error("Copia de VetAgenda no válida.");
  const petIds = new Set(data.pets.map((p) => p.id));
  for (const key of collections) {
    const ids = new Set();
    for (const item of data[key]) {
      if (!item || typeof item.id !== "string" || ids.has(item.id))
        throw new Error("Identificadores inválidos en la copia.");
      ids.add(item.id);
      if (key !== "pets" && !petIds.has(item.petId))
        throw new Error("La copia contiene registros sin mascota.");
    }
  }
  const entryPets = new Map(
    data.entries.map((entry) => [entry.id, entry.petId]),
  );
  for (const document of data.documents) {
    if (
      document.entryId !== undefined &&
      (typeof document.entryId !== "string" ||
        (document.entryId &&
          entryPets.get(document.entryId) !== document.petId))
    )
      throw new Error(
        "El documento está asociado a una consulta no válida para esta mascota.",
      );
  }
  return data;
}
export function downloadJSON(data, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function upcomingPreventive(records, cutoff) {
  const latest = new Map();
  for (const record of records) {
    const key = JSON.stringify([
      record.petId,
      record.tipo,
      record.producto.trim().toLocaleLowerCase("es"),
    ]);
    if (!latest.has(key) || latest.get(key).fecha <= record.fecha)
      latest.set(key, record);
  }
  return [...latest.values()]
    .filter((record) => record.proxima && record.proxima <= cutoff)
    .sort((a, b) => a.proxima.localeCompare(b.proxima));
}

export function downloadDocument(item) {
  const binary = atob(item.base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: item.mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = item.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
