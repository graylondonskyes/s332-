'use strict';

/**
 * appointment-services.js
 *
 * GET  — list all services
 * POST action=create  — { name, durationMinutes, priceCents, description }
 * POST action=update  — { id, ...fields }
 * POST action=delete  — { id }
 */

const fs   = require('node:fs');
const { allServices, orgSettings, parseBody, response, genId, nowISO } = require('./_shared');

function servicesFile() {
  const { APPOINTMENT_DATA_DIR } = process.env;
  const os   = require('node:os');
  const path = require('node:path');
  const dir  = APPOINTMENT_DATA_DIR || path.join(os.tmpdir(), 'skye-appointments');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'services.json');
}

function saveServices(list) {
  fs.writeFileSync(servicesFile(), JSON.stringify(list, null, 2), 'utf8');
}

module.exports.handler = async (event = {}) => {
  const method = (event.httpMethod || 'GET').toUpperCase();
  if (method === 'OPTIONS') return response(204, {});

  if (method === 'GET') {
    const services = allServices();
    const org      = orgSettings();
    return response(200, { ok: true, services, orgSettings: org, total: services.length });
  }

  if (method !== 'POST') return response(405, { ok: false, error: 'method_not_allowed' });

  const body   = parseBody(event);
  const action = String(body.action || 'create').toLowerCase();

  if (action === 'create') {
    const { name, durationMinutes, priceCents, description } = body;
    if (!name)            return response(400, { ok: false, error: 'name is required' });
    if (!durationMinutes) return response(400, { ok: false, error: 'durationMinutes is required' });

    const service = {
      id:              body.id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name,
      durationMinutes: Number(durationMinutes),
      priceCents:      Number(priceCents || 0),
      description:     description || '',
      createdAt:       nowISO(),
    };

    const list = allServices();
    if (list.find(s => s.id === service.id)) {
      return response(409, { ok: false, error: `Service with id '${service.id}' already exists` });
    }
    list.push(service);
    saveServices(list);
    return response(201, { ok: true, service });
  }

  if (action === 'update') {
    const { id, ...updates } = body;
    if (!id) return response(400, { ok: false, error: 'id is required' });
    const list = allServices();
    const idx  = list.findIndex(s => s.id === id);
    if (idx < 0) return response(404, { ok: false, error: 'Service not found' });
    list[idx] = { ...list[idx], ...updates, id, updatedAt: nowISO() };
    saveServices(list);
    return response(200, { ok: true, service: list[idx] });
  }

  if (action === 'delete') {
    const { id } = body;
    if (!id) return response(400, { ok: false, error: 'id is required' });
    const list    = allServices();
    const updated = list.filter(s => s.id !== id);
    if (updated.length === list.length) return response(404, { ok: false, error: 'Service not found' });
    saveServices(updated);
    return response(200, { ok: true, deleted: id });
  }

  return response(400, { ok: false, error: `Unknown action: ${action}. Valid: create, update, delete` });
};
