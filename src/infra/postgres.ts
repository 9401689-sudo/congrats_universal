import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow
} from "pg";

export type PostgresExecutor = {
  query<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
};

export function createPgPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}

export async function withPgClient<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
