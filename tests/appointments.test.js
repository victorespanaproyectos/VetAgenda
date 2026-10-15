import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyAppointment,
  filterAppointments,
  hasConflict,
  parseStored,
  validateAppointment,
} from "../src/lib/appointments.js";
const sample = {
  ...emptyAppointment(),
  id: "1",
  nombre: "Luna",
  propietario: "Ana",
  email: "ana@example.com",
  fecha: "2026-10-20",
  hora: "09:00",
  sintomas: "Control",
};
test("migra registros originales sin perder sus datos", () => {
  const legacy = Object.fromEntries(
    ["id", "nombre", "propietario", "email", "fecha", "sintomas"].map((key) => [
      key,
      sample[key],
    ]),
  );
  const [record] = parseStored(JSON.stringify([legacy]));
  assert.equal(record.id, legacy.id);
  assert.equal(record.sintomas, "Control");
  assert.equal(record.hora, "09:00");
  assert.equal(record.estado, "pendiente");
});
test("datos corruptos se rechazan y no se interpretan como una agenda vacía", () => {
  for (const raw of ["{", "{}", "[null]", '[{"id":"1"}]'])
    assert.throws(() => parseStored(raw));
  assert.deepEqual(parseStored(null), []);
});
test("rechaza espacios, correo incorrecto, fecha imposible y hora incorrecta", () => {
  const errors = validateAppointment(
    {
      ...sample,
      nombre: "  ",
      email: "correo",
      fecha: "2026-02-30",
      hora: "25:00",
    },
    [],
    "2026-10-13",
  );
  for (const field of ["nombre", "email", "fecha", "hora"])
    assert.ok(errors[field]);
});
test("impide nuevas citas en el pasado pero permite actualizar un registro histórico", () => {
  const form = { ...sample, id: undefined, fecha: "2026-10-12" };
  assert.ok(validateAppointment(form, [], "2026-10-13").fecha);
  assert.deepEqual(
    validateAppointment({ ...form, id: "existing" }, [], "2026-10-13"),
    {},
  );
});
test("reserva horarios solo para pendientes y permite editar la propia cita", () => {
  assert.equal(hasConflict({ ...sample, id: "2" }, [sample]), true);
  assert.equal(hasConflict(sample, [sample]), false);
  assert.equal(
    hasConflict({ ...sample, id: "2", estado: "cancelada" }, [sample]),
    false,
  );
  assert.equal(
    hasConflict({ ...sample, id: "2" }, [{ ...sample, estado: "atendida" }]),
    false,
  );
});
test("combina búsqueda, fecha y estado y ordena cronológicamente sin mutar datos", () => {
  const records = [
    { ...sample, id: "2", hora: "11:00" },
    sample,
    { ...sample, id: "3", estado: "cancelada" },
  ];
  assert.deepEqual(
    filterAppointments(records, " ANA ", "pendiente", sample.fecha).map(
      (item) => item.id,
    ),
    ["1", "2"],
  );
  assert.equal(records[0].id, "2");
});
