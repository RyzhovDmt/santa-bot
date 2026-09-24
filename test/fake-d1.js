import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

// Minimal D1 binding over node:sqlite: prepare/bind/first/all/run and batch in a transaction.
class Statement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    return new Statement(this.db, this.sql, params);
  }

  async first() {
    return this.db.prepare(this.sql).get(...this.params) ?? null;
  }

  async all() {
    return { results: this.db.prepare(this.sql).all(...this.params) };
  }

  async run() {
    this.db.prepare(this.sql).run(...this.params);
    return { success: true, results: [] };
  }

  runSync() {
    const stmt = this.db.prepare(this.sql);
    return stmt.columns().length ? { results: stmt.all(...this.params) } : (stmt.run(...this.params), { results: [] });
  }
}

export class FakeD1 {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    this.calls = 0;
    const dir = new URL('../migrations/', import.meta.url);
    for (const file of readdirSync(dir).sort()) this.db.exec(readFileSync(new URL(file, dir), 'utf8'));
  }

  prepare(sql) {
    const fake = this;
    const stmt = new Statement(this.db, sql);
    // Count calls the way Workers count subrequests: one per first/all/run/batch.
    const wrap = (s) => new Proxy(s, {
      get(target, prop) {
        if (prop === 'bind') return (...params) => wrap(target.bind(...params));
        if (['first', 'all', 'run'].includes(prop)) {
          return (...args) => {
            fake.calls++;
            return target[prop](...args);
          };
        }
        return target[prop];
      },
    });
    return wrap(stmt);
  }

  async batch(statements) {
    this.calls++;
    this.db.exec('BEGIN');
    try {
      const results = statements.map((s) => s.runSync());
      this.db.exec('COMMIT');
      return results;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }
}
