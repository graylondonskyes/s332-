(function () {
  const config = {
    baseUrl: localStorage.getItem('skyewebcreatormax.skygate.baseUrl') || '',
    mirrorSecret: localStorage.getItem('skyewebcreatormax.skygate.mirrorSecret') || '',
    accessToken: localStorage.getItem('skyewebcreatormax.skygate.accessToken') || '',
  };

  async function postJson(path, body, headers) {
    if (!config.baseUrl) {
      return { ok: false, mode: 'standalone', error: 'SKYGATEFS13_BASE_URL not configured in this browser session.' };
    }
    try {
      const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, data };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  window.SkyeGateFS13Client = {
    configure(next) {
      Object.assign(config, next || {});
      if (next?.baseUrl) localStorage.setItem('skyewebcreatormax.skygate.baseUrl', next.baseUrl);
      if (next?.mirrorSecret) localStorage.setItem('skyewebcreatormax.skygate.mirrorSecret', next.mirrorSecret);
      if (next?.accessToken) localStorage.setItem('skyewebcreatormax.skygate.accessToken', next.accessToken);
      return { ok: true, configured: Boolean(config.baseUrl) };
    },
    mirrorEvent(event) {
      return postJson('/.netlify/functions/platform-event-ingest', {
        source_app: 'skyewebcreator-max',
        actor: event.actor || 'skyewebcreator-user',
        org_id: event.org_id || null,
        ws_id: event.ws_id || null,
        type: event.type || 'webcreator.event',
        meta: event.meta || {},
        event_ts: new Date().toISOString(),
      }, {
        'x-skygate-event-mirror-secret': config.mirrorSecret,
      });
    },
    askAI(payload) {
      return postJson('/.netlify/functions/gateway-chat', payload, config.accessToken ? {
        authorization: `Bearer ${config.accessToken}`,
      } : {});
    },
    state() {
      return {
        configured: Boolean(config.baseUrl),
        hasMirrorSecret: Boolean(config.mirrorSecret),
        hasAccessToken: Boolean(config.accessToken),
      };
    },
  };
})();
