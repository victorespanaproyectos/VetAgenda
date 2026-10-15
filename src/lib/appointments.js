export const STORAGE_KEY = "pacientes";
export const STATUSES = {
  pendiente: "Pendiente",
  atendida: "Atendida",
  cancelada: "Cancelada",
};
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const emptyAppointment = () => ({
  nombre: "",
  propietario: "",
  email: "",
  telefono: "",
  especie: "Perro",
  servicio: "Consulta general",
  fecha: localDate(),
  hora: "09:00",
  duracion: 30,
  petId: "",
  sintomas: "",
  estado: "pendiente",
});
export function parseStored(raw) {
  if (raw === null) return [];
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error("Formato de datos no válido");
  return data.map((record) => {
    if (
      !record ||
      ["id", "nombre", "propietario", "email", "fecha", "sintomas"].some(
        (key) => typeof record[key] !== "string",
      )
    )
      throw new Error("Hay registros no válidos");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(record.fecha) ||
      Number.isNaN(Date.parse(`${record.fecha}T12:00:00`)) ||
      localDate(new Date(`${record.fecha}T12:00:00`)) !== record.fecha
    )
      throw new Error("Fecha guardada no válida");
    return {
      ...emptyAppointment(),
      ...record,
      estado: Object.hasOwn(STATUSES, record.estado)
        ? record.estado
        : "pendiente",
      hora: record.hora || "09:00",
    };
  });
}
export function validateAppointment(form, records, today = localDate()) {
  const errors = {};
  for (const key of [
    "nombre",
    "propietario",
    "email",
    "fecha",
    "hora",
    "sintomas",
  ]) {
    if (!form[key]?.trim()) errors[key] = "Completa este campo.";
  }
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    errors.email = "Escribe un correo válido.";
  if (
    form.fecha &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(form.fecha) ||
      Number.isNaN(Date.parse(`${form.fecha}T12:00:00`)) ||
      localDate(new Date(`${form.fecha}T12:00:00`)) !== form.fecha)
  )
    errors.fecha = "Selecciona una fecha válida.";
  if (!form.id && form.fecha < today)
    errors.fecha = "La nueva cita debe ser de hoy o una fecha posterior.";
  if (form.hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.hora))
    errors.hora = "Selecciona una hora válida.";
  if (![15, 30, 45, 60, 90, 120].includes(Number(form.duracion || 30)))
    errors.duracion = "Selecciona una duración válida.";
  const [hour, minute] = (form.hora || "00:00").split(":").map(Number);
  if (hour * 60 + minute + Number(form.duracion || 30) > 1440)
    errors.hora = "La consulta debe terminar el mismo día.";
  if (hasConflict(form, records))
    errors.hora = "La consulta se superpone con otra cita pendiente.";
  return errors;
}
export function hasConflict(form, records) {
  const minutes = (value) => {
    const [hour, minute] = value.split(":").map(Number);
    return hour * 60 + minute;
  };
  const start = minutes(form.hora || "00:00");
  const end = start + Number(form.duracion || 30);
  return (
    form.estado === "pendiente" &&
    records.some((record) => {
      const otherStart = minutes(record.hora);
      return (
        record.id !== form.id &&
        record.estado === "pendiente" &&
        record.fecha === form.fecha &&
        start < otherStart + Number(record.duracion || 30) &&
        otherStart < end
      );
    })
  );
}
export function filterAppointments(records, search, status, date) {
  const query = search.trim().toLocaleLowerCase("es");
  return records
    .filter(
      (record) =>
        (!status || record.estado === status) &&
        (!date || record.fecha === date) &&
        `${record.nombre} ${record.propietario} ${record.email}`
          .toLocaleLowerCase("es")
          .includes(query),
    )
    .sort((a, b) =>
      `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`),
    );
}
export function demoAppointments(today = localDate()) {
  return [
    {
      nombre: "Luna",
      propietario: "Sofía Martínez",
      especie: "Gato",
      hora: "09:00",
      servicio: "Control de salud",
      sintomas: "Control anual y revisión de alimentación.",
      estado: "pendiente",
    },
    {
      nombre: "Rocky",
      propietario: "Diego Silva",
      especie: "Perro",
      hora: "10:30",
      servicio: "Vacunación",
      sintomas: "Revisión del carné y vacunas de refuerzo.",
      estado: "pendiente",
    },
    {
      nombre: "Coco",
      propietario: "Ana Pérez",
      especie: "Ave",
      hora: "11:30",
      servicio: "Consulta general",
      sintomas: "Seguimiento después de la consulta inicial.",
      estado: "atendida",
    },
  ].map((record, i) => ({
    ...emptyAppointment(),
    ...record,
    id: crypto.randomUUID(),
    fecha: today,
    email: `demo${i + 1}@example.com`,
  }));
}
