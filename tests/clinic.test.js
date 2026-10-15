import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyClinic,
  migrateLegacy,
  moneyToCents,
  upcomingPreventive,
  validateBackup,
  validatePet,
} from "../src/lib/clinic.js";
import {
  emptyAppointment,
  hasConflict,
  validateAppointment,
} from "../src/lib/appointments.js";
const pet = {
  id: "pet-1",
  nombre: "Luna",
  propietario: "Ana",
  email: "ana@example.com",
  especie: "Gato",
};
const appointment = {
  ...emptyAppointment(),
  ...pet,
  id: "cita",
  fecha: "2026-10-13",
  hora: "09:00",
  duracion: 30,
  petId: pet.id,
  sintomas: "Control",
};
test("detecta superposición de intervalos y permite citas consecutivas", () => {
  assert.equal(
    hasConflict({ ...appointment, id: "other", hora: "09:15" }, [appointment]),
    true,
  );
  assert.equal(
    hasConflict({ ...appointment, id: "other", hora: "09:30" }, [appointment]),
    false,
  );
  assert.equal(
    hasConflict({ ...appointment, id: "other", hora: "08:45", duracion: 15 }, [
      appointment,
    ]),
    false,
  );
  assert.equal(
    hasConflict({ ...appointment, id: "other", hora: "08:45", duracion: 30 }, [
      appointment,
    ]),
    true,
  );
  assert.ok(
    validateAppointment({ ...appointment, hora: "23:45", duracion: 30 }, [])
      .hora,
  );
});
test("migra citas e historias a fichas estables compartidas", () => {
  const data = migrateLegacy(
    [appointment, { ...appointment, id: "second" }],
    [{ id: "history", patient: pet }],
  );
  assert.equal(data.pets.length, 1);
  assert.equal(data.records[0].petId, data.entries[0].petId);
  assert.ok(data.pets[0].id);
  assert.equal(data.records[0].duracion, 30);
});
test("valida nacimientos y correo de las fichas", () => {
  assert.deepEqual(validatePet(pet), {});
  assert.ok(validatePet({ ...pet, nacimiento: "2026-02-30" }).nacimiento);
  assert.ok(validatePet({ ...pet, email: "incorrecto" }).email);
});
test("importes se calculan en centésimos sin errores de coma flotante", () => {
  assert.equal(moneyToCents("0.10") + moneyToCents("0.20"), 30);
  assert.equal(moneyToCents("1500.5"), 150050);
  for (const value of ["-1", "NaN", "1.999", "Infinity", "1e5", ""])
    assert.throws(() => moneyToCents(value));
});
test("copia valida referencias y no admite duplicados ni huérfanos", () => {
  const data = { ...emptyClinic(), pets: [pet], records: [appointment] };
  assert.equal(validateBackup(data), data);
  assert.throws(() => validateBackup({ ...data, pets: [] }));
  assert.throws(() =>
    validateBackup({ ...data, records: [appointment, appointment] }),
  );
});
test("recordatorios usan la última aplicación del mismo producto por mascota", () => {
  const old = {
    id: "old",
    petId: pet.id,
    tipo: "Vacuna",
    producto: "Rabia",
    fecha: "2025-10-01",
    proxima: "2026-10-01",
  };
  const next = {
    ...old,
    id: "new",
    fecha: "2026-10-01",
    proxima: "2027-10-01",
  };
  assert.deepEqual(upcomingPreventive([old, next], "2026-10-20"), []);
  assert.deepEqual(
    upcomingPreventive([old, { ...next, petId: "other" }], "2026-10-20"),
    [old],
  );
});
