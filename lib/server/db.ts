import { env } from 'cloudflare:workers';

export interface AppEnv {
  DB?: D1Database;
  DEMO_MODE?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
}
export function bindings(): AppEnv { return env as unknown as AppEnv; }
export function database(): D1Database {
  const db = bindings().DB;
  if (!db) throw new Error('Database binding DB is unavailable. Apply migrations and enable D1.');
  return db;
}
export async function one<T = Record<string, unknown>>(sql: string, ...args: unknown[]): Promise<T | null> {
  return database().prepare(sql).bind(...args).first<T>();
}
export async function all<T = Record<string, unknown>>(sql: string, ...args: unknown[]): Promise<T[]> {
  return (await database().prepare(sql).bind(...args).all<T>()).results;
}
export async function run(sql: string, ...args: unknown[]) { return database().prepare(sql).bind(...args).run(); }
export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}
export function timestamp(): string { return new Date().toISOString(); }
export function newId(prefix: string): string { return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`; }
