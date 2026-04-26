function safeJson(value, fallback) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

export function normalizePaymentDisputeInput(input = {}) {
  return {
    orderId: String(input.orderId || input.order_id || '').trim(),
    provider: String(input.provider || 'stripe').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'stripe',
    providerDisputeId: String(input.providerDisputeId || input.provider_dispute_id || '').trim().slice(0, 160),
    amountCents: Math.max(0, Number(input.amountCents || input.amount_cents || 0)),
    currency: String(input.currency || 'USD').trim().toUpperCase().slice(0, 3) || 'USD',
    reason: String(input.reason || 'fraudulent').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'fraudulent',
    status: ['needs_response', 'under_review', 'won', 'lost', 'accepted'].includes(String(input.status || '').toLowerCase()) ? String(input.status).toLowerCase() : 'needs_response',
    dueAt: input.dueAt || input.due_at || '',
    evidenceDueBy: input.evidenceDueBy || input.evidence_due_by || input.dueAt || input.due_at || ''
  };
}

export function paymentDisputeRecord(row = {}) {
  return {
    id: row.id,
    merchantId: row.merchant_id || row.merchantId || '',
    orderId: row.order_id || row.orderId || '',
    provider: row.provider || '',
    providerDisputeId: row.provider_dispute_id || row.providerDisputeId || '',
    amountCents: Number(row.amount_cents || row.amountCents || 0),
    currency: row.currency || 'USD',
    reason: row.reason || '',
    status: row.status || 'needs_response',
    dueAt: row.due_at || row.dueAt || '',
    evidenceDueBy: row.evidence_due_by || row.evidenceDueBy || '',
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || '',
    providerSubmission: safeJson(row.provider_submission_json || row.providerSubmissionJson, {})
  };
}

export function normalizeDisputeEvidenceInput(input = {}) {
  return {
    customerCommunication: String(input.customerCommunication || input.customer_communication || '').trim().slice(0, 5000),
    fulfillmentProof: String(input.fulfillmentProof || input.fulfillment_proof || '').trim().slice(0, 5000),
    refundPolicy: String(input.refundPolicy || input.refund_policy || '').trim().slice(0, 5000),
    cancellationPolicy: String(input.cancellationPolicy || input.cancellation_policy || '').trim().slice(0, 5000),
    uncategorizedText: String(input.uncategorizedText || input.uncategorized_text || '').trim().slice(0, 5000),
    attachments: Array.isArray(input.attachments) ? input.attachments.map((item) => ({ label: String(item.label || '').slice(0, 120), url: String(item.url || '').slice(0, 500) })).filter((item) => item.url) : []
  };
}

export function buildDisputeEvidencePacket(dispute = {}, context = {}, manualEvidence = {}) {
  const order = context.order || {};
  const fulfillments = context.fulfillments || [];
  const shippingLabels = context.shippingLabels || [];
  const payments = context.payments || [];
  const riskAssessments = context.riskAssessments || [];
  const returns = context.returns || [];
  const evidence = normalizeDisputeEvidenceInput(manualEvidence);
  const sections = {
    orderSummary: {
      orderNumber: order.orderNumber || order.order_number || '',
      customerName: order.customerName || order.customer_name || '',
      customerEmail: order.customerEmail || order.customer_email || '',
      totalCents: Number(order.totalCents || order.total_cents || dispute.amountCents || 0),
      createdAt: order.createdAt || order.created_at || ''
    },
    paymentProof: payments.map((payment) => ({ provider: payment.provider, status: payment.status, amountCents: payment.amountCents, providerReference: payment.providerReference || payment.provider_reference || '' })),
    fulfillmentProof: fulfillments.map((item) => ({ carrier: item.carrier, service: item.service, trackingNumber: item.trackingNumber || item.tracking_number || '', status: item.status })),
    shippingLabels: shippingLabels.map((item) => ({ provider: item.provider, trackingNumber: item.trackingNumber || item.tracking_number || '', labelUrl: item.labelUrl || item.label_url || '' })),
    risk: riskAssessments.map((item) => ({ score: item.score, decision: item.decision, reasons: item.reasons || [] })),
    returns: returns.map((item) => ({ status: item.status, resolutionType: item.resolutionType || item.resolution_type || '', requestedCents: item.requestedCents || item.requested_cents || 0 })),
    manual: evidence
  };
  const score = [
    sections.orderSummary.orderNumber,
    sections.paymentProof.length,
    sections.fulfillmentProof.length || evidence.fulfillmentProof,
    evidence.customerCommunication,
    evidence.refundPolicy,
    evidence.attachments.length,
    riskAssessments.length
  ].filter(Boolean).length;
  return {
    disputeId: dispute.id || '',
    provider: dispute.provider || '',
    providerDisputeId: dispute.providerDisputeId || dispute.provider_dispute_id || '',
    reason: dispute.reason || '',
    status: score >= 4 ? 'ready' : 'needs_more_evidence',
    evidenceScore: Math.min(100, score * 15),
    recommendedResponse: score >= 4 ? 'submit_evidence' : 'collect_more_evidence',
    sections
  };
}

export function disputeEvidenceRecord(row = {}) {
  const evidence = safeJson(row.evidence_json || row.evidenceJson, {});
  return {
    id: row.id,
    merchantId: row.merchant_id || row.merchantId || '',
    disputeId: row.dispute_id || row.disputeId || '',
    status: row.status || evidence.status || 'draft',
    evidenceScore: Number(row.evidence_score || row.evidenceScore || evidence.evidenceScore || 0),
    evidence,
    submittedAt: row.submitted_at || row.submittedAt || null,
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || '',
    providerSubmission: safeJson(row.provider_submission_json || row.providerSubmissionJson, {})
  };
}
