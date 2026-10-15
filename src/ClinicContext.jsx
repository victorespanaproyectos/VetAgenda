import { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  collections,
  downloadJSON,
  readLegacy,
  validateBackup,
} from "./lib/clinic";
import { localDate } from "./lib/appointments";
import { ClinicContext as Context } from "./lib/useClinic";
async function api(path, options = {}) {
  const response = await fetch(`/api/${path}`, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "No se puede conectar con Python. Inicia el servidor: python backend/server.py",
    );
  }
  if (!response.ok) {
    const error = new Error(result.error || "Error de conexión");
    error.status = response.status;
    throw error;
  }
  return result;
}

export function ClinicGate({ children }) {
  const [initial, setInitial] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api("state")
      .then(setInitial)
      .catch((error) => {
        if (error.status !== 401) setError(error.message);
      })
      .finally(() => setChecking(false));
  }, []);
  const login = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("login", {
        method: "POST",
        body: JSON.stringify({ username: "admin", password }),
      });
      setInitial(await api("state"));
      setPassword("");
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  };
  if (initial)
    return (
      <ClinicProvider initial={initial} onLogout={() => setInitial(null)}>
        {children}
      </ClinicProvider>
    );
  return (
    <main className="login-screen">
      <section className="panel login-card">
        <span className="brand-mark" aria-hidden="true">
          ✚
        </span>
        <p className="eyebrow">BIENVENIDO A VETAGENDA</p>
        <h1>Tu consultorio, en orden.</h1>
        <p>Ingresa para acceder a la agenda y las fichas clínicas.</p>
        {checking ? (
          <p role="status">Conectando…</p>
        ) : (
          <form onSubmit={login}>
            <div className="field">
              <label htmlFor="login-user">Usuario</label>
              <input
                id="login-user"
                value="admin"
                readOnly
                autoComplete="username"
              />
            </div>
            <div className="field">
              <label htmlFor="login-password">Contraseña</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                maxLength={256}
              />
            </div>
            {error && (
              <p className="storage-warning" role="alert">
                {error}
              </p>
            )}
            <button className="button primary full" disabled={busy}>
              {busy ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
        )}
        <p className="form-note">
          Primero inicia Python en otra terminal:
          <br />
          <code>python backend/server.py</code>
          <br />
          La primera vez elegirás tu contraseña allí.
        </p>
      </section>
    </main>
  );
}
ClinicGate.propTypes = { children: PropTypes.node.isRequired };
function ClinicProvider({ initial, onLogout, children }) {
  const [data, setData] = useState(initial.data);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const desired = useRef(initial.data),
    saved = useRef(initial.data),
    revision = useRef(initial.version),
    inFlight = useRef(false),
    mounted = useRef(true),
    blocked = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const flush = useCallback(async function savePending() {
    if (
      inFlight.current ||
      blocked.current ||
      desired.current === saved.current
    )
      return;
    inFlight.current = true;
    if (mounted.current) setSaving(true);
    let succeeded = false;
    const snapshot = desired.current;
    try {
      const result = await api("state", {
        method: "PUT",
        body: JSON.stringify({ version: revision.current, data: snapshot }),
      });
      revision.current = result.version;
      saved.current = snapshot;
      succeeded = true;
      if (mounted.current) setError("");
    } catch (error) {
      if (mounted.current) setError(error.message);
      if ([409, 401].includes(error.status)) {
        blocked.current = true;
        if (mounted.current) setConflict(true);
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
      if (succeeded && desired.current !== saved.current && mounted.current)
        await savePending();
    }
  }, []);
  useEffect(() => {
    desired.current = data;
    const timer = setTimeout(flush, 350);
    return () => clearTimeout(timer);
  }, [data, flush]); // flush reads refs to serialize saves without overwriting newer edits.
  useEffect(() => {
    const handler = (event) => {
      if (desired.current !== saved.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  const context = {
    data,
    error,
    saving,
    conflict,
    setData,
    ...Object.fromEntries(
      collections.flatMap((key) => [
        [key, data[key]],
        [
          `set${key[0].toUpperCase()}${key.slice(1)}`,
          (updater) =>
            setData((previous) => ({
              ...previous,
              [key]:
                typeof updater === "function"
                  ? updater(previous[key])
                  : updater,
            })),
        ],
      ]),
    ),
  };
  const backup = () =>
    downloadJSON(
      { schema: "vetagenda-v2", exportedAt: new Date().toISOString(), data },
      `vetagenda-copia-${localDate()}.json`,
    );
  const restore = async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 24 * 1024 * 1024)
        throw new Error("La copia supera 24 MB.");
      const parsed = JSON.parse(await file.text());
      if (parsed.schema !== "vetagenda-v2")
        throw new Error("Selecciona una copia completa de esta versión.");
      const next = validateBackup(parsed.data);
      if (
        !window.confirm(
          "¿Reemplazar todos los datos por esta copia? Exporta tu copia actual antes.",
        )
      )
        return;
      await flush();
      if (blocked.current || desired.current !== saved.current)
        throw new Error("Primero resuelve los cambios sin guardar.");
      const result = await api("state", {
        method: "PUT",
        body: JSON.stringify({ version: revision.current, data: next }),
      });
      revision.current = result.version;
      saved.current = next;
      desired.current = next;
      setData(next);
      setError("");
    } catch (error) {
      setError(error.message);
    }
  };
  const migrate = () => {
    try {
      if (data.pets.length || data.records.length || data.entries.length)
        throw new Error(
          "La importación anterior requiere una base vacía para evitar duplicados.",
        );
      const next = readLegacy();
      if (!next.pets.length)
        throw new Error(
          "No se encontraron datos de versiones anteriores en este navegador.",
        );
      if (
        window.confirm(
          `¿Importar ${next.pets.length} mascotas y ${next.records.length} citas guardadas en este navegador? Los originales se conservarán.`,
        )
      )
        setData(next);
    } catch (error) {
      setError(error.message);
    }
  };
  const logout = async () => {
    await flush();
    if (
      desired.current !== saved.current &&
      !window.confirm(
        "Hay cambios sin guardar. Exporta una copia antes de salir. ¿Salir de todos modos?",
      )
    )
      return;
    try {
      await api("logout", { method: "POST" });
      onLogout();
    } catch (error) {
      setError(error.message);
    }
  };
  return (
    <Context.Provider value={context}>
      <div className="clinic-toolbar">
        <span>
          {saving
            ? "Guardando…"
            : error
              ? "Cambios pendientes"
              : "Base de datos conectada"}
        </span>
        <div>
          <button onClick={backup}>↓ Copia completa</button>
          <label className="upload-button">
            ↑ Restaurar copia
            <input
              type="file"
              accept="application/json,.json"
              onChange={restore}
              disabled={conflict}
            />
          </label>
          {!data.pets.length && (
            <button onClick={migrate}>Importar versión anterior</button>
          )}
          <button onClick={logout}>Cerrar sesión</button>
        </div>
      </div>
      {error && (
        <div className="sync-warning" role="alert">
          <p>
            {error} Tus cambios actuales siguen en memoria; descarga una copia
            completa.
          </p>
          {!conflict && (
            <button className="button secondary" onClick={flush}>
              Reintentar guardado
            </button>
          )}
          {conflict && (
            <button
              className="button secondary"
              onClick={() => {
                if (
                  window.confirm(
                    "¿Recargar y descartar los cambios sin guardar? Exporta una copia primero.",
                  )
                )
                  window.location.reload();
              }}
            >
              Recargar datos del servidor
            </button>
          )}
        </div>
      )}
      {children}
    </Context.Provider>
  );
}
ClinicProvider.propTypes = {
  initial: PropTypes.shape({
    data: PropTypes.object.isRequired,
    version: PropTypes.number.isRequired,
  }).isRequired,
  onLogout: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};
