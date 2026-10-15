"""VetAgenda: API local, SQLite y sesiones. Solo biblioteca estándar de Python."""
import argparse
import base64
import datetime as dt
import getpass
import hashlib
import hmac
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import secrets
import sqlite3
import time
from urllib.parse import urlparse

DATA_DIR = Path(os.environ.get('VETAGENDA_DATA_DIR', Path(__file__).parent / 'data'))
DB = DATA_DIR / 'vetagenda.sqlite3'
MAX_BODY = 24 * 1024 * 1024
COLLECTIONS = ('records', 'entries', 'pets', 'preventive', 'weights', 'documents', 'invoices')
EMPTY = {key: [] for key in COLLECTIONS}


def connect():
    connection = sqlite3.connect(DB, timeout=15)
    connection.row_factory = sqlite3.Row
    return connection


def password_hash(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 600_000).hex()


def initialize(password=None, reset=False):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript('''CREATE TABLE IF NOT EXISTS account (id INTEGER PRIMARY KEY CHECK(id=1), salt TEXT NOT NULL, hash TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS attempts (client TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL);''')
        conn.execute('INSERT OR IGNORE INTO state VALUES (1,0,?)', (json.dumps(EMPTY),))
        if not conn.execute('SELECT 1 FROM account').fetchone() or reset:
            password = password or os.environ.get('VETAGENDA_ADMIN_PASSWORD')
            if not password:
                print('Crea la contraseña del usuario admin (mínimo 12 caracteres).')
                password = getpass.getpass('Contraseña: ')
                if password != getpass.getpass('Repite la contraseña: '):
                    raise ValueError('Las contraseñas no coinciden.')
            if len(password) < 12:
                raise ValueError('La contraseña debe tener al menos 12 caracteres.')
            salt = secrets.token_hex(32)
            conn.execute('INSERT OR REPLACE INTO account VALUES (1,?,?)', (salt, password_hash(password, salt)))
            conn.execute('DELETE FROM sessions')


def valid_date(value):
    try:
        return isinstance(value, str) and dt.date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False


def validate_state(data):
    if not isinstance(data, dict) or set(data) != set(COLLECTIONS):
        raise ValueError('Formato de copia no válido.')
    for name, rows in data.items():
        if not isinstance(rows, list) or len(rows) > 10000:
            raise ValueError('Colección no válida o demasiado grande.')
        ids = set()
        for row in rows:
            if not isinstance(row, dict) or not isinstance(row.get('id'), str) or not row['id'] or row['id'] in ids:
                raise ValueError('Identificadores no válidos o duplicados.')
            ids.add(row['id'])
            if name in ('records', 'entries', 'preventive', 'weights', 'invoices') and not valid_date(row.get('fecha')):
                raise ValueError('Fecha no válida.')
    strings = {
        'pets': ('nombre','propietario','email','especie','raza','sexo','nacimiento','microchip','telefono','alergias','cronicas','medicacion','notas'),
        'records': ('nombre','propietario','email','especie','telefono','sintomas','hora','estado'),
        'entries': ('motivo','diagnostico','tratamiento','notas','createdAt','updatedAt'),
        'preventive': ('tipo','producto','proxima','lote','notas'),
        'documents': ('name','mime','base64','createdAt'),
        'invoices': ('concepto','moneda'),
    }
    for name, fields in strings.items():
        for row in data[name]:
            if any(not isinstance(row.get(key, ''), str) for key in fields):
                raise ValueError('Texto de registro no válido.')
    pet_ids = {row['id'] for row in data['pets']}
    for row in data['pets']:
        for key in ('nombre', 'propietario', 'email', 'especie'):
            if not isinstance(row.get(key), str) or not row[key].strip():
                raise ValueError('Ficha de mascota incompleta.')
        if row.get('nacimiento') and not valid_date(row['nacimiento']):
            raise ValueError('Nacimiento no válido.')
        if row.get('nacimiento') and row['nacimiento'] > dt.date.today().isoformat():
            raise ValueError('El nacimiento no puede estar en el futuro.')
    for name in ('records', 'entries', 'preventive', 'weights', 'documents', 'invoices'):
        for row in data[name]:
            if row.get('petId') not in pet_ids:
                raise ValueError('El registro no está asociado a una mascota.')
    for row in data['records']:
        try:
            hour, minute = map(int, row['hora'].split(':'))
            duration = int(row.get('duracion', 30))
            assert 0 <= hour <= 23 and 0 <= minute <= 59 and duration in (15, 30, 45, 60, 90, 120)
            assert hour * 60 + minute + duration <= 1440
            assert row['estado'] in ('pendiente', 'atendida', 'cancelada')
        except (ValueError, KeyError, AttributeError, AssertionError, TypeError):
            raise ValueError('Hora, duración o estado de cita no válidos.') from None
    for name in ('entries','preventive','weights','invoices'):
        if any(row['fecha'] > dt.date.today().isoformat() for row in data[name]):
            raise ValueError('Los registros de atención no pueden estar en el futuro.')
    for row in data['entries']:
        if not isinstance(row.get('motivo'), str) or not row['motivo'].strip():
            raise ValueError('La consulta médica necesita un motivo.')
        if any(not isinstance(row.get(key, ''), str) for key in ('diagnostico', 'tratamiento', 'notas')):
            raise ValueError('Texto clínico no válido.')
    for row in data['preventive']:
        if row.get('tipo') not in ('Vacuna', 'Desparasitación') or not isinstance(row.get('producto'), str) or not row['producto'].strip():
            raise ValueError('Control preventivo no válido.')
        if row.get('proxima') and (not valid_date(row['proxima']) or row['proxima'] < row['fecha']):
            raise ValueError('Próximo control no válido.')
    for row in data['weights']:
        if not isinstance(row.get('kg'), (int, float)) or isinstance(row['kg'], bool) or not 0 < row['kg'] <= 1000:
            raise ValueError('Peso no válido.')
    for row in data['invoices']:
        if row.get('moneda') not in ('UYU', 'USD') or not isinstance(row.get('concepto'), str) or not row['concepto'].strip():
            raise ValueError('Cobro no válido.')
        for key in ('total', 'pagado'):
            if not isinstance(row.get(key), int) or isinstance(row[key], bool) or not 0 <= row[key] <= 100000000:
                raise ValueError('Importe no válido.')
        if row['pagado'] > row['total']:
            raise ValueError('El pago supera el total.')
    entry_pets = {row['id']: row['petId'] for row in data['entries']}
    for row in data['documents']:
        entry_id = row.get('entryId', '')
        if not isinstance(entry_id, str) or (entry_id and entry_pets.get(entry_id) != row['petId']):
            raise ValueError('El documento debe corresponder a una consulta de la misma mascota.')
        if row.get('mime') not in ('application/pdf', 'image/png', 'image/jpeg') or not isinstance(row.get('name'), str):
            raise ValueError('Archivo no permitido.')
        try:
            content = base64.b64decode(row['base64'], validate=True)
        except (KeyError, ValueError, TypeError):
            raise ValueError('Archivo no válido.') from None
        if not isinstance(row.get('size'), int) or row['size'] != len(content) or not isinstance(row.get('createdAt'), str) or not valid_date(row['createdAt'][:10]):
            raise ValueError('Metadatos de documento no válidos.')
        signatures = {'application/pdf': b'%PDF-', 'image/png': b'\x89PNG\r\n\x1a\n', 'image/jpeg': b'\xff\xd8\xff'}
        if not 0 < len(content) <= 2 * 1024 * 1024 or not content.startswith(signatures[row['mime']]):
            raise ValueError('El contenido del archivo no corresponde al formato permitido (máximo 2 MB).')


def daily_backup():
    folder = DATA_DIR / 'backups'
    folder.mkdir(exist_ok=True)
    target = folder / f'{dt.date.today().isoformat()}.sqlite3'
    if not target.exists():
        with connect() as source, sqlite3.connect(target) as destination:
            source.backup(destination)
    for old in sorted(folder.glob('*.sqlite3'))[:-30]:
        old.unlink()


class Handler(BaseHTTPRequestHandler):
    server_version = 'VetAgenda/2.0'

    def log_message(self, format, *args):
        pass  # No registrar rutas, credenciales ni datos clínicos.

    def reply(self, status, data, headers=None):
        payload = json.dumps(data, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(payload)

    def body(self):
        try:
            size = int(self.headers.get('Content-Length', 0))
        except ValueError:
            raise ValueError('Tamaño no válido.') from None
        if not 0 < size <= MAX_BODY:
            raise ValueError('La petición debe tener entre 1 byte y 24 MB.')
        if self.headers.get_content_type() != 'application/json':
            raise ValueError('Se requiere JSON.')
        return json.loads(self.rfile.read(size), parse_constant=lambda value: (_ for _ in ()).throw(ValueError('Número no válido')))

    def authenticated(self):
        jar = cookies.SimpleCookie()
        try:
            jar.load(self.headers.get('Cookie', ''))
            token = jar['vetagenda_session'].value
        except (KeyError, cookies.CookieError):
            return None
        digest = hashlib.sha256(token.encode()).hexdigest()
        with connect() as conn:
            row = conn.execute('SELECT expires FROM sessions WHERE token=?', (digest,)).fetchone()
        return digest if row and row['expires'] > time.time() else None

    def same_origin(self):
        origin = self.headers.get('Origin')
        if not origin:
            return True
        return urlparse(origin).netloc == self.headers.get('Host')

    def do_GET(self):
        if not self.authenticated():
            return self.reply(401, {'error': 'Inicia sesión para continuar.'})
        if self.path == '/api/state':
            with connect() as conn:
                row = conn.execute('SELECT version,data FROM state WHERE id=1').fetchone()
            return self.reply(200, {'version': row['version'], 'data': json.loads(row['data'])})
        return self.reply(404, {'error': 'Ruta no encontrada.'})

    def do_POST(self):
        if not self.same_origin():
            return self.reply(403, {'error': 'Origen no permitido.'})
        if self.path == '/api/logout':
            token = self.authenticated()
            if token:
                with connect() as conn:
                    conn.execute('DELETE FROM sessions WHERE token=?', (token,))
            return self.reply(200, {'ok': True}, {'Set-Cookie': 'vetagenda_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0'})
        if self.path != '/api/login':
            return self.reply(404, {'error': 'Ruta no encontrada.'})
        try:
            body = self.body()
            if not isinstance(body, dict):
                raise ValueError('Credenciales no válidas.')
        except (ValueError, UnicodeDecodeError):
            return self.reply(400, {'error': 'Solicitud no válida.'})
        client = self.client_address[0]
        now = int(time.time())
        with connect() as conn:
            attempt = conn.execute('SELECT count,until FROM attempts WHERE client=?', (client,)).fetchone()
            if attempt and attempt['until'] > now and attempt['count'] >= 5:
                return self.reply(429, {'error': 'Demasiados intentos. Espera 15 minutos.'})
            account = conn.execute('SELECT salt,hash FROM account WHERE id=1').fetchone()
            password = body.get('password', '')
            if not isinstance(password, str) or len(password) > 256:
                return self.reply(400, {'error': 'Credenciales no válidas.'})
            valid_password = hmac.compare_digest(account['hash'], password_hash(password, account['salt']))
            if body.get('username') != 'admin' or not valid_password:
                count = attempt['count'] + 1 if attempt and attempt['until'] > now else 1
                conn.execute('INSERT OR REPLACE INTO attempts VALUES (?,?,?)', (client, count, now + 900))
                return self.reply(401, {'error': 'Usuario o contraseña incorrectos.'})
            conn.execute('DELETE FROM attempts WHERE client=?', (client,))
            conn.execute('DELETE FROM sessions WHERE expires < ?', (now,))
            token = secrets.token_urlsafe(32)
            conn.execute('INSERT INTO sessions VALUES (?,?)', (hashlib.sha256(token.encode()).hexdigest(), now + 28800))
        return self.reply(200, {'ok': True}, {'Set-Cookie': f'vetagenda_session={token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800'})

    def do_PUT(self):
        if not self.same_origin():
            return self.reply(403, {'error': 'Origen no permitido.'})
        if not self.authenticated():
            return self.reply(401, {'error': 'La sesión expiró. Exporta tus cambios y vuelve a ingresar.'})
        if self.path != '/api/state':
            return self.reply(404, {'error': 'Ruta no encontrada.'})
        try:
            body = self.body()
            if not isinstance(body, dict) or not isinstance(body.get('version'), int) or isinstance(body['version'], bool):
                raise ValueError('Versión no válida.')
            validate_state(body.get('data'))
            payload = json.dumps(body['data'], ensure_ascii=False, allow_nan=False)
            daily_backup()
            with connect() as conn:
                cursor = conn.execute('UPDATE state SET data=?, version=version+1 WHERE id=1 AND version=?', (payload, body['version']))
                if not cursor.rowcount:
                    return self.reply(409, {'error': 'Otra sesión guardó cambios. Exporta tu copia y recarga antes de continuar; no sobrescribimos sus datos.'})
            return self.reply(200, {'version': body['version'] + 1})
        except (ValueError, TypeError, UnicodeDecodeError) as error:
            return self.reply(400, {'error': str(error)})
        except (sqlite3.Error, OSError):
            return self.reply(500, {'error': 'No se pudo guardar. Exporta una copia y comprueba el espacio disponible.'})


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Servidor local VetAgenda')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--reset-password', action='store_true')
    args = parser.parse_args()
    try:
        initialize(reset=args.reset_password)
    except ValueError as error:
        raise SystemExit(str(error)) from None
    print(f'VetAgenda API lista en http://127.0.0.1:{args.port}. Usuario: admin. Mantén esta terminal abierta.')
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
