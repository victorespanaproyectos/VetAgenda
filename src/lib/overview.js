import { localDate } from "./appointments.js";
import { upcomingPreventive } from "./clinic.js";

export function shiftDate(value, days) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDate(date);
}
export function calendarDays(anchor, mode) {
  if (mode === "day") return [anchor];
  const weekday = new Date(`${anchor}T12:00:00`).getDay();
  const monday = shiftDate(anchor, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
}
export const minutes = (time) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};
export const timeLabel = (value) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

// Assign lanes to connected overlapping intervals, including completed/cancelled visits.
export function calendarLayout(records) {
  const sorted = [...records].sort(
    (a, b) => minutes(a.hora) - minutes(b.hora) || a.id.localeCompare(b.id),
  );
  const groups = [];
  let group = [],
    end = -1;
  for (const record of sorted) {
    const start = minutes(record.hora);
    if (start >= end && group.length) {
      groups.push(group);
      group = [];
      end = -1;
    }
    group.push(record);
    end = Math.max(end, start + Number(record.duracion || 30));
  }
  if (group.length) groups.push(group);
  return groups.flatMap((items) => {
    const ends = [];
    const placed = items.map((record) => {
      const start = minutes(record.hora);
      let lane = ends.findIndex((end) => end <= start);
      if (lane < 0) lane = ends.length;
      ends[lane] = start + Number(record.duracion || 30);
      return { record, lane };
    });
    return placed.map((item) => ({ ...item, lanes: ends.length }));
  });
}
export function clinicSummary(data, today = localDate()) {
  const todayRecords = data.records
    .filter((item) => item.fecha === today && item.estado !== "cancelada")
    .sort((a, b) => a.hora.localeCompare(b.hora));
  const reminders = upcomingPreventive(data.preventive, shiftDate(today, 7));
  const balances = Object.fromEntries(
    ["UYU", "USD"].map((currency) => [
      currency,
      data.invoices
        .filter((item) => item.moneda === currency)
        .reduce((sum, item) => sum + item.total - item.pagado, 0),
    ]),
  );
  return { todayRecords, reminders, balances };
}
