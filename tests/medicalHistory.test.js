import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyMedicalEntry,
  entriesForPatient,
  parseMedicalHistory,
  patientKey,
  patientProfiles,
  validateMedicalEntry,
} from "../src/lib/medicalHistory.js";
const patient = {
  nombre: "Luna",
  propietario: "Ana",
  email: "ana@example.com",
  especie: "Gato",
};
const entry = {
  ...emptyMedicalEntry(),
  id: "1",
  fecha: "2026-10-13",
  motivo: "Control anual",
  patient,
  patientKey: patientKey(patient),
  createdAt: "2026-10-13T12:00:00Z",
};
test("identifica mascota por nombre, especie y responsable sin depender de la cita", () => {
  assert.equal(
    patientKey({ ...patient, nombre: " LUNA " }),
    patientKey(patient),
  );
  assert.notEqual(
    patientKey({ ...patient, email: "otro@example.com" }),
    patientKey(patient),
  );
  assert.notEqual(
    patientKey({ ...patient, especie: "Perro" }),
    patientKey(patient),
  );
});
test("conserva perfiles médicos al eliminar las citas y deduplica consultas", () => {
  assert.equal(patientProfiles([patient, patient], [entry]).length, 1);
  assert.equal(patientProfiles([], [entry])[0].nombre, "Luna");
});
test("valida el motivo, la fecha y permite datos clínicos opcionales", () => {
  assert.deepEqual(validateMedicalEntry(entry, "2026-10-13"), {});
  assert.ok(validateMedicalEntry({ ...entry, motivo: "  " }).motivo);
  assert.ok(validateMedicalEntry({ ...entry, fecha: "2026-02-30" }).fecha);
  assert.ok(
    validateMedicalEntry({ ...entry, fecha: "2026-10-14" }, "2026-10-13").fecha,
  );
});
test("rechaza historias corruptas, ids repetidos y asociaciones alteradas", () => {
  assert.deepEqual(parseMedicalHistory(null), []);
  assert.deepEqual(parseMedicalHistory(JSON.stringify([entry])), [entry]);
  for (const raw of [
    "{",
    "{}",
    "[null]",
    JSON.stringify([entry, entry]),
    JSON.stringify([{ ...entry, patientKey: "wrong" }]),
  ])
    assert.throws(() => parseMedicalHistory(raw));
});
test("separa mascotas y ordena consultas recientes primero sin mutar datos", () => {
  const records = [
    { ...entry, id: "old", fecha: "2026-10-10" },
    entry,
    { ...entry, id: "other", patientKey: "another" },
  ];
  assert.deepEqual(
    entriesForPatient(records, entry.patientKey).map((item) => item.id),
    ["1", "old"],
  );
  assert.equal(records[0].id, "old");
});
