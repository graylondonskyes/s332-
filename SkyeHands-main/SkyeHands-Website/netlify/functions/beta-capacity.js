exports.handler = async function handler() {
  const total = Number.parseInt(process.env.SKYEHANDS_BETA_CAPACITY || '50', 10);
  const reserved = Number.parseInt(process.env.SKYEHANDS_BETA_RESERVED || '7', 10);
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 50;
  const safeReserved = Number.isFinite(reserved) && reserved >= 0 ? reserved : 7;
  const spotsRemaining = Math.max(0, safeTotal - safeReserved);

  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=60'
    },
    body: JSON.stringify({
      ok: true,
      program: 'SkyeHands Private Beta',
      capacity: safeTotal,
      reserved: safeReserved,
      spotsRemaining
    })
  };
};
