'use strict';
const store = new Map();
const key = (service, account = '') => `${service}::${account}`;
exports.findCredentials = async service => Array.from(store.entries()).filter(([entry]) => entry.startsWith(`${service}::`)).map(([entry, password]) => ({ account: entry.slice(service.length + 2), password }));
exports.findPassword = async service => { const match = Array.from(store.entries()).find(([entry]) => entry.startsWith(`${service}::`)); return match ? match[1] : null; };
exports.getPassword = async (service, account) => store.get(key(service, account)) ?? null;
exports.setPassword = async (service, account, password) => { store.set(key(service, account), String(password ?? '')); return true; };
exports.deletePassword = async (service, account) => store.delete(key(service, account));
