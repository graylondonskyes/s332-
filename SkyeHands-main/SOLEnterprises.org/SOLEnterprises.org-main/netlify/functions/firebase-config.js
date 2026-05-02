const STATIC_CONFIG = {
  authDomain: "solenterprises-58215.firebaseapp.com",
  projectId: "solenterprises-58215",
  storageBucket: "solenterprises-58215.firebasestorage.app",
  messagingSenderId: "287667620838",
  appId: "1:287667620838:web:dd53eaf1712cb0175e2427",
  measurementId: "G-JLW0GMK1CJ"
};

function buildConfig(apiKey) {
  return Object.assign({ apiKey }, STATIC_CONFIG);
}

exports.handler = async function (event) {
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({ error: "FIREBASE_API_KEY not set" })
    };
  }

  const config = buildConfig(apiKey);
  const format = event && event.queryStringParameters && event.queryStringParameters.format;

  if (format === "js") {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store"
      },
      body: [
        "window.SOLE_FIREBASE_CONFIG = " + JSON.stringify(config) + ";",
        "window.FIREBASE_API_KEY = " + JSON.stringify(apiKey) + ";"
      ].join("\n")
    };
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(config)
  };
};
