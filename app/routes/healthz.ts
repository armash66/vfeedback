import { getPool } from "../db/client.server.js";

export async function loader() {
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 503,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
