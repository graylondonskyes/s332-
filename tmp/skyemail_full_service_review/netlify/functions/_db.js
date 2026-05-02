const { Pool } = require("pg");

let pool;

function getPool(){
  if(pool) return pool;
  const cs = process.env.DATABASE_URL;
  if(!cs) throw new Error("DATABASE_URL env var missing.");
  pool = new Pool({
    connectionString: cs,
    ssl: { rejectUnauthorized: false }
  });
  return pool;
}

async function query(text, params){
  const p = getPool();
  const res = await p.query(text, params);
  return res;
}

module.exports = { query };
