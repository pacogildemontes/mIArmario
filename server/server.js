import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const app = express();
const dataDir = path.resolve('data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const db = new Database(path.join(dataDir, 'benchmarks.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS results (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    payload TEXT NOT NULL
  );
`);

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.post('/api/results', (req, res) => {
  const payload = req.body;
  if (!payload?.id) {
    return res.status(400).json({ error: 'id requerido' });
  }
  const stmt = db.prepare('INSERT OR REPLACE INTO results(id, created_at, payload) VALUES (?, ?, ?)');
  stmt.run(payload.id, new Date().toISOString(), JSON.stringify(payload));
  res.json({ status: 'ok', id: payload.id });
});

app.get('/api/results/:id', (req, res) => {
  const stmt = db.prepare('SELECT payload FROM results WHERE id = ?');
  const row = stmt.get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'No encontrado' });
  }
  res.json(JSON.parse(row.payload));
});

app.listen(4173, () => {
  console.log('Servidor mIArmario escuchando en http://localhost:4173');
});
