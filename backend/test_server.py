import copy
import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
import server


class ServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        server.DATA_DIR = Path(cls.temp.name)
        server.DB = server.DATA_DIR / 'test.sqlite3'
        cls.password = 'Testing-only-4821!'
        server.initialize(cls.password)
        cls.http = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.port = cls.http.server_port
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.temp.cleanup()

    def request(self, method, path, payload=None, cookie=None, origin=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.port)
        headers = {'Content-Type': 'application/json'}
        if cookie:
            headers['Cookie'] = cookie
        if origin:
            headers['Origin'] = origin
        conn.request(method, path, body=json.dumps(payload) if payload is not None else None, headers=headers)
        response = conn.getresponse()
        result = response.status, json.loads(response.read()), response.getheader('Set-Cookie')
        conn.close()
        return result

    def login(self):
        status, _, cookie = self.request('POST', '/api/login', {'username': 'admin', 'password': self.password})
        self.assertEqual(status, 200)
        self.assertIn('HttpOnly', cookie)
        self.assertIn('SameSite=Strict', cookie)
        return cookie.split(';')[0]

    def test_access_and_logout(self):
        self.assertEqual(self.request('GET', '/api/state')[0], 401)
        cookie = self.login()
        self.assertEqual(self.request('GET', '/api/state', cookie=cookie)[0], 200)
        self.assertEqual(self.request('POST', '/api/logout', cookie=cookie)[0], 200)
        self.assertEqual(self.request('GET', '/api/state', cookie=cookie)[0], 401)

    def test_atomic_save_conflict_backup_and_rejection(self):
        cookie = self.login()
        _, initial, _ = self.request('GET', '/api/state', cookie=cookie)
        data = copy.deepcopy(server.EMPTY)
        data['pets'] = [{'id': 'pet', 'nombre': 'Luna', 'propietario': 'Ana', 'email': 'ana@example.com', 'especie': 'Gato'}]
        payload = {'version': initial['version'], 'data': data}
        self.assertEqual(self.request('PUT', '/api/state', payload, cookie)[0], 200)
        self.assertEqual(self.request('PUT', '/api/state', payload, cookie)[0], 409)
        self.assertTrue(list((server.DATA_DIR / 'backups').glob('*.sqlite3')))
        _, saved, _ = self.request('GET', '/api/state', cookie=cookie)
        self.assertEqual(saved['data']['pets'][0]['nombre'], 'Luna')
        bad = copy.deepcopy(saved)
        bad['data']['records'] = [{'id': 'bad', 'fecha': '2026-10-13', 'petId': 'missing'}]
        self.assertEqual(self.request('PUT', '/api/state', bad, cookie)[0], 400)
        self.assertEqual(self.request('PUT', '/api/state', saved, cookie, 'https://evil.example')[0], 403)
        _, final, _ = self.request('GET', '/api/state', cookie=cookie)
        self.assertEqual(final, saved)

    def test_invalid_document_and_payment(self):
        data = copy.deepcopy(server.EMPTY)
        data['pets'] = [{'id': 'pet', 'nombre': 'Luna', 'propietario': 'Ana', 'email': 'ana@example.com', 'especie': 'Gato'}]
        data['documents'] = [{'id': 'doc', 'petId': 'pet', 'mime': 'application/pdf', 'name': 'file.pdf', 'base64': 'aGVsbG8='}]
        with self.assertRaises(ValueError):
            server.validate_state(data)
        data['documents'] = []
        data['invoices'] = [{'id': 'pay', 'petId': 'pet', 'fecha': '2026-10-13', 'concepto': 'Consulta', 'moneda': 'UYU', 'total': 100, 'pagado': 101}]
        with self.assertRaises(ValueError):
            server.validate_state(data)

    def test_document_consultation_reference(self):
        import base64
        data = copy.deepcopy(server.EMPTY)
        data['pets'] = [{'id': pet, 'nombre': 'Luna', 'propietario': 'Ana', 'email': 'ana@example.com', 'especie': 'Gato'} for pet in ('pet', 'other')]
        data['entries'] = [{'id': 'entry', 'petId': 'pet', 'fecha': '2026-10-13', 'motivo': 'Control'}]
        content = b'%PDF-test'
        data['documents'] = [{'id': 'doc', 'petId': 'pet', 'mime': 'application/pdf', 'name': 'test.pdf', 'base64': base64.b64encode(content).decode(), 'size': len(content), 'createdAt': '2026-10-13T12:00:00Z'}]
        server.validate_state(data)  # Older documents need no new field.
        data['documents'][0]['entryId'] = 'entry'
        server.validate_state(data)
        data['documents'][0]['petId'] = 'other'
        with self.assertRaises(ValueError):
            server.validate_state(data)
        data['documents'][0]['petId'] = 'pet'
        data['documents'][0]['entryId'] = 'missing'
        with self.assertRaises(ValueError):
            server.validate_state(data)

    def test_password_not_stored_in_plaintext(self):
        with server.connect() as conn:
            account = conn.execute('SELECT salt,hash FROM account').fetchone()
        self.assertNotEqual(account['hash'], self.password)
        self.assertEqual(len(account['hash']), 64)


if __name__ == '__main__':
    unittest.main()
