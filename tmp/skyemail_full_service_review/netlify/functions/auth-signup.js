const bcrypt = require("bcryptjs");
const { query } = require("./_db");
const { json, parseJson } = require("./_utils");

function validHandle(h){
  return /^[a-z0-9][a-z0-9-]{2,31}$/i.test(h || "");
}

exports.handler = async (event) => {
  try{
    const body = parseJson(event);
    const {
      handle, email, password,
      rsa_public_key_pem,
      vault_wrap_json,
      recovery_enabled,
      recovery_blob_json
    } = body;

    if(!validHandle(handle)) return json(400, { error: "Invalid handle format." });
    if(!email || !email.includes("@")) return json(400, { error: "Valid email required." });
    if(!password || password.length < 10) return json(400, { error: "Password must be at least 10 characters." });
    if(!rsa_public_key_pem || !rsa_public_key_pem.includes("BEGIN PUBLIC KEY")) return json(400, { error: "rsa_public_key_pem required (PEM)." });
    if(!vault_wrap_json) return json(400, { error: "vault_wrap_json required." });

    const password_hash = await bcrypt.hash(password, 12);
    const recoveryEnabled = !!recovery_enabled;
    const recoveryBlob = recoveryEnabled ? (recovery_blob_json || null) : null;

    const ures = await query(
      `insert into users(handle, email, password_hash, recovery_enabled, recovery_blob_json)
       values($1,$2,$3,$4,$5)
       returning id`,
      [handle, email.toLowerCase(), password_hash, recoveryEnabled, recoveryBlob]
    );
    const userId = ures.rows[0].id;

    await query(
      `insert into user_keys(user_id, version, is_active, rsa_public_key_pem, vault_wrap_json)
       values($1, 1, true, $2, $3)`,
      [userId, rsa_public_key_pem, vault_wrap_json]
    );

    return json(200, { ok: true });

  }catch(err){
    const msg = (err && err.message) ? err.message : "Server error";
    if(/duplicate key value violates unique constraint/i.test(msg)){
      return json(409, { error: "Handle or email already exists." });
    }
    return json(500, { error: msg });
  }
};
