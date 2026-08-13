import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  var frenchCardsPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  return new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 15_000,
    ssl: process.env.DATABASE_SSL === "require" ? { rejectUnauthorized: false } : undefined,
  });
}

export function getPool() {
  if (!globalThis.frenchCardsPool) globalThis.frenchCardsPool = createPool();
  return globalThis.frenchCardsPool;
}

export async function query<Row extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  return getPool().query<Row>(text, values);
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
