const KNOWN_INTEGRATIONS = [
  'database',
  'proof_storage',
  'payment_provider',
  'notification_provider',
  'route_intelligence',
  'identity_compliance',
  'skyehands_runtime'
];

function configured(value) {
  return value && value !== 'off' && value !== 'none' && value !== 'local-only';
}

export function createIntegrationRegistry({ database, proofStorage, services, env = process.env } = {}) {
  const rows = {
    database: {
      status: database.driver === 'local-json' ? 'local-proof' : 'connected',
      driver: database.driver,
      note: database.driver === 'local-json' ? 'Local JSON datastore; not production persistence.' : 'External database adapter is active.'
    },
    proof_storage: {
      status: ['local-json', 'local-files'].includes(proofStorage.driver) ? 'local-proof' : 'connected',
      driver: proofStorage.driver,
      note: ['local-json', 'local-files'].includes(proofStorage.driver) ? 'Local proof media/export files; not production object storage.' : 'External proof storage adapter is active.'
    },
    payment_provider: {
      status: services.payment.status,
      driver: services.payment.driver,
      note: services.payment.note
    },
    notification_provider: {
      status: services.notifications.status,
      driver: services.notifications.driver,
      note: services.notifications.note
    },
    route_intelligence: {
      status: services.routeIntelligence.status,
      driver: services.routeIntelligence.driver,
      note: services.routeIntelligence.note
    },
    identity_compliance: {
      status: services.compliance.status,
      driver: services.compliance.driver,
      note: services.compliance.note
    },
    skyehands_runtime: {
      status: services.runtime.status,
      driver: services.runtime.driver,
      note: services.runtime.note
    }
  };

  return {
    list() {
      return KNOWN_INTEGRATIONS.map(name => ({ name, ...rows[name] }));
    },
    status() {
      return Object.fromEntries(this.list().map(row => [row.name, row]));
    }
  };
}
