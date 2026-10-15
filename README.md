# VetAgenda

### Agenda y gestión de pacientes veterinarios

**VetAgenda** reúne la organización de citas y el seguimiento de cada mascota en una aplicación web con **React, Python y SQLite**. Permite consultar la agenda diaria o semanal, registrar atenciones, mantener la historia clínica y administrar controles preventivos, documentos y cobros desde una ficha integral.

Desarrollado por **Víctor España** como proyecto de portfolio, con foco en experiencia de usuario, reglas de negocio, persistencia y validación de datos.

**Versión actual:** 2.1.0 · **Modalidad:** aplicación local · **Interfaz:** español, tema claro y oscuro.

## Contenido

- [Descripción del proyecto](#descripción-del-proyecto)
- [Funcionalidades](#funcionalidades)
- [Tecnologías](#tecnologías)
- [Instalación y ejecución](#instalación-y-ejecución)
- [Primeros pasos](#primeros-pasos)
- [Actualizar sin perder datos](#actualizar-sin-perder-datos)
- [Almacenamiento y respaldos](#almacenamiento-y-respaldos)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Pruebas y calidad](#pruebas-y-calidad)
- [Solución de problemas](#solución-de-problemas)
- [Alcance y próximas mejoras](#alcance-y-próximas-mejoras)
- [Autor](#autor)

## Descripción del proyecto

La atención de una mascota no termina con una cita. VetAgenda conecta su agenda, antecedentes y registros de atención mediante un identificador permanente por paciente, de modo que los datos clínicos se mantienen asociados aunque cambien su nombre o los datos del responsable.

El flujo comienza con el registro de una mascota y continúa con sus citas, consultas, vacunas, desparasitación, mediciones de peso y documentos. El panel de inicio permite revisar la actividad del día, los controles por atender y los saldos pendientes en un mismo lugar.

El proyecto integra una interfaz en React con una API local en Python y almacenamiento en SQLite. Incluye autenticación, guardado automático, control de conflictos entre sesiones y copias de seguridad.

## Funcionalidades

| Módulo              | Funcionalidades principales                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel de inicio     | Atenciones de hoy, controles vencidos o próximos en siete días, cantidad de mascotas y saldos pendientes separados en UYU y USD.                                 |
| Agenda visual       | Vistas diaria y semanal, navegación por fecha, búsqueda y filtros por estado. Bloques proporcionales a la duración y columnas para citas superpuestas.           |
| Gestión de citas    | Alta, edición, cancelación y cambio a atendida. Duraciones de 15, 30, 45, 60, 90 o 120 minutos y detección de superposición entre citas pendientes.              |
| Ficha integral      | Resumen, datos de la mascota y del responsable, antecedentes, citas, historia clínica, prevención, peso, documentos y cobros.                                    |
| Historia clínica    | Registro de consultas, motivo, diagnóstico, tratamiento y seguimiento. Edición, eliminación e indicaciones imprimibles o guardables como PDF desde el navegador. |
| Prevención          | Vacunas y desparasitación con producto, lote, fecha de aplicación y próximo control. Recordatorios internos según las fechas registradas.                        |
| Evolución del peso  | Mediciones por fecha, gráfico temporal, cambio entre la primera y última medición y listado completo.                                                            |
| Documentos          | Adjuntos PDF, PNG y JPG por mascota, con asociación opcional a una consulta, descarga y eliminación.                                                             |
| Cobros              | Concepto, total, importe pagado acumulado y saldo. Actualización de pagos parciales y cálculo independiente por moneda.                                          |
| Respaldo            | Exportación y restauración de copias completas JSON, junto con copias automáticas de SQLite.                                                                     |
| Acceso y apariencia | Usuario administrador, cierre de sesión, sesiones de ocho horas y preferencia persistente de tema claro u oscuro.                                                |

### Novedades de la versión 2.1

- Agenda visual diaria y semanal, con acceso para editar citas o preparar una nueva desde un horario.
- Panel de inicio con accesos directos a la mascota y al apartado correspondiente.
- Ficha integral que reúne la información clínica y administrativa de cada paciente.
- Actividad clínica reciente con consultas, controles, pesos y documentos.
- Gráfico de evolución del peso sobre un eje temporal real.
- Documentos vinculados a consultas de la misma mascota. Al eliminar una consulta, sus documentos permanecen en la ficha general.

## Tecnologías

| Capa                 | Herramientas y enfoque                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Interfaz             | React 18, JavaScript, HTML y CSS.                                                                             |
| Desarrollo y estilos | Vite 8 y Tailwind CSS 4.                                                                                      |
| Servidor             | Python 3 y su biblioteca estándar, sin dependencias de `pip`.                                                 |
| Persistencia         | SQLite, con almacenamiento de las colecciones como un documento JSON versionado y escrituras transaccionales. |
| Autenticación        | Contraseñas derivadas con PBKDF2 y sal aleatoria; sesiones mediante tokens y cookies HttpOnly/SameSite.       |
| Calidad              | ESLint, Prettier, pruebas con `node:test` y `unittest`.                                                       |

La API valida referencias entre mascotas y registros, fechas, importes y formatos de documentos antes de guardar. El guardado utiliza un número de versión para detectar escrituras concurrentes y evitar que una sesión sobrescriba cambios de otra.

## Instalación y ejecución

### Requisitos

- **Node.js:** 20.19+ en la rama 20, o 22.12+ en versiones posteriores compatibles con Vite.
- **npm**, incluido con Node.js.
- **Python 3.10 o superior**, con soporte para SQLite.

Comprueba las versiones desde una terminal:

```bash
node --version
npm --version
python --version
```

En algunos equipos Windows el comando de Python es `py`; en Linux y WSL puede ser `python3`. Usa el comando disponible en tu sistema en los pasos siguientes.

### 1. Preparar el proyecto

Descomprime la entrega y abre una terminal dentro de la carpeta `VetAgenda`, donde se encuentran `package.json` y la carpeta `backend`.

Instala las dependencias de la interfaz:

```bash
npm ci
```

### 2. Iniciar el servidor

En la primera terminal ejecuta:

```bash
python backend/server.py
```

En la primera ejecución se crea la base de datos y se solicita una contraseña de **al menos doce caracteres**, junto con su confirmación. El usuario de acceso es **`admin`**.

Es normal que la contraseña no se vea mientras la escribes en la terminal. Mantén esta terminal abierta mientras utilizas la aplicación.

### 3. Iniciar la interfaz

Abre una segunda terminal dentro de la misma carpeta y ejecuta:

```bash
npm run dev
```

Abre la dirección indicada por Vite, normalmente **http://localhost:5173/**, e ingresa con `admin` y la contraseña elegida.

**Para iniciar VetAgenda en otra ocasión**, basta con ejecutar Python y Vite en sus respectivas terminales. La instalación con `npm ci` se necesita al preparar o actualizar las dependencias del proyecto.

## Primeros pasos

1. En **Fichas y cuidados**, crea una mascota e ingresa los datos de su responsable.
2. En **Nueva cita**, selecciona la mascota y completa fecha, hora, duración y motivo.
3. Revisa la atención en la **Agenda visual** o en la lista de citas. Puedes abrir la ficha desde el panel y la lista.
4. Dentro de la ficha, utiliza **Historia clínica** para registrar la consulta y sus indicaciones.
5. Agrega controles preventivos, pesos, documentos o cobros desde las pestañas correspondientes.
6. Descarga periódicamente una **Copia completa**.

Si quieres explorar antes de cargar tus propios registros, **Cargar demostración** añade mascotas y citas ficticias cuando la agenda está vacía. Los datos de ejemplo no incluyen diagnósticos ni tratamientos.

## Actualizar sin perder datos

### Desde VetAgenda 2.0 o una instalación de 2.1

La actualización reemplaza el código y conserva la base de datos existente.

1. Abre la versión actual y descarga una **Copia completa**.
2. Detén Python y Vite con `Ctrl + C` en ambas terminales.
3. Guarda también una copia de la carpeta completa del proyecto.
4. Descomprime el ZIP nuevo en una carpeta temporal.
5. Copia **el contenido** de su carpeta `VetAgenda` dentro de tu carpeta actual. Acepta reemplazar los archivos de código.
6. **Conserva `backend/data` y no elimines la carpeta del proyecto antes de copiar.** La entrega no incluye una base de datos que deba reemplazar la tuya.
7. Dentro del proyecto actualizado, ejecuta:

   ```bash
   npm ci
   ```

8. Inicia `python backend/server.py` y `npm run dev` en terminales separadas.
9. Abre la URL de Vite e ingresa con tu usuario y contraseña habituales.

Las mascotas, citas, consultas, documentos, cobros y contraseña se conservan. **No hace falta importar ni restaurar datos para pasar de 2.0 a 2.1.** Si Python pide crear otra contraseña, comprueba que estás ejecutando el proyecto que conserva la carpeta `backend/data` original.

Las copias JSON completas mantienen el formato `vetagenda-v2`. La asociación opcional de documentos con consultas no requiere una migración de SQLite. Volver a 2.0 después de usar esta función puede dejar asociaciones sin mantener al eliminar consultas, porque esa versión no contempla dicho vínculo.

### Desde una versión anterior que guardaba en el navegador

Esta importación es únicamente para las versiones que utilizaban `localStorage`.

1. Inicia la nueva versión e ingresa con `admin`.
2. Utiliza el mismo navegador y la misma dirección de la versión anterior, incluido el puerto.
3. Con la base de destino vacía, pulsa **Importar versión anterior**.
4. Revisa las mascotas y citas importadas antes de continuar.

Se migran las citas y las historias conservadas en el navegador; los originales no se eliminan. La importación agrupa las mascotas por nombre, especie, responsable y correo. Las citas sin duración reciben treinta minutos, por lo que conviene revisar posibles superposiciones.

## Almacenamiento y respaldos

### Base de datos local

Los registros y la configuración de acceso se guardan en:

```text
backend/data/vetagenda.sqlite3
```

Los cambios se envían automáticamente a Python. La interfaz indica si se están guardando o si hay cambios pendientes. Los archivos adjuntos se incluyen en los datos almacenados, no en una carpeta independiente de documentos.

### Tipos de respaldo

| Respaldo                               | Contenido y uso                                                                                                                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copia completa**                     | Descarga JSON con mascotas, citas, historias, prevención, peso, documentos y cobros. Se restaura desde la interfaz. No incluye la configuración de la cuenta administradora.     |
| **Copia automática de SQLite**         | Se guarda en `backend/data/backups` antes del primer guardado de cada día. Incluye los datos y la configuración de acceso de la base. Se conservan hasta treinta copias diarias. |
| **Exportar datos / Exportar historia** | Descargas parciales de citas o de la historia seleccionada. Sirven para consultar esos registros y no sustituyen una copia completa.                                             |

**Restaurar copia** reemplaza los datos actuales tras confirmar y validar el archivo. Descarga tu copia actual antes de restaurar otra.

Las copias automáticas permanecen en el mismo equipo. Conserva además una copia externa periódica y protege tanto la base como sus respaldos, ya que contienen datos de pacientes y responsables. La contraseña de acceso no cifra el archivo SQLite.

### Si un cambio no se guarda

Mantén abierta la aplicación, descarga una **Copia completa** con los cambios que siguen en memoria y utiliza **Reintentar guardado** cuando esté disponible. Si otra sesión guardó antes, exporta tu copia y recarga para recuperar el estado del servidor; esta versión no combina ediciones concurrentes automáticamente.

## Estructura del proyecto

| Ruta                                 | Responsabilidad                                                      |
| ------------------------------------ | -------------------------------------------------------------------- |
| `src/App.jsx`                        | Interfaz principal, formulario de citas, listado y navegación.       |
| `src/ClinicContext.jsx`              | Inicio de sesión, estado compartido, guardado y respaldo.            |
| `src/components/CalendarAgenda.jsx`  | Agenda diaria y semanal.                                             |
| `src/components/ClinicDashboard.jsx` | Resumen de actividad y saldos.                                       |
| `src/components/PatientCare.jsx`     | Ficha integral y sus apartados de cuidado y administración.          |
| `src/components/PatientSummary.jsx`  | Resumen y actividad clínica reciente por mascota.                    |
| `src/components/MedicalHistory.jsx`  | Consultas, documentos asociados e indicaciones imprimibles.          |
| `src/components/WeightChart.jsx`     | Gráfico temporal de mediciones de peso.                              |
| `src/lib/`                           | Reglas de negocio, validaciones, migración y utilidades compartidas. |
| `backend/server.py`                  | API, autenticación, SQLite y copias automáticas.                     |
| `backend/test_server.py`             | Pruebas del servidor y de validación de datos.                       |
| `tests/`                             | Pruebas de lógica de la interfaz.                                    |

`backend/data`, `node_modules` y los archivos compilados están excluidos del control de versiones. Conserva los datos reales y las credenciales fuera del repositorio.

## Pruebas y calidad

Ejecuta las comprobaciones desde la carpeta del proyecto:

| Comando                | Comprobación                                |
| ---------------------- | ------------------------------------------- |
| `npm test`             | Reglas de negocio de JavaScript.            |
| `npm run test:backend` | Pruebas de la API y validaciones de Python. |
| `npm run lint`         | Revisión estática con ESLint.               |
| `npm run format:check` | Formato con Prettier.                       |
| `npm run build`        | Compilación de producción de la interfaz.   |

Si tu sistema utiliza `python3` o `py`, puedes ejecutar las pruebas del servidor directamente con ese comando:

```bash
python3 -m unittest discover -s backend -v
```

En la entrega **2.1** se verificaron **21 pruebas de JavaScript y 5 de Python**, además del análisis estático, el formato y la compilación. Las pruebas cubren migración, referencias entre registros, intervalos de agenda, fechas, importes en centésimos, respaldos, acceso, sesiones y conflictos al guardar.

También se revisaron los flujos principales en Chromium y el diseño a **320, 390, 768 y 1440 píxeles**, con ambos temas. Se comprobó la persistencia al recargar y la conservación de adjuntos al eliminar una consulta. La agenda semanal dispone de desplazamiento horizontal en pantallas pequeñas.

La compilación genera la carpeta `dist`. El funcionamiento de la aplicación sigue necesitando la API de Python; el proyecto completo no se despliega únicamente como archivos estáticos.

## Solución de problemas

| Situación                              | Qué revisar                                                                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| No conecta con Python                  | Inicia `python backend/server.py` y verifica que siga activo. El proxy de Vite apunta al puerto 8000.                                    |
| `python` no se reconoce                | Prueba `py` en Windows o `python3` en Linux y WSL.                                                                                       |
| Tras actualizar aparece una base vacía | Comprueba que ejecutaste el proyecto que conserva `backend/data/vetagenda.sqlite3`.                                                      |
| Olvidaste la contraseña                | Detén Python y ejecuta `python backend/server.py --reset-password`. Cambia la contraseña y revoca las sesiones sin borrar los pacientes. |
| Hay cambios pendientes                 | Descarga una copia completa antes de cerrar. Revisa la conexión y utiliza la opción de reintentar.                                       |
| No se puede adjuntar un archivo        | Se admiten PDF, PNG y JPG de hasta 2 MB por archivo, con un máximo total de 20 MB de contenido codificado.                               |
| No permite guardar una cita            | Revisa los campos obligatorios, fecha, hora y duración. Las citas pendientes no pueden superponerse.                                     |

## Alcance y próximas mejoras

La versión actual está orientada al uso local en un consultorio, con **una cuenta administradora y una agenda compartida**. El servidor escucha en `127.0.0.1`.

Los recordatorios son internos y utilizan fechas indicadas por el profesional. Los cobros son registros administrativos internos. Para compartir el sistema entre equipos o publicarlo, se requiere preparar un despliegue con HTTPS, permisos y respaldos externos.

Posibles siguientes etapas:

- Agendas independientes por veterinario.
- Usuarios y permisos para recepción y profesionales.
- Envío de recordatorios por correo o WhatsApp.
- Reportes de actividad y administración por período.
- Registro de auditoría para cambios clínicos.

Estas funciones se presentan como evolución del proyecto y no forman parte de la versión 2.1.

## Autor

**Víctor España** · Desarrollador Full Stack

VetAgenda demuestra la integración de una interfaz React con servicios en Python, persistencia en SQLite, formularios validados, autenticación, seguimiento clínico, gestión administrativa y pruebas de reglas de negocio.
