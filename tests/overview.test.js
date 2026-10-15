import test from "node:test";
import assert from "node:assert/strict";
import {
  calendarDays,
  calendarLayout,
  clinicSummary,
  shiftDate,
} from "../src/lib/overview.js";
import { emptyClinic, validateBackup } from "../src/lib/clinic.js";
test("week starts on Monday, including Sunday and year boundaries", () => {
  assert.deepEqual(calendarDays("2027-01-03", "week"), [
    "2026-12-28",
    "2026-12-29",
    "2026-12-30",
    "2026-12-31",
    "2027-01-01",
    "2027-01-02",
    "2027-01-03",
  ]);
  assert.deepEqual(calendarDays("2026-10-15", "day"), ["2026-10-15"]);
  assert.equal(shiftDate("2026-12-31", 1), "2027-01-01");
});
test("visual calendar separates overlapping visits and reuses free lanes", () => {
  const items = [
    { id: "a", hora: "09:00", duracion: 60 },
    { id: "b", hora: "09:15", duracion: 15 },
    { id: "c", hora: "09:30", duracion: 30 },
    { id: "d", hora: "10:00", duracion: 30 },
  ];
  const result = calendarLayout(items);
  assert.deepEqual(
    result.map(({ lane, lanes }) => [lane, lanes]),
    [
      [0, 2],
      [1, 2],
      [1, 2],
      [0, 1],
    ],
  );
  assert.equal(items[0].lane, undefined);
});
test("summary excludes cancelled visits and keeps currencies separate in cents", () => {
  const data = emptyClinic();
  data.records = [
    { id: "a", fecha: "2026-10-15", hora: "10:00", estado: "atendida" },
    { id: "b", fecha: "2026-10-15", hora: "09:00", estado: "pendiente" },
    { id: "c", fecha: "2026-10-15", hora: "11:00", estado: "cancelada" },
  ];
  data.invoices = [
    { moneda: "UYU", total: 1250, pagado: 200 },
    { moneda: "USD", total: 300, pagado: 125 },
  ];
  data.preventive = [
    {
      id: "p",
      petId: "pet",
      tipo: "Vacuna",
      producto: "X",
      fecha: "2026-10-01",
      proxima: "2026-10-16",
    },
  ];
  const summary = clinicSummary(data, "2026-10-15");
  assert.deepEqual(
    summary.todayRecords.map((item) => item.id),
    ["b", "a"],
  );
  assert.deepEqual(summary.balances, { UYU: 1050, USD: 175 });
  assert.equal(summary.reminders.length, 1);
});
test("old backups remain valid; documents may link only to the same patient", () => {
  const data = emptyClinic();
  data.pets = [{ id: "pet" }, { id: "other" }];
  data.entries = [{ id: "entry", petId: "pet" }];
  data.documents = [{ id: "doc", petId: "pet" }];
  assert.equal(validateBackup(data), data);
  data.documents[0].entryId = "entry";
  assert.equal(validateBackup(data), data);
  data.documents[0].petId = "other";
  assert.throws(() => validateBackup(data), /consulta/);
  data.documents[0].entryId = "missing";
  assert.throws(() => validateBackup(data), /consulta/);
});
