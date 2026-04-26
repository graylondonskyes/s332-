const { assertMethod, json, noContent, readJsonBody } = require('./_printful');
const { sanitizeString } = require('./_order');
const { describeStore, saveRecord } = require('./_state-store');

exports.handler = async (event) => {
  try {
    const method = assertMethod(event, 'POST');
    if (method === 'OPTIONS') return noContent(event);

    const body = await readJsonBody(event);
    const source = body.clientPackage || body.source || body;
    if (!source?.packageId) {
      return json(event, 400, {
        ok: false,
        error: 'clientPackage with packageId is required.',
      });
    }

    const status = sanitizeString(body.status || source.tracker?.currentStatus || 'quoted') || 'quoted';
    const note = sanitizeString(body.note || 'Status updated.');
    const actor = sanitizeString(body.actor || 'operator');
    const trackingNumber = sanitizeString(body.trackingNumber || source.tracker?.trackingNumber);
    const trackingUrl = sanitizeString(body.trackingUrl || source.tracker?.trackingUrl);
    const approvedBy = sanitizeString(body.approvedBy || source.approval?.approvedBy);
    const approvedEmail = sanitizeString(body.approvedEmail || source.approval?.approvedEmail);
    const now = new Date().toISOString();

    const updatedPackage = {
      ...source,
      tracker: {
        ...(source.tracker || {}),
        currentStatus: status,
        trackingNumber: trackingNumber || undefined,
        trackingUrl: trackingUrl || undefined,
        history: [
          ...((source.tracker?.history || []).filter(Boolean)),
          {
            at: now,
            status,
            actor,
            note,
            trackingNumber: trackingNumber || undefined,
            trackingUrl: trackingUrl || undefined,
          },
        ],
      },
      approval: {
        ...(source.approval || {}),
        approved: status === 'approved' || source.approval?.approved === true,
        approvedAt: status === 'approved' ? now : source.approval?.approvedAt,
        approvedBy: approvedBy || source.approval?.approvedBy || undefined,
        approvedEmail: approvedEmail || source.approval?.approvedEmail || undefined,
      },
      updatedAt: now,
    };

    const record = await saveRecord('clientPackages', updatedPackage.packageId, updatedPackage, {
      status: updatedPackage.tracker?.currentStatus || '',
      customer: updatedPackage.customer?.name || '',
      total: updatedPackage.quote?.totals?.total || 0,
    });
    const storage = await describeStore();

    return json(event, 200, {
      ok: true,
      clientPackage: updatedPackage,
      record,
      storage,
    });
  } catch (error) {
    return json(event, error.statusCode || 500, {
      ok: false,
      error: error.message,
    });
  }
};
