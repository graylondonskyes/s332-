(function () {
  const QUEUE_KEY = 'skyehands.integration.queue.v1';
  const channelName = 'skyehands-integration-bridge';
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(channelName) : null;

  function loadQueue() {
    try {
      const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveQueue(queue) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  function nextEvent(type, detail) {
    return {
      eventId: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
      type,
      detail: detail || {},
      source: {
        title: document.title,
        href: location.href,
        path: location.pathname,
      },
      createdAt: new Date().toISOString(),
    };
  }

  function publish(event) {
    const queue = loadQueue();
    queue.unshift(event);
    saveQueue(queue.slice(0, 250));
    try {
      window.dispatchEvent(new CustomEvent('skyehands:bridge-event', { detail: event }));
    } catch (_) {}
    try {
      channel?.postMessage(event);
    } catch (_) {}
    return event;
  }

  const bridge = {
    emit(type, detail) {
      return publish(nextEvent(type, detail));
    },
    enqueueWebsiteRequest(detail) {
      return publish(nextEvent('webcreator.proposal.requested', detail));
    },
    enqueueAppointmentLead(detail) {
      return publish(nextEvent('appointmentsetter.lead.requested', detail));
    },
    listQueue() {
      return loadQueue();
    },
    clearQueue() {
      saveQueue([]);
      try {
        window.dispatchEvent(new CustomEvent('skyehands:bridge-cleared'));
      } catch (_) {}
      return { ok: true };
    },
  };

  window.SkyeIntegrationBridge = bridge;

  if (!window.SkyeGateFS13Client) {
    window.SkyeGateFS13Client = {
      async mirrorEvent(payload) {
        const event = bridge.emit(payload?.type || 'gatefs13.event', payload || {});
        return { ok: true, queued: true, eventId: event.eventId };
      },
      async askAI(payload) {
        const event = bridge.emit('gatefs13.ai.requested', payload || {});
        return {
          ok: false,
          queued: true,
          eventId: event.eventId,
          detail: 'No live gateway endpoint is configured in this browser session yet.',
        };
      },
    };
  }
})();
