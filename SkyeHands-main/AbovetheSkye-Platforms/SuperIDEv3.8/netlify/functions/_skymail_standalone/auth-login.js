const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("./_db");
const { json, parseJson, requireEnv } = require("./_utils");

exports.handler = async (event) => {
  try{
    const body = parseJson(event);
    const ident = (body.ident || "").trim().toLowerCase();
    const password = body.password || "";

    if(!ident) return json(400, { error: "Email or handle required." });
    if(!password) return json(400, { error: "Password required." });

    const res = await query(
      `select id, handle, email, password_hash from users
       where lower(email)=$1 or lower(handle)=$1
       limit 1`,
      [ident]
    );

    if(!res.rows.length) return json(401, { error: "Invalid credentials." });
    const u = res.rows[0];
    const ok = await bcrypt.compare(password, u.password_hash);
    if(!ok) return json(401, { error: "Invalid credentials." });

    const secret = requireEnv("JWT_SECRET");
    const token = jwt.sign({ sub: u.id, handle: u.handle, email: u.email }, secret, { expiresIn: "14d" });

    return json(200, { token, handle: u.handle, email: u.email });

  }catch(err){
    return json(500, { error: err.message || "Server error" });
  }
};
