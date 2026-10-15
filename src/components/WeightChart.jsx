import PropTypes from "prop-types";
export default function WeightChart({ records }) {
  const points = [...records].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id),
  );
  if (!points.length) return null;
  const start = Date.parse(`${points[0].fecha}T12:00:00Z`);
  const end = Date.parse(`${points.at(-1).fecha}T12:00:00Z`);
  const values = points.map((point) => point.kg);
  const lo = Math.min(...values),
    hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.2, hi * 0.05, 0.1);
  const min = Math.max(0, lo - pad),
    max = hi + pad;
  const x = (point) =>
    end === start
      ? 330
      : 62 +
        ((Date.parse(`${point.fecha}T12:00:00Z`) - start) / (end - start)) *
          536;
  const y = (point) => 182 - ((point.kg - min) / (max - min)) * 150;
  const delta = Math.round((points.at(-1).kg - points[0].kg) * 1000) / 1000;
  return (
    <figure className="weight-chart">
      <figcaption>
        <strong>Evolución registrada</strong>
        <span>
          {points.length} mediciones ·{" "}
          {points.length > 1
            ? `Cambio: ${delta > 0 ? "+" : ""}${delta} kg`
            : "Agrega otra medición para comparar"}
        </span>
      </figcaption>
      <svg
        viewBox="0 0 660 230"
        role="img"
        aria-label={`Peso por fecha, desde ${points[0].fecha} hasta ${points.at(-1).fecha}. Último peso: ${points.at(-1).kg} kg. Datos completos en la lista siguiente.`}
      >
        {[0, 1, 2, 3].map((i) => {
          const value = min + ((max - min) * i) / 3;
          const pos = 182 - i * 50;
          return (
            <g key={i}>
              <line
                x1="62"
                x2="598"
                y1={pos}
                y2={pos}
                className="chart-grid-line"
              />
              <text x="52" y={pos + 4} textAnchor="end">
                {Number(value.toFixed(2))}
              </text>
            </g>
          );
        })}
        <polyline
          points={points.map((point) => `${x(point)},${y(point)}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        {points.map((point) => (
          <circle
            key={point.id}
            cx={x(point)}
            cy={y(point)}
            r="4"
            fill="currentColor"
          >
            <title>
              {point.fecha}: {point.kg} kg
            </title>
          </circle>
        ))}
        <text x="62" y="214">
          {points[0].fecha}
        </text>
        <text x="598" y="214" textAnchor="end">
          {points.at(-1).fecha}
        </text>
        <text x="16" y="20">
          kg
        </text>
      </svg>
      <p className="medical-note">
        El eje horizontal representa el tiempo entre mediciones. La escala
        vertical se ajusta a los pesos registrados.
      </p>
    </figure>
  );
}
WeightChart.propTypes = { records: PropTypes.array.isRequired };
