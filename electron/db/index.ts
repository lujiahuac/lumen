import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import schema from './schema.sql?raw'

type DbInstance = ReturnType<typeof Database>

let db: DbInstance | null = null

export function getDb(): DbInstance {
  if (db) return db

  const dbPath = path.join(app.getPath('userData'), 'lumen.db')
  db = new Database(dbPath)

  // Enable WAL mode for better concurrent performance
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Run schema
  db.exec(schema)

  return db
}

export function initDb(): DbInstance {
  return getDb()
}

export function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}
