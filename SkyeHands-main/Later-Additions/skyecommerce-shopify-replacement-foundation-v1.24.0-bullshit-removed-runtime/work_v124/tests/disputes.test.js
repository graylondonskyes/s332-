import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDisputeEvidencePacket, disputeEvidenceRecord, normalizeDisputeEvidenceInput, normalizePaymentDisputeInput, paymentDisputeRecord } from '../src/lib/disputes.js';

test('payment disputes normalize provider data and build evidence packets', () => {
  const input = normalizePaymentDisputeInput({ orderId: 'ord_1', provider: 'Stripe', providerDisputeId: 'dp_123', amountCents: 5000, reason: 'product_not_received' });
  assert.equal(input.provider, 'stripe');
  const dispute = paymentDisputeRecord({ id: 'dsp_1', merchant_id: 'm1', order_id: input.orderId, provider: input.provider, provider_dispute_id: input.providerDisputeId, amount_cents: input.amountCents, reason: input.reason });
  const manual = normalizeDisputeEvidenceInput({ customerCommunication: 'Customer confirmed delivery window.', refundPolicy: 'Refunds require return authorization.', attachments: [{ label: 'tracking', url: 'https://example.com/tracking.pdf' }] });
  const packet = buildDisputeEvidencePacket(dispute, {
    order: { orderNumber: 'SKY-1001', customerEmail: 'buyer@example.com', totalCents: 5000 },
    payments: [{ provider: 'stripe', status: 'paid', amountCents: 5000, providerReference: 'pi_123' }],
    fulfillments: [{ carrier: 'UPS', trackingNumber: '1Z999', status: 'delivered' }],
    riskAssessments: [{ score: 12, decision: 'approve', reasons: [] }]
  }, manual);
  assert.equal(packet.status, 'ready');
  assert.equal(packet.recommendedResponse, 'submit_evidence');
  const evidence = disputeEvidenceRecord({ id: 'evd_1', merchant_id: 'm1', dispute_id: dispute.id, evidence_json: JSON.stringify(packet), evidence_score: packet.evidenceScore, status: packet.status });
  assert.equal(evidence.evidence.sections.fulfillmentProof[0].trackingNumber, '1Z999');
});
