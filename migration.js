#!/usr/bin/env node
import { createReadStream, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const COLUMNS = [
  'ID_Paciente',
  'Nombre_Completo',
  'Genero',
  'Fecha_Nacimiento',
  'Tipo_Sangre',
  'Fecha_Ingreso',
  'Diagnostico_Principal',
  'Tratamiento_Asignado',
  'Medico_Tratante',
  'Estado_Paciente',
  'Telefono_Emergencia',
  'Costo_Atencion_USD',
  'Edad',
];

export const cfg = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: String(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'lab',
  table: process.env.DB_TABLE || 'historiales_clinicos',
  csvPath:
    process.env.CSV_PATH ||
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'BD_Historiales_Clinicos_2000.csv'),
  batchSize: Math.max(1, parseInt(process.env.BATCH_SIZE, 10) || 500),
  dropTable: ['1', 'true', 'yes'].includes(String(process.env.DROP_TABLE || '').toLowerCase()),
};

export function parseIsoDate(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function escapeId(id) {
  return '`' + String(id).replace(/`/g, '``') + '`';
}

export function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL';
  return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
}

export function parseCsv(stream, onRecord) {
  return new Promise((resolve, reject) => {
    let field = '';
    let record = [];
    let inQuotes = false;
    let records = 0;
    let done = false;

    const fail = (err) => {
      if (done) return;
      done = true;
      reject(err);
      stream.destroy();
    };

    const finalizeField = () => {
      record.push(field);
      field = '';
    };

    const finalizeRecord = () => {
      finalizeField();
      records++;
      try {
        onRecord(record);
      } catch (err) {
        fail(err);
        return;
      }
      record = [];
    };

    stream.on('error', fail);
    stream.on('data', (chunk) => {
      if (done) return;
      const text = chunk.toString('utf8');
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
          if (c === '"') {
            if (text[i + 1] === '"') {
              field += '"';
              i++;
            } else {
              inQuotes = false;
            }
          } else {
            field += c;
          }
        } else if (c === '"') {
          inQuotes = true;
        } else if (c === ',') {
          finalizeField();
        } else if (c === '\r') {
          if (text[i + 1] === '\n') i++;
          finalizeRecord();
        } else if (c === '\n') {
          finalizeRecord();
        } else {
          field += c;
        }
      }
    });
    stream.on('end', () => {
      if (done) return;
      if (field.length || record.length) finalizeRecord();
      done = true;
      resolve(records);
    });
  });
}

export function valueSql(row, col) {
  switch (col) {
    case 'ID_Paciente':
    case 'Edad': {
      const n = parseInt(row[col], 10);
      return Number.isInteger(n) ? String(n) : 'NULL';
    }
    case 'Costo_Atencion_USD': {
      const v = parseFloat(row[col]);
      return Number.isFinite(v) ? v.toFixed(2) : 'NULL';
    }
    case 'Fecha_Ingreso': {
      const d = parseIsoDate(row[col]);
      return d ? sqlStr(d) : 'NULL';
    }
    case 'Fecha_Nacimiento':
      return sqlStr(String(row[col]).trim());
    default:
      return sqlStr(row[col]);
  }
}

export function buildInsertSql(batch) {
  const cols = COLUMNS.map(escapeId).join(', ');
  const rowsSql = batch.map(
    (row) => '(' + COLUMNS.map((c) => valueSql(row, c)).join(', ') + ')'
  );
  return `INSERT INTO ${escapeId(cfg.table)} (${cols}) VALUES\n${rowsSql.join(',\n')};`;
}

export function setupSql() {
  const db = escapeId(cfg.database);
  const tb = escapeId(cfg.table);
  const ddl = [
    `CREATE TABLE IF NOT EXISTS ${tb} (`,
    `  ${escapeId('ID_Paciente')} INT NOT NULL,`,
    `  ${escapeId('Nombre_Completo')} VARCHAR(255) NOT NULL,`,
    `  ${escapeId('Genero')} VARCHAR(20) NOT NULL,`,
    `  ${escapeId('Fecha_Nacimiento')} VARCHAR(20) NULL,`,
    `  ${escapeId('Tipo_Sangre')} VARCHAR(6) NOT NULL,`,
    `  ${escapeId('Fecha_Ingreso')} DATE NULL,`,
    `  ${escapeId('Diagnostico_Principal')} VARCHAR(100) NOT NULL,`,
    `  ${escapeId('Tratamiento_Asignado')} VARCHAR(80) NOT NULL,`,
    `  ${escapeId('Medico_Tratante')} VARCHAR(255) NOT NULL,`,
    `  ${escapeId('Estado_Paciente')} VARCHAR(40) NOT NULL,`,
    `  ${escapeId('Telefono_Emergencia')} VARCHAR(40) NOT NULL,`,
    `  ${escapeId('Costo_Atencion_USD')} DECIMAL(12,2) NOT NULL,`,
    `  ${escapeId('Edad')} INT NOT NULL,`,
    `  PRIMARY KEY (${escapeId('ID_Paciente')})`,
    `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ].join('\n');
  const lines = [
    `CREATE DATABASE IF NOT EXISTS ${db} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
    `USE ${db};`,
  ];
  if (cfg.dropTable) lines.push(`DROP TABLE IF EXISTS ${tb};`);
  lines.push(ddl, ';');
  return lines.join('\n');
}

function spawnMysql(extraArgs) {
  const args = [
    `--host=${cfg.host}`,
    `--port=${cfg.port}`,
    `--user=${cfg.user}`,
    '--default-character-set=utf8mb4',
  ].concat(extraArgs);
  return spawn('mysql', args, {
    env: Object.assign({}, process.env, { MYSQL_PWD: cfg.password }),
  });
}

function runSqlOnce(sql) {
  return new Promise((resolve, reject) => {
    const child = spawnMysql([]);
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`mysql exited with code ${code}: ${stderr.trim()}`));
    });
    child.stdin.on('error', () => { });
    child.stdin.end(sql);
  });
}

async function insertRows(rows) {
  const child = spawnMysql([cfg.database]);
  let stderr = '';
  child.stderr.on('data', (d) => {
    stderr += d;
  });
  const closed = new Promise((resolve, reject) => {
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`mysql exited with code ${code}: ${stderr.trim()}`));
    });
  });

  const total = rows.length;
  try {
    for (let i = 0; i < total; i += cfg.batchSize) {
      const batch = rows.slice(i, i + cfg.batchSize);
      await new Promise((resolve, reject) => {
        child.stdin.write(buildInsertSql(batch) + '\n', (err) =>
          err ? reject(err) : resolve()
        );
      });
      console.log(`  inserted ${Math.min(i + cfg.batchSize, total)}/${total} rows`);
    }
  } catch (err) {
    child.kill();
    throw err;
  }
  child.stdin.end();
  await closed;
}

async function main() {
  if (!existsSync(cfg.csvPath)) {
    console.error(`CSV file not found: ${cfg.csvPath}`);
    console.error('Set CSV_PATH to point at the CSV file.');
    process.exitCode = 1;
    return;
  }

  let header = null;
  const rows = [];
  const stats = { read: 0, duplicates: 0, invalidBirthDates: 0, missingIngreso: 0 };
  const started = Date.now();

  try {
    await parseCsv(createReadStream(cfg.csvPath), (record) => {
      if (!header) {
        header = record.slice().map((f) => f.replace(/^\uFEFF/, '').trim());
        return;
      }
      if (record.length !== COLUMNS.length) {
        throw new Error(
          `Row ${stats.read + 2} has ${record.length} fields, expected ${COLUMNS.length}`
        );
      }
      stats.read++;
      const obj = {};
      header.forEach((name, i) => {
        obj[name] = record[i];
      });
      if (!parseIsoDate(obj.Fecha_Nacimiento)) stats.invalidBirthDates++;
      if (!parseIsoDate(obj.Fecha_Ingreso)) stats.missingIngreso++;
      rows.push(obj);
    });
  } catch (err) {
    console.error(`CSV parse failed: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  if (stats.read === 0) {
    console.error('CSV contains no data rows.');
    process.exitCode = 1;
    return;
  }

  const missingCols = COLUMNS.filter((c) => !header.includes(c));
  if (missingCols.length) {
    console.error(`Missing columns in CSV header: ${missingCols.join(', ')}`);
    console.error(`Header found: ${header.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const seen = new Set();
  const uniqueRows = [];
  for (const row of rows) {
    const id = String(row.ID_Paciente).trim();
    if (seen.has(id)) {
      stats.duplicates++;
      continue;
    }
    seen.add(id);
    uniqueRows.push(row);
  }

  console.log(`Loaded ${stats.read} rows from ${cfg.csvPath}`);
  if (stats.invalidBirthDates > 0)
    console.log(
      `Note: ${stats.invalidBirthDates} birth dates are not valid ISO dates (e.g. negative or short years) and are stored as-is in the VARCHAR column`
    );
  if (stats.missingIngreso > 0)
    console.log(`Note: ${stats.missingIngreso} ingreso dates are not valid ISO dates and stored as NULL`);
  if (stats.duplicates > 0)
    console.log(`Skipped ${stats.duplicates} duplicate ID_Paciente rows`);
  console.log(
    `Connecting to MariaDB ${cfg.user}@${cfg.host}:${cfg.port}, database "${cfg.database}", table "${cfg.table}"`
  );

  try {
    await runSqlOnce(setupSql());
    console.log('Schema ready (database and table ensured)');
    await insertRows(uniqueRows);
  } catch (err) {
    console.error(`Migration failed: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Migrated ${uniqueRows.length} patients into ${cfg.database}.${cfg.table} in ${((Date.now() - started) / 1000).toFixed(1)}s`
  );
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  main();
}
