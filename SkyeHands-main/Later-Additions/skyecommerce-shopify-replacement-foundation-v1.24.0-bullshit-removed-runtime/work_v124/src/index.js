import {
  dbAll,
  dbFirst,
  dbRun,
  json,
  hmacHex,
  parseCookie,
  readJson,
  sha256Hex,
  signToken,
  slugify,
  text,
  uid,
  verifyToken
} from './lib/utils.js';
import { buildRoutePacket } from './lib/ae.js';
import { handleCustomerApi, resolveCustomerSessionForMerchant, buildCustomerDisplayName } from './lib/customer-api.js';
import { collectionRecord, navLinkRecord, normalizeCollectionInput, normalizeNavLinkInput, normalizePageInput, pageRecord } from './lib/content.js';
import { buildMerchantAnalytics } from './lib/analytics.js';
import { buildChannelCatalogExport, buildChannelSyncDispatch, channelSyncJobRecord, normalizeSalesChannelInput, salesChannelRecord } from './lib/channels.js';
import { carrierProfileRecord, normalizeCarrierProfileInput, normalizeLabelPurchaseInput, normalizeRateRequest, purchaseShippingLabel, quoteCarrierRates, shippingLabelRecord } from './lib/carriers.js';
import { buildCommerceNotifications, notificationRecord } from './lib/notifications.js';
import { discountRecord, normalizeDiscountInput } from './lib/discounts.js';
import { fetchAndScanStorefront, normalizeShopifyGraphQLProducts, parseShopifyCsvProducts } from './lib/importers.js';
import {
  allocateInventoryDemand,
  inventoryAdjustmentRecord,
  inventoryLevelRecord,
  locationRecord,
  normalizeInventoryAdjustmentInput,
  normalizeInventoryLocationInput,
  orderAllocationRecord
} from './lib/inventory.js';
import { buildOrderEvent, normalizeFulfillmentInput, normalizeOrderPatch } from './lib/orders.js';
import { applyPaymentWebhook, buildHostedPaymentSession, buildPaymentTimelineEvent, normalizeNativePaymentWebhookInput, normalizePaymentSessionInput, normalizePaymentWebhookInput, paymentTransactionRecord } from './lib/payments.js';
import { computeOrderQuote } from './lib/quote.js';
import { normalizeReturnPatch, normalizeReturnRequestInput, returnRecord, shouldRestockReturn } from './lib/returns.js';
import { applyOrderToNexusRollup, nexusRollupRecord, normalizeTaxNexusRuleInput, taxNexusRuleRecord } from './lib/tax-nexus.js';
import { buildStorefrontSnapshot, defaultTheme } from './lib/snapshot.js';
import { buildSubscriptionRenewal, customerSubscriptionRecord, normalizeSubscriptionCreateInput, normalizeSubscriptionPatch, normalizeSubscriptionPlanInput, subscriptionInvoiceRecord, subscriptionPlanRecord } from './lib/subscriptions.js';
import { applyInvoicePaymentUpdate, buildDunningEvent, dunningEventRecord, normalizeInvoicePaymentSessionInput } from './lib/dunning.js';
import { summarizeProviderSmoke, validateCarrierProviderSmoke, validateNotificationProviderSmoke, validatePaymentProviderSmoke } from './lib/provider-smoke.js';
import { buildNativeProviderDispatch, buildProviderHealthSpec, normalizeProviderConnectionInput, providerConnectionRecord } from './lib/provider-adapters.js';
import { attachVariantsToProducts, normalizeVariantInput, productVariantRecord, resolveSellableVariant } from './lib/variants.js';
import { buildCheckoutRecoveryNotification, checkoutSessionRecord, classifyCheckout, normalizeCheckoutInput } from './lib/checkouts.js';
import { giftCardLedgerRecord, giftCardRecord, hashGiftCardCode, normalizeGiftCardIssueInput, previewGiftCardRedemption } from './lib/gift-cards.js';
import { normalizeRiskSignalInput, riskAssessmentRecord, scoreOrderRisk } from './lib/risk.js';
import { buildSignedWebhookRequest, normalizeWebhookEndpointInput, webhookDeliveryRecord, webhookEndpointRecord } from './lib/webhooks.js';
import { bundleRecord, normalizeBundleInput } from './lib/bundles.js';
import { buildPurchaseOrderReceipt, normalizePurchaseOrderInput, normalizeSupplierInput, purchaseOrderItemRecord, purchaseOrderRecord, supplierRecord } from './lib/supply-chain.js';
import { customerSegmentRecord, normalizeCustomerSegmentInput, normalizePriceListInput, priceListItemRecord, priceListRecord } from './lib/price-lists.js';
import { hasStaffPermission, normalizeStaffInvitationInput, normalizeStaffMemberInput, normalizeStaffRoleInput, staffInvitationRecord, staffMemberRecord, staffRoleRecord } from './lib/staff.js';
import { buildPosCheckoutReceipt, normalizePosCartInput, normalizeRegisterInput, normalizeShiftCloseInput, normalizeShiftOpenInput, posCartRecord, registerRecord, shiftRecord } from './lib/pos.js';
import { buildRefundPreview, normalizeRefundRequestInput, refundRecord } from './lib/refunds.js';
import { buildAutomationActionEffects, evaluateWorkflowRule, normalizeWorkflowRuleInput, workflowRuleRecord, workflowRunRecord } from './lib/automation.js';
import { calculateEarnedPoints, loyaltyLedgerRecord, loyaltyProgramRecord, normalizeLoyaltyLedgerInput, normalizeLoyaltyProgramInput, previewLoyaltyRedemption, summarizeLoyaltyBalance } from './lib/loyalty.js';
import { moderateReview, normalizeProductReviewInput, productReviewRecord, summarizeProductReviews } from './lib/reviews.js';
import { buildInventoryTransferPlan, inventoryTransferRecord, normalizeInventoryTransferInput } from './lib/inventory-transfers.js';
import { apiTokenRecord, appInstallationRecord, commerceAppRecord, createRawApiToken, hashApiToken, hasApiScope, normalizeApiTokenInput, normalizeAppInstallationInput, normalizeCommerceAppInput } from './lib/platform-apps.js';
import { buildDomainVerification, buildSitemapEntries, customDomainRecord, normalizeCustomDomainInput, normalizeRedirectRuleInput, normalizeSeoEntryInput, redirectRuleRecord, renderSitemapXml, seoEntryRecord } from './lib/storefront-ops.js';
import { buildDisputeEvidencePacket, disputeEvidenceRecord, normalizePaymentDisputeInput, paymentDisputeRecord } from './lib/disputes.js';
import { decryptProviderConfig, encryptProviderConfig, secureConfigRecord } from './lib/secure-config.js';
import { appBillingInvoiceRecord, appBillingPlanRecord, appBillingSubscriptionRecord, appUsageEventRecord, buildAppBillingInvoice, normalizeAppBillingPlanInput, normalizeAppBillingSubscriptionInput, normalizeAppUsageEventInput } from './lib/app-billing.js';
import { buildCloudflareCustomHostnameRequest, buildCloudflareCustomHostnameStatusRequest, domainCertificateJobRecord, executeCloudflareCertificateRequest, verifyDnsTxtRecord } from './lib/domain-certificates.js';
import { hashMerchantPassword, verifyMerchantPassword } from './lib/passwords.js';
import {
  CSRF_COOKIE,
  authSubject,
  backoffMinutes,
  checkAuthLockout,
  clearCsrfCookie,
  clientIp,
  createCsrfToken,
  enforceCsrf,
  findIdempotencyRecord,
  idempotencyScopeForRequest,
  isMutatingMethod,
  normalizeIdempotencyKey,
  recordAuthAttempt,
  requestBodyHash,
  responseFromIdempotencyRecord,
  setCsrfCookie,
  storeIdempotencyRecord
} from './lib/security.js';

import { dueQueuePredicate, nextQueueFailureState, notificationProviderMissingMessage, queueRunSummary } from './lib/queue-hardening.js';
import { applyApiResponseHeaders, enforceApiBodyLimit, enforceApiRateLimit, optionsResponse, runtimeSecurityReadiness } from './lib/http-hardening.js';
import {
  buildFulfillmentSyncPayload,
  buildProductDetailPath,
  buildProductMediaRecord,
  buildRoutexHandoffPayload,
  donorVisualImportRecord,
  executeRoutexHandoff,
  executeSignedJsonPost,
  extractDonorVisualsFromHtml,
  fulfillmentSyncJobRecord,
  productMediaRecord,
  requireHttpsUrl,
  routexHandoffRecord
} from './lib/full-platform.js';
import {
  appReviewSubmissionRecord,
  appSettlementRecord,
  applyPickScanToLines,
  buildAppSettlement,
  buildEndOfDayReconciliation,
  buildOAuthInstallSession,
  buildPickListFromOrder,
  buildPublicCheckoutReturnUrls,
  buildPublicOrderAccessToken,
  buildRoutePlan,
  buildTaxFilingPayload,
  verifyPublicOrderAccessToken,
  cashDrawerEventRecord,
  developerAccountRecord,
  executeReceiptPrinterJob,
  executeSignedProviderPost,
  executeStripeTerminalPayment,
  normalizeAppReviewPatch,
  normalizeAppSettlementPatch,
  normalizeBinInventoryInput,
  normalizeCashDrawerEventInput,
  normalizeDeveloperAccountInput,
  normalizeDeveloperAccountPatch,
  normalizePciControlInput,
  normalizePickScanInput,
  normalizePublicCheckoutProvider,
  normalizeReturnPickupInput,
  normalizeReturnPickupPatch,
  normalizeRouteDriverInput,
  normalizeRoutePlanInput,
  normalizeRoutePlanPatch,
  normalizeRouteStopEventInput,
  normalizeRouteVehicleInput,
  normalizeWarehouseBinInput,
  offlineSyncEventRecord,
  pciControlRecord,
  pickListRecord,
  returnPickupRecord,
  routeDriverRecord,
  routePlanEventRecord,
  routePlanRecord,
  routeVehicleRecord,
  terminalPaymentRecord,
  applyRouteStopEventToStops,
  warehouseBinInventoryRecord,
  warehouseBinRecord
} from './lib/platform-closure.js';
import {
  buildWarehouseWorkOrderPayload,
  executeWarehouseWorkOrder,
  nextFulfillmentStatusFromShipment,
  normalizeShipmentTrackingEvent,
  normalizeWarehouseWorkOrderInput,
  shipmentTrackingEventRecord,
  verifySignedJsonWebhook
} from './lib/warehouse-ops.js';
import { executeProviderCarrierRates, executeProviderDisputeEvidence, executeProviderHealth, executeProviderRefund, executeNativeProviderDispatch, missingProviderSecrets, verifyPaypalWebhookSignature } from './lib/provider-runtime.js';
import { enforceCarrierProviderPolicy, enforceChannelProviderPolicy, enforcePaymentProviderPolicy, productionRuntimeReadiness } from './lib/production-hardening.js';

const SESSION_COOKIE = 'skye_session';

function setSessionCookie(token, maxAge = 60 * 60 * 24 * 7) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function cleanHtml(html = '') {
  return String(html || '').replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '').trim();
}

function merchantRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    brandName: row.brand_name,
    email: row.email,
    currency: row.currency,
    accentColor: row.accent_color,
    surfaceColor: row.surface_color,
    backgroundColor: row.background_color,
    textColor: row.text_color,
    heroTitle: row.hero_title,
    heroTagline: row.hero_tagline,
    checkoutNote: row.checkout_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function productRecord(row) {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.short_description || '',
    descriptionHtml: row.description_html || '',
    priceCents: Number(row.price_cents || 0),
    compareAtCents: Number(row.compare_at_cents || 0),
    sku: row.sku || '',
    inventoryOnHand: Number(row.inventory_on_hand || 0),
    trackInventory: Boolean(Number(row.track_inventory || 0)),
    status: row.status,
    heroImageUrl: row.hero_image_url || '',
    sourceType: row.source_type || '',
    sourceRef: row.source_ref || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function productDetailRecord(env, row) {
  if (!row) return null;
  const product = productRecord(row);
  const [variants, media] = await Promise.all([
    getProductVariants(env, row.merchant_id, row.id),
    listProductMedia(env, row.merchant_id, row.id)
  ]);
  return {
    ...product,
    variants,
    media,
    detailPath: buildProductDetailPath(product)
  };
}

function shippingRecord(row) {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    name: row.name,
    originCountry: row.origin_country,
    originState: row.origin_state,
    rates: JSON.parse(row.rates_json || '[]')
  };
}

function taxRecord(row) {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    label: row.label,
    countryCode: row.country_code,
    stateCode: row.state_code,
    rateBps: Number(row.rate_bps || 0)
  };
}

function orderSummary(row) {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    orderNumber: row.order_number,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentReference: row.payment_reference || '',
    discountCode: row.discount_code || '',
    discountCents: Number(row.discount_cents || 0),
    currency: row.currency,
    customerId: row.customer_id || '',
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    subtotalCents: Number(row.subtotal_cents || 0),
    shippingCents: Number(row.shipping_cents || 0),
    taxCents: Number(row.tax_cents || 0),
    totalCents: Number(row.total_cents || 0),
    notes: row.notes || '',
    giftCardCodeLast4: row.gift_card_code_last4 || '',
    giftCardCents: Number(row.gift_card_cents || 0),
    checkoutSessionId: row.checkout_session_id || '',
    shippingAddress: JSON.parse(row.shipping_address_json || '{}'),
    items: JSON.parse(row.items_json || '[]'),
    createdAt: row.created_at
  };
}

function fulfillmentRecord(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    carrier: row.carrier || '',
    service: row.service || '',
    trackingNumber: row.tracking_number || '',
    trackingUrl: row.tracking_url || '',
    status: row.status || 'queued',
    note: row.note || '',
    createdAt: row.created_at
  };
}

function orderEventRecord(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    kind: row.kind,
    summary: row.summary,
    detail: row.detail || '',
    status: row.status || '',
    paymentStatus: row.payment_status || '',
    fulfillmentStatus: row.fulfillment_status || '',
    createdAt: row.created_at
  };
}

function buildAbsoluteOrigin(requestUrl) {
  return `${requestUrl.protocol}//${requestUrl.host}`;
}

async function listMerchantPaymentTransactions(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM payment_transactions WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  return rows.map(paymentTransactionRecord);
}

async function listMerchantNotifications(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM notification_messages WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  return rows.map(notificationRecord);
}

async function listMerchantTaxNexusRules(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM tax_nexus_rules WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  return rows.map(taxNexusRuleRecord);
}

async function listMerchantTaxNexusRollups(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM tax_nexus_rollups WHERE merchant_id = ? ORDER BY threshold_met DESC, gross_cents DESC, updated_at DESC`, [merchantId]);
  return rows.map(nexusRollupRecord);
}


async function toProviderConnectionRecord(env, row, { exposeConfig = false } = {}) {
  if (!row) return null;
  const secured = await secureConfigRecord(env, row, { expose: exposeConfig });
  const record = providerConnectionRecord(secured);
  record.configEncrypted = Boolean(Number(secured.config_encrypted || 0));
  return record;
}

async function listMerchantProviderConnections(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM provider_connections WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  return Promise.all(rows.map((row) => toProviderConnectionRecord(env, row, { exposeConfig: false })));
}

async function getMerchantProviderConnection(env, merchantId, connectionId, options = {}) {
  const row = await dbFirst(env, `SELECT * FROM provider_connections WHERE merchant_id = ? AND id = ? LIMIT 1`, [merchantId, connectionId]);
  return row ? toProviderConnectionRecord(env, row, { exposeConfig: true, ...options }) : null;
}

async function getActiveProviderConnection(env, merchantId, provider, options = {}) {
  const row = await dbFirst(env, `SELECT * FROM provider_connections WHERE merchant_id = ? AND provider = ? AND active = 1 ORDER BY updated_at DESC, created_at DESC LIMIT 1`, [merchantId, provider]);
  return row ? toProviderConnectionRecord(env, row, { exposeConfig: true, ...options }) : null;
}

async function resolveProviderConnection(env, merchantId, provider, connectionId = '') {
  if (connectionId) return getMerchantProviderConnection(env, merchantId, connectionId, { exposeConfig: true });
  return getActiveProviderConnection(env, merchantId, provider, { exposeConfig: true });
}

async function listCommerceApps(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM commerce_apps WHERE merchant_id = ? ORDER BY updated_at DESC, created_at DESC`, [merchantId]);
  return rows.map(commerceAppRecord);
}

async function listAppInstallations(env, merchantId) {
  const rows = await dbAll(env, `
    SELECT app_installations.*, commerce_apps.id AS app_join_id, commerce_apps.app_key, commerce_apps.name AS app_name,
           commerce_apps.developer_name, commerce_apps.app_url, commerce_apps.webhook_url,
           commerce_apps.requested_scopes_json, commerce_apps.status AS app_status, commerce_apps.pricing_json
    FROM app_installations
    LEFT JOIN commerce_apps ON commerce_apps.id = app_installations.app_id
    WHERE app_installations.merchant_id = ?
    ORDER BY app_installations.installed_at DESC
  `, [merchantId]);
  return rows.map((row) => appInstallationRecord(row, row.app_join_id ? {
    id: row.app_join_id,
    merchant_id: row.merchant_id,
    app_key: row.app_key,
    name: row.app_name,
    developer_name: row.developer_name,
    app_url: row.app_url,
    webhook_url: row.webhook_url,
    requested_scopes_json: row.requested_scopes_json,
    status: row.app_status,
    pricing_json: row.pricing_json
  } : null));
}

async function listApiTokens(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM api_access_tokens WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  return rows.map((row) => apiTokenRecord(row));
}

async function requireApiBearer(request, env, requiredScope = '') {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return { error: unauthorized('Missing bearer token.') };
  const rawToken = match[1].trim();
  const tokenHash = await hashApiToken(env.API_TOKEN_HASH_SECRET || env.SESSION_SECRET, rawToken);
  const row = await dbFirst(env, `
    SELECT * FROM api_access_tokens
    WHERE token_hash = ?
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at = '' OR datetime(expires_at) > datetime('now'))
    LIMIT 1
  `, [tokenHash]);
  if (!row) return { error: unauthorized('Invalid or revoked bearer token.') };
  const token = apiTokenRecord(row);
  if (!hasApiScope(token.scopes, requiredScope)) return { error: json({ error: `Bearer token missing required scope: ${requiredScope}` }, 403) };
  await dbRun(env, `UPDATE api_access_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?`, [row.id]);
  return { api: { tokenId: row.id, merchantId: row.merchant_id, scopes: token.scopes, label: token.label } };
}

async function listCustomDomains(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM custom_domains WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  return rows.map(customDomainRecord);
}

async function listDomainCertificateJobs(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM domain_certificate_jobs WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 200`, [merchantId]);
  return rows.map(domainCertificateJobRecord);
}

async function listRedirectRules(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM redirect_rules WHERE merchant_id = ? ORDER BY active DESC, from_path ASC`, [merchantId]);
  return rows.map(redirectRuleRecord);
}

async function listSeoEntries(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM seo_entries WHERE merchant_id = ? ORDER BY resource_type ASC, path ASC`, [merchantId]);
  return rows.map(seoEntryRecord);
}

async function listPaymentDisputes(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM payment_disputes WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  const evidenceRows = await dbAll(env, `SELECT * FROM dispute_evidence WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  const evidenceByDispute = new Map();
  for (const evidence of evidenceRows.map(disputeEvidenceRecord)) {
    if (!evidenceByDispute.has(evidence.disputeId)) evidenceByDispute.set(evidence.disputeId, []);
    evidenceByDispute.get(evidence.disputeId).push(evidence);
  }
  return rows.map((row) => ({ ...paymentDisputeRecord(row), evidence: evidenceByDispute.get(row.id) || [] }));
}

async function listAppBillingPlans(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM app_billing_plans WHERE merchant_id = ? ORDER BY active DESC, created_at DESC`, [merchantId]);
  return rows.map(appBillingPlanRecord);
}

async function listAppBillingSubscriptions(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM app_billing_subscriptions WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  return rows.map(appBillingSubscriptionRecord);
}

async function listAppUsageEvents(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM app_usage_events WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 500`, [merchantId]);
  return rows.map(appUsageEventRecord);
}

async function listAppBillingInvoices(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM app_billing_invoices WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 500`, [merchantId]);
  return rows.map(appBillingInvoiceRecord);
}

async function getCustomerById(env, customerId) {
  if (!customerId) return null;
  return dbFirst(env, `SELECT * FROM customer_accounts WHERE id = ? LIMIT 1`, [customerId]);
}


async function listMerchantCarrierProfiles(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM carrier_profiles WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  return rows.map(carrierProfileRecord);
}

async function listOrderShippingLabels(env, orderId, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM shipping_labels WHERE order_id = ? AND merchant_id = ? ORDER BY created_at DESC`, [orderId, merchantId]);
  return rows.map(shippingLabelRecord);
}

async function listMerchantSubscriptionPlans(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM subscription_plans WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  return rows.map(subscriptionPlanRecord);
}

async function listMerchantSubscriptions(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM customer_subscriptions WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  return rows.map(customerSubscriptionRecord);
}

async function listMerchantSubscriptionInvoices(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM subscription_invoices WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  return rows.map(subscriptionInvoiceRecord);
}

async function listMerchantProviderSmokeRuns(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM provider_smoke_runs WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  return rows.map((row) => ({
    id: row.id,
    merchantId: row.merchant_id || '',
    lane: row.lane || '',
    status: row.status || '',
    summary: (() => { try { return JSON.parse(row.summary_json || '{}'); } catch { return {}; } })(),
    createdAt: row.created_at || ''
  }));
}

function providerValidationRunRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    merchantId: row.merchant_id || '',
    connectionId: row.connection_id || '',
    provider: row.provider || '',
    mode: row.mode || 'health',
    status: row.status || '',
    httpStatus: Number(row.http_status || 0),
    missing: (() => { try { return JSON.parse(row.missing_json || '[]'); } catch { return []; } })(),
    result: (() => { try { return JSON.parse(row.result_json || '{}'); } catch { return {}; } })(),
    error: row.error || '',
    createdAt: row.created_at || ''
  };
}

async function recordProviderValidationRun(env, merchantId, connectionId, provider, mode, result = {}, missing = [], error = '') {
  const id = uid('pval');
  const status = error ? (missing && missing.length ? 'missing_secrets' : 'failed') : (result.status === 'executed' ? 'passed' : (result.status || 'failed'));
  await dbRun(env, `
    INSERT INTO provider_validation_runs (id, merchant_id, connection_id, provider, mode, status, http_status, missing_json, result_json, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, merchantId, connectionId || '', provider || '', mode || 'health', status, Number(result.httpStatus || 0), JSON.stringify(missing || []), JSON.stringify(result || {}), String(error || '').slice(0, 500)]);
  return providerValidationRunRecord(await dbFirst(env, `SELECT * FROM provider_validation_runs WHERE id = ? LIMIT 1`, [id]));
}

async function listProviderValidationRuns(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM provider_validation_runs WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 200`, [merchantId]);
  return rows.map(providerValidationRunRecord);
}

async function listMerchantSalesChannels(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM sales_channels WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  return rows.map(salesChannelRecord);
}

async function listMerchantChannelSyncJobs(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM channel_sync_jobs WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  return rows.map(channelSyncJobRecord);
}

async function listMerchantDunningEvents(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM subscription_dunning_events WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  return rows.map(dunningEventRecord);
}

async function recordProviderSmokeRun(env, merchantId, lane, summary) {
  const id = uid('smoke');
  await dbRun(env, `INSERT INTO provider_smoke_runs (id, merchant_id, lane, status, summary_json) VALUES (?, ?, ?, ?, ?)`, [id, merchantId || null, lane, summary.pass ? 'passed' : 'failed', JSON.stringify(summary)]);
  return id;
}

async function recordDunningEvent(env, merchantId, subscriptionId, invoiceId, stage, note = '') {
  const event = buildDunningEvent({ stage, note, subscriptionId, invoiceId });
  const id = uid('dun');
  await dbRun(env, `INSERT INTO subscription_dunning_events (id, merchant_id, subscription_id, invoice_id, stage, note) VALUES (?, ?, ?, ?, ?, ?)`, [id, merchantId, subscriptionId, invoiceId, event.stage, event.note]);
  return id;
}

async function queueNotification(env, payload = {}) {
  if (!payload.recipient) return null;
  const id = uid('ntf');
  await dbRun(env, `
    INSERT INTO notification_messages (id, merchant_id, order_id, customer_id, channel, template_key, recipient, subject, body_text, status, provider_ref, meta_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    payload.merchantId || '',
    payload.orderId || null,
    payload.customerId || null,
    payload.channel || 'email',
    payload.templateKey || '',
    payload.recipient || '',
    payload.subject || '',
    payload.bodyText || '',
    payload.status || 'queued',
    payload.providerRef || '',
    JSON.stringify(payload.meta || {})
  ]);
  return id;
}

async function queueCommerceNotifications(env, eventKey, { merchant = null, order = null, payment = null, fulfillment = null, returnRequest = null, customer = null } = {}) {
  if (!merchant || !order) return [];
  const notifications = buildCommerceNotifications({ merchant, order, payment, fulfillment, returnRequest, customer, eventKey });
  const ids = [];
  for (const item of notifications) {
    const id = await queueNotification(env, {
      merchantId: merchant.id,
      orderId: order.id,
      customerId: order.customerId || customer?.id || null,
      channel: item.channel,
      templateKey: item.templateKey,
      recipient: item.recipient,
      subject: item.subject,
      bodyText: item.bodyText,
      meta: item.meta
    });
    if (id) ids.push(id);
  }
  return ids;
}

async function markNotificationSent(env, notificationId, providerRef = '') {
  await dbRun(env, `
    UPDATE notification_messages
    SET status = 'sent', provider_ref = ?, sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP),
        attempt_count = attempt_count + 1, last_error = '', next_attempt_at = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [providerRef, notificationId]);
}

async function markNotificationFailed(env, row, error) {
  const state = nextQueueFailureState(row, error?.message || error, env);
  await dbRun(env, `
    UPDATE notification_messages
    SET status = ?, attempt_count = ?, last_error = ?, provider_ref = ?,
        next_attempt_at = CASE WHEN ? IS NULL THEN NULL ELSE datetime('now', ?) END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND merchant_id = ?
  `, [state.status, state.attemptCount, state.error, state.error.slice(0, 180), state.nextAttemptSql, state.nextAttemptSql, row.id, row.merchant_id]);
  return state;
}

async function dispatchQueuedNotifications(env, merchantId, limit = 25) {
  const rows = await dbAll(env, `
    SELECT * FROM notification_messages
    WHERE merchant_id = ?
      AND status IN ('queued', 'failed')
      AND ${dueQueuePredicate()}
    ORDER BY created_at ASC
    LIMIT ?
  `, [merchantId, limit]);
  const resendConnection = await getActiveProviderConnection(env, merchantId, 'resend');
  let sent = 0;
  let deadLettered = 0;
  const failures = [];
  for (const row of rows) {
    try {
      if (resendConnection && !missingProviderSecrets(env, 'resend').length) {
        const result = await executeNativeProviderDispatch(resendConnection, { message: notificationRecord(row) }, env);
        if (result.status !== 'executed') throw new Error(`Resend dispatch failed with HTTP ${result.httpStatus}`);
        await markNotificationSent(env, row.id, result.providerReference || `resend_${row.id}`);
      } else {
        throw new Error(notificationProviderMissingMessage());
      }
      sent += 1;
    } catch (error) {
      const state = await markNotificationFailed(env, row, error);
      if (state.deadLetter) deadLettered += 1;
      failures.push({ id: row.id, status: state.status, attemptCount: state.attemptCount, nextAttemptInMinutes: state.retryDelayMinutes, error: state.error });
    }
  }
  return queueRunSummary({ attempted: rows.length, succeeded: sent, failed: failures.length, deadLettered, failures });
}

async function updateTaxNexusForOrder(env, merchantId, order) {
  const shipping = order?.shippingAddress || {};
  const countryCode = String(shipping.countryCode || '').trim().toUpperCase();
  const stateCode = String(shipping.stateCode || '').trim().toUpperCase();
  if (!countryCode) return null;
  const rule = await dbFirst(env, `SELECT * FROM tax_nexus_rules WHERE merchant_id = ? AND country_code = ? AND state_code = ? AND active = 1 LIMIT 1`, [merchantId, countryCode, stateCode]);
  const current = await dbFirst(env, `SELECT * FROM tax_nexus_rollups WHERE merchant_id = ? AND country_code = ? AND state_code = ? LIMIT 1`, [merchantId, countryCode, stateCode]);
  const next = applyOrderToNexusRollup(current || { merchant_id: merchantId, country_code: countryCode, state_code: stateCode }, order, rule ? taxNexusRuleRecord(rule) : null);
  if (current) {
    await dbRun(env, `UPDATE tax_nexus_rollups SET order_count = ?, gross_cents = ?, threshold_met = ?, updated_at = CURRENT_TIMESTAMP WHERE merchant_id = ? AND country_code = ? AND state_code = ?`, [next.orderCount, next.grossCents, next.thresholdMet ? 1 : 0, merchantId, countryCode, stateCode]);
  } else {
    await dbRun(env, `INSERT INTO tax_nexus_rollups (merchant_id, country_code, state_code, order_count, gross_cents, threshold_met) VALUES (?, ?, ?, ?, ?, ?)`, [merchantId, countryCode, stateCode, next.orderCount, next.grossCents, next.thresholdMet ? 1 : 0]);
  }
  return await dbFirst(env, `SELECT * FROM tax_nexus_rollups WHERE merchant_id = ? AND country_code = ? AND state_code = ? LIMIT 1`, [merchantId, countryCode, stateCode]);
}

async function hashPassword(email, password) {
  return hashMerchantPassword(email, password);
}

async function verifyPassword(email, password, storedHash = '') {
  return verifyMerchantPassword(email, password, storedHash);
}

function parseStripeSignature(header = '') {
  return Object.fromEntries(String(header || '').split(',').map((part) => part.trim().split('=')).filter((pair) => pair.length === 2));
}

async function verifyStripeWebhookSignature(env, raw, header = '') {
  const parsed = parseStripeSignature(header);
  const timestamp = parsed.t;
  const signature = parsed.v1;
  const secret = env.STRIPE_WEBHOOK_SECRET || env.PAYMENT_WEBHOOK_SECRET || '';
  if (!timestamp || !signature || !secret) return false;
  const expected = await hmacHex(secret, `${timestamp}.${raw}`);
  return expected === signature;
}

async function guardAuthAttempt(request, env, kind, identity = '') {
  const ip = clientIp(request);
  const subject = authSubject(kind, identity || 'unknown', ip);
  const locked = await checkAuthLockout(env, subject);
  return { ip, subject, locked };
}

async function recordAuthFailure(env, guard, kind, identity = '', reason = 'invalid_credentials') {
  return recordAuthAttempt(env, { subject: guard.subject, kind, identity: String(identity || '').toLowerCase(), ip: guard.ip, success: false, reason });
}

async function recordAuthSuccess(env, guard, kind, identity = '') {
  return recordAuthAttempt(env, { subject: guard.subject, kind, identity: String(identity || '').toLowerCase(), ip: guard.ip, success: true, reason: 'success' });
}

async function createSession(env, { merchantId = null, email = '', role = 'merchant_owner', ttlMs = 1000 * 60 * 60 * 24 * 7 }) {
  const rawToken = await signToken(env.SESSION_SECRET, {
    sid: uid('sessraw'),
    role,
    merchantId,
    email,
    exp: Date.now() + ttlMs
  });
  const tokenHash = await sha256Hex(rawToken);
  const sessionId = uid('sess');
  await dbRun(env, `
    INSERT INTO sessions (id, merchant_id, email, role, token_hash, expires_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', '+7 day'))
  `, [sessionId, merchantId, email, role, tokenHash]);
  return rawToken;
}

async function getSession(request, env) {
  const cookies = parseCookie(request.headers.get('cookie') || '');
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  try {
    await verifyToken(env.SESSION_SECRET, token);
  } catch {
    return null;
  }
  const tokenHash = await sha256Hex(token);
  const row = await dbFirst(env, `
    SELECT sessions.id, sessions.merchant_id, sessions.email, sessions.role, sessions.expires_at,
           merchants.slug, merchants.brand_name
    FROM sessions
    LEFT JOIN merchants ON merchants.id = sessions.merchant_id
    WHERE sessions.token_hash = ?
      AND datetime(sessions.expires_at) > datetime('now')
    LIMIT 1
  `, [tokenHash]);
  if (!row) return null;
  const session = {
    id: row.id,
    merchantId: row.merchant_id,
    email: row.email,
    role: row.role,
    merchantSlug: row.slug || null,
    merchantName: row.brand_name || null,
    permissions: [],
    staffMemberId: ''
  };
  if (session.role === 'merchant_staff' && session.merchantId) {
    const staff = await dbFirst(env, `
      SELECT staff_members.*, staff_roles.name AS role_name, staff_roles.permissions_json AS role_permissions_json
      FROM staff_members
      LEFT JOIN staff_roles ON staff_roles.id = staff_members.role_id
      WHERE staff_members.merchant_id = ?
        AND lower(staff_members.email) = lower(?)
        AND staff_members.status = 'active'
      LIMIT 1
    `, [session.merchantId, session.email]);
    if (!staff) return null;
    const rolePermissions = (() => { try { return JSON.parse(staff.role_permissions_json || '[]'); } catch { return []; } })();
    const directPermissions = (() => { try { return JSON.parse(staff.permissions_json || '[]'); } catch { return []; } })();
    session.staffMemberId = staff.id || '';
    session.staffName = staff.name || '';
    session.permissions = [...new Set([...rolePermissions, ...directPermissions])];
  }
  return session;
}

function unauthorized(message = 'Unauthorized.') {
  return json({ error: message }, 401);
}

async function requireMerchantSession(request, env) {
  const session = await getSession(request, env);
  if (!session || !session.merchantId || !['merchant_owner', 'merchant_staff'].includes(session.role)) return { error: unauthorized() };
  return { session };
}

function isPublicApiPath(pathname, method) {
  if (pathname === '/api/health') return true;
  if (pathname === '/api/merchant/register') return true;
  if (pathname.startsWith('/api/auth/')) return true;
  if (pathname === '/api/staff/login' || pathname === '/api/staff/invitations/accept') return true;
  if (pathname.startsWith('/api/customers/')) return true;
  if (pathname.startsWith('/api/ae/')) return true;
  if (pathname.startsWith('/api/headless/')) return true;
  if (/^\/api\/store\/[^/]+\/bootstrap$/.test(pathname)) return true;
  if (/^\/api\/store\/[^/]+\/products\/[^/]+$/.test(pathname)) return true;
  if (pathname === '/api/orders/quote') return true;
  if (pathname === '/api/orders' && method === 'POST') return true;
  if (pathname.includes('/webhook')) return true;
  return false;
}

function requiredPermissionForRoute(pathname, method = 'GET') {
  const write = method !== 'GET';
  const map = [
    [/^\/api\/(products|product-variants|collections|pages|navigation|discount-codes|publish|import|sales-channels|channel-sync-jobs|seo-entries|redirect-rules|custom-domains)/, write ? 'catalog:write' : 'catalog:read'],
    [/^\/api\/(orders|returns|refunds|payments|carrier-profiles|shipping-profiles|checkouts|payment-disputes|fulfillment-sync|routex)/, write ? 'orders:write' : 'orders:read'],
    [/^\/api\/(inventory|inventory-transfers|suppliers|purchase-orders)/, write ? 'inventory:write' : 'inventory:read'],
    [/^\/api\/(customers|customer-segments|loyalty|product-reviews)/, write ? 'customers:write' : 'customers:read'],
    [/^\/api\/(pos)/, 'pos:operate'],
    [/^\/api\/(analytics)/, 'analytics:read'],
    [/^\/api\/(staff)/, write ? 'staff:write' : 'staff:read'],
    [/^\/api\/(provider-connections|webhooks|workflows|api-tokens|apps|app-installations|app-billing|audit-events|tax-nexus|subscription|subscription-plans|subscriptions)/, write ? 'settings:write' : 'settings:read']
  ];
  const hit = map.find(([regex]) => regex.test(pathname));
  if (hit) return hit[1];
  return write ? 'admin:write' : 'admin:read';
}

async function enforceStaffRoutePermission(request, env, url) {
  if (isPublicApiPath(url.pathname, request.method)) return null;
  const session = await getSession(request, env);
  if (!session || session.role !== 'merchant_staff') return null;
  const permission = requiredPermissionForRoute(url.pathname, request.method);
  if (hasStaffPermission({ effectivePermissions: session.permissions || [] }, permission)) return null;
  return json({ error: 'Staff permission denied.', requiredPermission: permission }, 403);
}

async function requireAeSession(request, env) {
  const session = await getSession(request, env);
  if (!session || session.role !== 'ae_admin') return { error: unauthorized() };
  return { session };
}

async function listMerchantProducts(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM products WHERE merchant_id = ? ORDER BY updated_at DESC`, [merchantId]);
  const products = rows.map(productRecord);
  const [variants, mediaRows] = await Promise.all([
    listMerchantProductVariants(env, merchantId),
    listProductMedia(env, merchantId)
  ]);
  return attachVariantsToProducts(products, variants).map((product) => ({
    ...product,
    media: mediaRows.filter((item) => item.productId === product.id)
  }));
}

async function listMerchantProductVariants(env, merchantId, productId = '') {
  const rows = await dbAll(env, `
    SELECT * FROM product_variants
    WHERE merchant_id = ? ${productId ? 'AND product_id = ?' : ''}
    ORDER BY product_id ASC, position ASC, created_at ASC
  `, productId ? [merchantId, productId] : [merchantId]);
  return rows.map(productVariantRecord);
}

async function getProductVariants(env, merchantId, productId) {
  return listMerchantProductVariants(env, merchantId, productId);
}

async function listProductMedia(env, merchantId, productId = '') {
  const rows = await dbAll(env, `
    SELECT * FROM product_media
    WHERE merchant_id = ? ${productId ? 'AND product_id = ?' : ''}
    ORDER BY product_id ASC, position ASC, created_at ASC
  `, productId ? [merchantId, productId] : [merchantId]);
  return rows.map(productMediaRecord);
}

async function getStorefrontProductDetail(env, merchantId, productRef) {
  const ref = String(productRef || '').trim();
  const row = await dbFirst(env, `
    SELECT * FROM products
    WHERE merchant_id = ? AND (id = ? OR slug = ?)
    LIMIT 1
  `, [merchantId, ref, ref]);
  return productDetailRecord(env, row);
}

async function listDonorVisualImports(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM donor_visual_imports WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 100`, [merchantId]);
  return rows.map(donorVisualImportRecord);
}

async function listFulfillmentSyncJobs(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM fulfillment_sync_jobs WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 200`, [merchantId]);
  return rows.map(fulfillmentSyncJobRecord);
}

async function listRoutexHandoffs(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM routex_handoffs WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 200`, [merchantId]);
  return rows.map(routexHandoffRecord);
}

async function listMerchantShipping(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM shipping_profiles WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  return rows.map(shippingRecord);
}

async function listMerchantTaxes(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM tax_profiles WHERE merchant_id = ? ORDER BY country_code, state_code`, [merchantId]);
  return rows.map(taxRecord);
}

async function listMerchantDiscountCodes(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM discount_codes WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  return rows.map(discountRecord);
}

async function listMerchantCollections(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM collections WHERE merchant_id = ? ORDER BY updated_at DESC`, [merchantId]);
  const assignments = await dbAll(env, `
    SELECT collection_products.collection_id, collection_products.product_id, collection_products.position
    FROM collection_products
    INNER JOIN collections ON collections.id = collection_products.collection_id
    WHERE collections.merchant_id = ?
    ORDER BY collection_products.position ASC
  `, [merchantId]);
  return rows.map((row) => collectionRecord(row, assignments.filter((entry) => entry.collection_id === row.id).map((entry) => entry.product_id)));
}

async function listMerchantPages(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM content_pages WHERE merchant_id = ? ORDER BY updated_at DESC`, [merchantId]);
  return rows.map(pageRecord);
}

async function listMerchantNavigation(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM navigation_links WHERE merchant_id = ? ORDER BY position ASC, created_at ASC`, [merchantId]);
  return rows.map(navLinkRecord);
}

async function listMerchantReturns(env, merchantId) {
  const rows = await dbAll(env, `
    SELECT order_returns.*, orders.order_number, orders.customer_name
    FROM order_returns
    INNER JOIN orders ON orders.id = order_returns.order_id
    WHERE order_returns.merchant_id = ?
    ORDER BY order_returns.created_at DESC
  `, [merchantId]);
  return rows.map((row) => ({ ...returnRecord(row), orderNumber: row.order_number || '', customerName: row.customer_name || '' }));
}

async function getReturnDetails(env, returnId, merchantId) {
  const row = await dbFirst(env, `
    SELECT order_returns.*, orders.order_number, orders.customer_name, orders.customer_email
    FROM order_returns
    INNER JOIN orders ON orders.id = order_returns.order_id
    WHERE order_returns.id = ? AND order_returns.merchant_id = ?
    LIMIT 1
  `, [returnId, merchantId]);
  if (!row) return null;
  return { ...returnRecord(row), orderNumber: row.order_number || '', customerName: row.customer_name || '', customerEmail: row.customer_email || '' };
}

async function listMerchantInventoryLocations(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM inventory_locations WHERE merchant_id = ? ORDER BY is_default DESC, priority ASC, created_at ASC`, [merchantId]);
  return rows.map(locationRecord);
}

async function ensureDefaultInventoryLocation(env, merchantId) {
  let row = await dbFirst(env, `SELECT * FROM inventory_locations WHERE merchant_id = ? AND is_default = 1 LIMIT 1`, [merchantId]);
  if (row) return locationRecord(row);
  row = await dbFirst(env, `SELECT * FROM inventory_locations WHERE merchant_id = ? ORDER BY priority ASC, created_at ASC LIMIT 1`, [merchantId]);
  if (row) {
    await dbRun(env, `UPDATE inventory_locations SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [row.id]);
    return locationRecord(await dbFirst(env, `SELECT * FROM inventory_locations WHERE id = ? LIMIT 1`, [row.id]));
  }
  const id = uid('loc');
  await dbRun(env, `
    INSERT INTO inventory_locations (id, merchant_id, name, code, priority, active, is_default)
    VALUES (?, ?, ?, ?, 0, 1, 1)
  `, [id, merchantId, 'Primary warehouse', 'PRIMARY']);
  return locationRecord(await dbFirst(env, `SELECT * FROM inventory_locations WHERE id = ? LIMIT 1`, [id]));
}

async function listMerchantInventoryLevels(env, merchantId, productId = '') {
  const sql = `
    SELECT inventory_levels.*,
           inventory_locations.name AS location_name,
           inventory_locations.code AS location_code,
           inventory_locations.priority,
           inventory_locations.active,
           inventory_locations.is_default,
           products.title AS product_title,
           products.sku AS product_sku
    FROM inventory_levels
    INNER JOIN inventory_locations ON inventory_locations.id = inventory_levels.location_id
    INNER JOIN products ON products.id = inventory_levels.product_id
    WHERE inventory_locations.merchant_id = ? ${productId ? 'AND inventory_levels.product_id = ?' : ''}
    ORDER BY inventory_locations.is_default DESC, inventory_locations.priority ASC, inventory_locations.created_at ASC
  `;
  const rows = await dbAll(env, sql, productId ? [merchantId, productId] : [merchantId]);
  return rows.map(inventoryLevelRecord);
}

async function syncProductInventoryTotal(env, merchantId, productId) {
  const row = await dbFirst(env, `
    SELECT COALESCE(SUM(inventory_levels.available), 0) AS total_available
    FROM inventory_levels
    INNER JOIN inventory_locations ON inventory_locations.id = inventory_levels.location_id
    WHERE inventory_levels.product_id = ? AND inventory_locations.merchant_id = ?
  `, [productId, merchantId]);
  const total = Number(row?.total_available || 0);
  await dbRun(env, `UPDATE products SET inventory_on_hand = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [total, productId, merchantId]);
  return total;
}

async function upsertInventoryLevel(env, merchantId, productId, locationId, nextAvailable) {
  const existing = await dbFirst(env, `SELECT available FROM inventory_levels WHERE location_id = ? AND product_id = ? LIMIT 1`, [locationId, productId]);
  if (existing) {
    await dbRun(env, `UPDATE inventory_levels SET available = ?, updated_at = CURRENT_TIMESTAMP WHERE location_id = ? AND product_id = ?`, [nextAvailable, locationId, productId]);
  } else {
    await dbRun(env, `INSERT INTO inventory_levels (location_id, product_id, available, reserved, inbound) VALUES (?, ?, ?, 0, 0)`, [locationId, productId, nextAvailable]);
  }
  return syncProductInventoryTotal(env, merchantId, productId);
}

async function seedDefaultInventoryForProduct(env, merchantId, productId, quantity) {
  const qty = Math.max(0, Number(quantity || 0));
  if (!qty) return 0;
  const levels = await listMerchantInventoryLevels(env, merchantId, productId);
  if (levels.length) return syncProductInventoryTotal(env, merchantId, productId);
  const location = await ensureDefaultInventoryLocation(env, merchantId);
  await upsertInventoryLevel(env, merchantId, productId, location.id, qty);
  return qty;
}

async function allocateProductInventory(env, merchantId, productId, quantity, orderId = null) {
  const product = await dbFirst(env, `SELECT * FROM products WHERE id = ? AND merchant_id = ? LIMIT 1`, [productId, merchantId]);
  if (!product) return { ok: false, error: 'Product not found.' };
  const requested = Math.max(1, Number(quantity || 1));
  const levels = await listMerchantInventoryLevels(env, merchantId, productId);
  if (!levels.length) {
    if (Number(product.track_inventory || 0) && Number(product.inventory_on_hand || 0) < requested) {
      return { ok: false, totalAvailable: Number(product.inventory_on_hand || 0), allocations: [] };
    }
    if (Number(product.track_inventory || 0)) {
      await dbRun(env, `UPDATE products SET inventory_on_hand = MAX(0, inventory_on_hand - ?), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [requested, productId, merchantId]);
    }
    return { ok: true, allocations: [] };
  }
  const plan = allocateInventoryDemand(levels, requested);
  if (!plan.ok) return plan;
  for (const allocation of plan.allocations) {
    const existing = levels.find((level) => level.locationId === allocation.locationId);
    const nextAvailable = Math.max(0, Number(existing?.available || 0) - allocation.quantity);
    await dbRun(env, `UPDATE inventory_levels SET available = ?, updated_at = CURRENT_TIMESTAMP WHERE location_id = ? AND product_id = ?`, [nextAvailable, allocation.locationId, productId]);
    if (orderId) {
      await dbRun(env, `INSERT INTO order_allocations (id, order_id, product_id, location_id, quantity) VALUES (?, ?, ?, ?, ?)`, [uid('alc'), orderId, productId, allocation.locationId, allocation.quantity]);
    }
  }
  await syncProductInventoryTotal(env, merchantId, productId);
  return plan;
}

async function restockProductInventory(env, merchantId, productId, quantity) {
  const qty = Math.max(0, Number(quantity || 0));
  if (!qty) return 0;
  const levels = await listMerchantInventoryLevels(env, merchantId, productId);
  if (!levels.length) {
    await dbRun(env, `UPDATE products SET inventory_on_hand = inventory_on_hand + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [qty, productId, merchantId]);
    return qty;
  }
  const defaultLevel = levels.find((level) => level.isDefault) || levels[0];
  await upsertInventoryLevel(env, merchantId, productId, defaultLevel.locationId, Number(defaultLevel.available || 0) + qty);
  return qty;
}

async function listMerchantInventoryAdjustments(env, merchantId) {
  const rows = await dbAll(env, `
    SELECT inventory_adjustments.*, inventory_locations.name AS location_name, products.title AS product_title
    FROM inventory_adjustments
    INNER JOIN inventory_locations ON inventory_locations.id = inventory_adjustments.location_id
    INNER JOIN products ON products.id = inventory_adjustments.product_id
    WHERE inventory_adjustments.merchant_id = ?
    ORDER BY inventory_adjustments.created_at DESC
    LIMIT 100
  `, [merchantId]);
  return rows.map(inventoryAdjustmentRecord);
}

async function applyInventoryAdjustment(env, merchantId, payload) {
  const product = await dbFirst(env, `SELECT * FROM products WHERE id = ? AND merchant_id = ? LIMIT 1`, [payload.productId, merchantId]);
  if (!product) throw new Error('Product not found for inventory adjustment.');
  let location = null;
  if (payload.locationId) {
    location = await dbFirst(env, `SELECT * FROM inventory_locations WHERE id = ? AND merchant_id = ? LIMIT 1`, [payload.locationId, merchantId]);
  }
  if (!location) {
    location = await ensureDefaultInventoryLocation(env, merchantId);
  } else {
    location = locationRecord(location);
  }
  const existing = await dbFirst(env, `SELECT available FROM inventory_levels WHERE location_id = ? AND product_id = ? LIMIT 1`, [location.id, payload.productId]);
  const beforeAvailable = Number(existing?.available || 0);
  let nextAvailable = beforeAvailable;
  if (payload.kind === 'set') nextAvailable = Math.max(0, payload.delta);
  else if (payload.kind === 'remove') nextAvailable = Math.max(0, beforeAvailable - Math.abs(payload.delta));
  else nextAvailable = Math.max(0, beforeAvailable + payload.delta);
  await upsertInventoryLevel(env, merchantId, payload.productId, location.id, nextAvailable);
  const id = uid('iadj');
  await dbRun(env, `
    INSERT INTO inventory_adjustments (id, merchant_id, location_id, product_id, kind, delta, before_available, after_available, note, reference)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, merchantId, location.id, payload.productId, payload.kind, payload.delta, beforeAvailable, nextAvailable, payload.note, payload.reference]);
  return inventoryAdjustmentRecord(await dbFirst(env, `SELECT * FROM inventory_adjustments WHERE id = ? LIMIT 1`, [id]));
}

async function maybeRestockReturn(env, merchantId, orderReturn) {
  if (!shouldRestockReturn(orderReturn)) return false;
  for (const item of orderReturn.items || []) {
    const quantity = Math.max(0, Number(item.quantity || 0) || 0);
    if (!item.productId || !quantity) continue;
    await restockProductInventory(env, merchantId, item.productId, quantity);
  }
  await dbRun(env, `UPDATE order_returns SET restocked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [orderReturn.id, merchantId]);
  return true;
}

async function upsertImportedProducts(env, merchantId, products, sourceType = 'import') {
  const results = [];
  for (const incoming of products) {
    const slug = slugify(incoming.slug || incoming.title || incoming.sku || uid('product'));
    const existing = await dbFirst(env, `SELECT id FROM products WHERE merchant_id = ? AND slug = ? LIMIT 1`, [merchantId, slug]);
    const payload = [
      merchantId,
      slug,
      incoming.title || 'Untitled product',
      incoming.shortDescription || '',
      cleanHtml(incoming.descriptionHtml || ''),
      Number(incoming.priceCents || 0),
      Number(incoming.compareAtCents || 0),
      incoming.sku || '',
      Number(incoming.inventoryOnHand || 0),
      incoming.trackInventory ? 1 : 0,
      incoming.status || 'active',
      incoming.heroImageUrl || '',
      sourceType || incoming.sourceType || '',
      incoming.sourceRef || ''
    ];
    if (existing) {
      await dbRun(env, `
        UPDATE products
        SET title = ?, short_description = ?, description_html = ?, price_cents = ?, compare_at_cents = ?,
            sku = ?, inventory_on_hand = ?, track_inventory = ?, status = ?, hero_image_url = ?,
            source_type = ?, source_ref = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        payload[2], payload[3], payload[4], payload[5], payload[6], payload[7], payload[8], payload[9], payload[10], payload[11], payload[12], payload[13], existing.id
      ]);
      results.push({ id: existing.id, slug, action: 'updated' });
    } else {
      const id = uid('prd');
      await dbRun(env, `
        INSERT INTO products (
          id, merchant_id, slug, title, short_description, description_html, price_cents, compare_at_cents,
          sku, inventory_on_hand, track_inventory, status, hero_image_url, source_type, source_ref
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, ...payload]);
      results.push({ id, slug, action: 'created' });
    }
  }
  return results;
}

async function buildAndPersistSnapshot(env, merchantId) {
  const merchant = merchantRecord(await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [merchantId]));
  if (!merchant) throw new Error('Merchant not found.');
  const products = await listMerchantProducts(env, merchantId);
  const shippingProfiles = await listMerchantShipping(env, merchantId);
  const taxProfiles = await listMerchantTaxes(env, merchantId);
  const discountCodes = await listMerchantDiscountCodes(env, merchantId);
  const collections = await listMerchantCollections(env, merchantId);
  const pages = await listMerchantPages(env, merchantId);
  const navigation = await listMerchantNavigation(env, merchantId);
  const snapshot = buildStorefrontSnapshot(merchant, products, shippingProfiles, taxProfiles, discountCodes, collections, pages, navigation);
  const snapshotId = uid('snap');
  await dbRun(env, `INSERT INTO storefront_snapshots (id, merchant_id, slug, snapshot_json, published_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`, [snapshotId, merchantId, merchant.slug, JSON.stringify(snapshot)]);
  return { snapshotId, snapshot };
}

async function createImportJob(env, merchantId, kind, sourceRef, status, log = {}) {
  const id = uid('imp');
  await dbRun(env, `INSERT INTO import_jobs (id, merchant_id, kind, source_ref, status, log_json) VALUES (?, ?, ?, ?, ?, ?)` , [id, merchantId, kind, sourceRef || '', status, JSON.stringify(log || {})]);
  return id;
}

async function listMerchants(env) {
  const rows = await dbAll(env, `SELECT * FROM merchants ORDER BY created_at DESC`);
  return rows.map(merchantRecord);
}

async function listAeAgents(env) {
  return dbAll(env, `SELECT * FROM ae_agents ORDER BY updated_at DESC`);
}

async function listAeBookings(env, agentId = '') {
  if (agentId) return dbAll(env, `SELECT * FROM ae_bookings WHERE agent_id = ? ORDER BY booking_date ASC`, [agentId]);
  return dbAll(env, `SELECT * FROM ae_bookings ORDER BY booking_date ASC`);
}

function publicBaseUrl(env, requestUrl) {
  return env.PUBLIC_BASE_URL?.trim() || `${requestUrl.protocol}//${requestUrl.host}`;
}

async function publicOrderAccessToken(env, merchantSlug, orderId) {
  return buildPublicOrderAccessToken(env.PUBLIC_ORDER_STATUS_SECRET || env.SESSION_SECRET, merchantSlug, orderId);
}

function providerRuntimeMatrix(env, connections = []) {
  const rows = (Array.isArray(connections) ? connections : []).map((connection) => {
    const missing = missingProviderSecrets(env, connection.provider);
    return {
      id: connection.id,
      provider: connection.provider,
      name: connection.name,
      active: Boolean(connection.active),
      missingSecrets: missing,
      ready: connection.active ? missing.length === 0 : true
    };
  });
  return {
    ok: rows.every((row) => row.ready),
    providers: rows,
    blockers: rows.filter((row) => !row.ready).map((row) => `${row.provider}_secrets_missing`)
  };
}

function normalizeMerchantUpdate(body = {}) {
  return {
    brandName: String(body.brandName || '').trim(),
    accentColor: String(body.accentColor || '#7c3aed').trim(),
    surfaceColor: String(body.surfaceColor || '#111827').trim(),
    backgroundColor: String(body.backgroundColor || '#050816').trim(),
    textColor: String(body.textColor || '#f8fafc').trim(),
    heroTitle: String(body.heroTitle || '').trim(),
    heroTagline: String(body.heroTagline || '').trim(),
    checkoutNote: String(body.checkoutNote || '').trim(),
    currency: String(body.currency || 'USD').trim().toUpperCase()
  };
}

async function appendOrderEvent(env, orderId, event) {
  const normalized = buildOrderEvent(event.kind, event, event.detail || '');
  const id = uid('evt');
  await dbRun(env, `
    INSERT INTO order_events (id, order_id, kind, summary, detail, status, payment_status, fulfillment_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, orderId, normalized.kind, normalized.summary, normalized.detail, normalized.status, normalized.paymentStatus, normalized.fulfillmentStatus]);
  return id;
}

async function getOrderDetails(env, orderId, merchantId) {
  const row = await dbFirst(env, `SELECT * FROM orders WHERE id = ? AND merchant_id = ? LIMIT 1`, [orderId, merchantId]);
  if (!row) return null;
  const [events, fulfillments, returns, allocations, payments, notifications, shippingLabels, riskAssessments, fulfillmentSyncJobs, routexHandoffs] = await Promise.all([
    dbAll(env, `SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at DESC`, [orderId]),
    dbAll(env, `SELECT * FROM fulfillments WHERE order_id = ? ORDER BY created_at DESC`, [orderId]),
    dbAll(env, `SELECT * FROM order_returns WHERE order_id = ? AND merchant_id = ? ORDER BY created_at DESC`, [orderId, merchantId]),
    dbAll(env, `
      SELECT order_allocations.*, inventory_locations.name AS location_name, inventory_locations.code AS location_code
      FROM order_allocations
      LEFT JOIN inventory_locations ON inventory_locations.id = order_allocations.location_id
      WHERE order_allocations.order_id = ?
      ORDER BY order_allocations.created_at ASC
    `, [orderId]),
    dbAll(env, `SELECT * FROM payment_transactions WHERE order_id = ? ORDER BY created_at DESC`, [orderId]),
    dbAll(env, `SELECT * FROM notification_messages WHERE order_id = ? ORDER BY created_at DESC`, [orderId]),
    dbAll(env, `SELECT * FROM shipping_labels WHERE order_id = ? AND merchant_id = ? ORDER BY created_at DESC`, [orderId, merchantId]),
    dbAll(env, `SELECT * FROM risk_assessments WHERE order_id = ? AND merchant_id = ? ORDER BY created_at DESC`, [orderId, merchantId]),
    dbAll(env, `SELECT * FROM fulfillment_sync_jobs WHERE order_id = ? AND merchant_id = ? ORDER BY created_at DESC`, [orderId, merchantId]),
    dbAll(env, `SELECT * FROM routex_handoffs WHERE order_id = ? AND merchant_id = ? ORDER BY created_at DESC`, [orderId, merchantId])
  ]);
  return {
    ...orderSummary(row),
    events: events.map(orderEventRecord),
    fulfillments: fulfillments.map(fulfillmentRecord),
    returns: returns.map(returnRecord),
    allocations: allocations.map(orderAllocationRecord),
    payments: payments.map(paymentTransactionRecord),
    notifications: notifications.map(notificationRecord),
    shippingLabels: shippingLabels.map(shippingLabelRecord),
    riskAssessments: riskAssessments.map(riskAssessmentRecord),
    fulfillmentSyncJobs: fulfillmentSyncJobs.map(fulfillmentSyncJobRecord),
    routexHandoffs: routexHandoffs.map(routexHandoffRecord)
  };
}


async function listWarehouseBins(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM warehouse_bins WHERE merchant_id = ? ORDER BY active DESC, code ASC`, [merchantId]);
  return rows.map(warehouseBinRecord);
}

async function listWarehouseBinInventory(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM warehouse_bin_inventory WHERE merchant_id = ? ORDER BY updated_at DESC`, [merchantId]);
  return rows.map(warehouseBinInventoryRecord);
}

async function listWarehousePickLists(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM warehouse_pick_lists WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  return rows.map(pickListRecord);
}

async function listWarehouseWorkOrders(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM warehouse_work_orders WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  return rows.map((row) => ({
    id: row.id,
    merchantId: row.merchant_id,
    orderId: row.order_id,
    locationId: row.location_id || '',
    priority: row.priority || 'standard',
    status: row.status || 'created',
    dueAt: row.due_at || '',
    externalRef: row.external_ref || '',
    httpStatus: Number(row.http_status || 0),
    request: JSON.parse(row.request_json || '{}'),
    response: JSON.parse(row.response_json || '{}'),
    error: row.error || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  }));
}

async function listShipmentTrackingEvents(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM shipment_tracking_events WHERE merchant_id = ? ORDER BY event_time DESC, created_at DESC`, [merchantId]);
  return rows.map(shipmentTrackingEventRecord);
}

async function listRouteDrivers(env, merchantId) {
  return (await dbAll(env, `SELECT * FROM route_drivers WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId])).map(routeDriverRecord);
}

async function listRouteVehicles(env, merchantId) {
  return (await dbAll(env, `SELECT * FROM route_vehicles WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId])).map(routeVehicleRecord);
}

async function listRoutePlans(env, merchantId) {
  return (await dbAll(env, `SELECT * FROM route_plans WHERE merchant_id = ? ORDER BY route_date DESC, created_at DESC`, [merchantId])).map(routePlanRecord);
}

async function listRoutePlanEvents(env, merchantId, routePlanId = '') {
  const rows = routePlanId
    ? await dbAll(env, `SELECT * FROM route_plan_events WHERE merchant_id = ? AND route_plan_id = ? ORDER BY created_at DESC`, [merchantId, routePlanId])
    : await dbAll(env, `SELECT * FROM route_plan_events WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  return rows.map(routePlanEventRecord);
}

async function listReturnPickups(env, merchantId) {
  return (await dbAll(env, `SELECT * FROM return_pickups WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId])).map(returnPickupRecord);
}

async function listPosTerminalPayments(env, merchantId) {
  return (await dbAll(env, `SELECT * FROM pos_terminal_payments WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId])).map(terminalPaymentRecord);
}

async function listPosCashDrawerEvents(env, merchantId) {
  return (await dbAll(env, `SELECT * FROM pos_cash_drawer_events WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId])).map(cashDrawerEventRecord);
}

async function listPosReceiptPrintJobs(env, merchantId) {
  return (await dbAll(env, `SELECT * FROM pos_receipt_print_jobs WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId])).map((row) => ({
    id: row.id,
    merchantId: row.merchant_id,
    orderId: row.order_id || '',
    cartId: row.cart_id || '',
    status: row.status || 'queued',
    endpointUrl: row.endpoint_url || '',
    result: JSON.parse(row.result_json || '{}'),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  }));
}

async function listPosReconciliations(env, merchantId) {
  return (await dbAll(env, `SELECT * FROM pos_endofday_reconciliations WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId])).map((row) => ({
    id: row.id,
    merchantId: row.merchant_id,
    businessDate: row.business_date,
    report: JSON.parse(row.report_json || '{}'),
    status: row.status || 'closed',
    createdAt: row.created_at || ''
  }));
}

async function listPosOfflineSyncEvents(env, merchantId) {
  return (await dbAll(env, `SELECT * FROM pos_offline_sync_events WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId])).map(offlineSyncEventRecord);
}

async function listTaxFilingJobs(env, merchantId) {
  return (await dbAll(env, `SELECT * FROM tax_filing_jobs WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId])).map((row) => ({
    id: row.id,
    merchantId: row.merchant_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status || 'submitted',
    payload: JSON.parse(row.payload_json || '{}'),
    providerResult: JSON.parse(row.provider_result_json || '{}'),
    createdAt: row.created_at || ''
  }));
}

async function listFraudScreeningJobs(env, merchantId) {
  return (await dbAll(env, `SELECT * FROM fraud_screening_jobs WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId])).map((row) => ({
    id: row.id,
    merchantId: row.merchant_id,
    orderId: row.order_id,
    status: row.status || 'submitted',
    payload: JSON.parse(row.payload_json || '{}'),
    providerResult: JSON.parse(row.provider_result_json || '{}'),
    createdAt: row.created_at || ''
  }));
}

async function listPciControls(env, merchantId) {
  return (await dbAll(env, `SELECT * FROM pci_controls WHERE merchant_id = ? ORDER BY updated_at DESC, control_key ASC`, [merchantId])).map(pciControlRecord);
}

async function listDeveloperAccounts(env, merchantId) {
  return (await dbAll(env, `SELECT * FROM app_developer_accounts WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId])).map(developerAccountRecord);
}

async function listAppReviewSubmissions(env, merchantId) {
  return (await dbAll(env, `SELECT * FROM app_review_submissions WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId])).map(appReviewSubmissionRecord);
}

async function listAppRevenueSettlements(env, merchantId) {
  return (await dbAll(env, `SELECT * FROM app_revenue_settlements WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId])).map(appSettlementRecord);
}

async function createHostedOrderPaymentSession(env, merchant, order, body = {}, requestUrl) {
  const payload = normalizePaymentSessionInput(body || {}, order);
  const paymentPolicy = enforcePaymentProviderPolicy(payload.provider, env);
  if (!paymentPolicy.ok) {
    const error = new Error(paymentPolicy.message);
    error.code = paymentPolicy.code || 'PAYMENT_PROVIDER_POLICY_BLOCKED';
    error.blockers = paymentPolicy.blockers || [];
    error.status = 409;
    throw error;
  }
  const transactionId = uid('pay');
  const checkoutToken = uid('chk');
  let providerReference = '';
  let externalCheckoutUrl = '';
  let providerDispatch = null;
  if (['stripe', 'paypal'].includes(payload.provider)) {
    const connection = await resolveProviderConnection(env, merchant.id, payload.provider, payload.providerConnectionId);
    if (!connection) {
      const error = new Error(`No active ${payload.provider} provider connection found for this merchant.`);
      error.code = 'PAYMENT_PROVIDER_CONNECTION_MISSING';
      error.status = 409;
      throw error;
    }
    providerDispatch = await executeNativeProviderDispatch(connection, {
      payment: { amountCents: payload.amountCents, currency: payload.currency, returnUrl: payload.returnUrl, cancelUrl: payload.cancelUrl },
      context: { orderNumber: order.orderNumber, origin: buildAbsoluteOrigin(requestUrl), orderId: order.id, merchantSlug: merchant.slug }
    }, env);
    if (providerDispatch.status !== 'executed' || !providerDispatch.checkoutUrl) {
      const error = new Error(`${payload.provider} checkout failed.`);
      error.code = 'PAYMENT_PROVIDER_FAILED';
      error.status = 502;
      error.providerDispatch = providerDispatch;
      throw error;
    }
    providerReference = providerDispatch.providerReference || '';
    externalCheckoutUrl = providerDispatch.checkoutUrl || '';
  }
  await dbRun(env, `
    INSERT INTO payment_transactions (id, merchant_id, order_id, provider, provider_reference, checkout_token, status, amount_cents, currency, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [transactionId, merchant.id, order.id, payload.provider, providerReference, checkoutToken, 'pending', payload.amountCents, payload.currency, JSON.stringify({ ...(payload.metadata || {}), providerConnectionId: payload.providerConnectionId || '', providerDispatch })]);
  const session = buildHostedPaymentSession({
    transactionId,
    checkoutToken,
    provider: payload.provider,
    amountCents: payload.amountCents,
    currency: payload.currency,
    merchantSlug: merchant.slug,
    orderNumber: order.orderNumber,
    origin: buildAbsoluteOrigin(requestUrl),
    returnUrl: payload.returnUrl,
    cancelUrl: payload.cancelUrl,
    externalCheckoutUrl,
    providerReference
  });
  await appendOrderEvent(env, order.id, {
    ...buildPaymentTimelineEvent({ orderNumber: order.orderNumber, provider: payload.provider, status: 'pending', amountCents: payload.amountCents, currency: payload.currency }),
    status: order.status,
    paymentStatus: order.paymentStatus
  });
  const transaction = paymentTransactionRecord(await dbFirst(env, `SELECT * FROM payment_transactions WHERE id = ? LIMIT 1`, [transactionId]));
  return { session, transaction, providerDispatch, payload };
}


async function syncOrderAfterPaymentWebhook(env, existing, incoming, next) {
  const order = await dbFirst(env, `SELECT * FROM orders WHERE id = ? LIMIT 1`, [existing.order_id]);
  if (!order) return { order: null, merchant: null, payment: null };
  const previousOrderPaymentStatus = order.payment_status || '';
  await dbRun(env, `UPDATE orders SET payment_status = ?, payment_reference = ? WHERE id = ?`, [next.orderPaymentStatus, incoming.providerReference || existing.provider_reference || '', order.id]);
  await appendOrderEvent(env, order.id, {
    ...buildPaymentTimelineEvent({ orderNumber: order.order_number, provider: existing.provider, status: next.status, amountCents: next.amountCents || existing.amount_cents || 0, currency: next.currency || existing.currency || 'USD', providerReference: incoming.providerReference || existing.provider_reference || '' }),
    status: order.status,
    paymentStatus: next.orderPaymentStatus
  });
  const refreshedOrder = await getOrderDetails(env, order.id, existing.merchant_id);
  const merchant = await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [existing.merchant_id]);
  const customerRow = refreshedOrder?.customerId ? await getCustomerById(env, refreshedOrder.customerId) : null;
  if (next.orderPaymentStatus === 'paid' && previousOrderPaymentStatus !== 'paid') {
    await queueCommerceNotifications(env, 'payment_paid', {
      merchant: merchantRecord(merchant),
      order: refreshedOrder,
      payment: paymentTransactionRecord(await dbFirst(env, `SELECT * FROM payment_transactions WHERE id = ? LIMIT 1`, [existing.id])),
      customer: customerRow ? { id: customerRow.id, email: customerRow.email, phone: customerRow.phone, firstName: customerRow.first_name, lastName: customerRow.last_name } : null
    });
  }
  if (['failed', 'voided'].includes(next.status) && !['pending_provider_failure', 'voided', 'refunded'].includes(previousOrderPaymentStatus)) {
    await releaseOrderInventoryAfterPaymentFailure(env, order.merchant_id, refreshedOrder);
  }
  return { order: refreshedOrder, merchant, payment: paymentTransactionRecord(await dbFirst(env, `SELECT * FROM payment_transactions WHERE id = ? LIMIT 1`, [existing.id])) };
}

async function releaseOrderInventoryAfterPaymentFailure(env, merchantId, order) {
  if (!order) return { released: false, itemsReleased: 0 };
  let itemsReleased = 0;
  for (const item of order.items || []) {
    const quantity = Math.max(0, Number(item.quantity || 0) || 0);
    if (!quantity) continue;
    if (item.variantId) {
      await dbRun(env, `UPDATE product_variants SET inventory_on_hand = inventory_on_hand + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [quantity, item.variantId, merchantId]);
    }
    await restockProductInventory(env, merchantId, item.productId, quantity);
    itemsReleased += quantity;
  }
  await dbRun(env, `DELETE FROM order_allocations WHERE order_id = ?`, [order.id]);
  await appendOrderEvent(env, order.id, {
    kind: 'inventory_released',
    summary: `Inventory released for ${order.orderNumber}`,
    status: order.status,
    paymentStatus: order.paymentStatus,
    detail: `Released ${itemsReleased} unit(s) after payment failure or void.`
  });
  return { released: itemsReleased > 0, itemsReleased };
}

async function listMerchantCheckouts(env, merchantId, status = '') {
  const rows = await dbAll(env, `
    SELECT * FROM checkout_sessions
    WHERE merchant_id = ? ${status ? 'AND status = ?' : ''}
    ORDER BY updated_at DESC
    LIMIT 200
  `, status ? [merchantId, status] : [merchantId]);
  return rows.map(checkoutSessionRecord).map((session) => ({ ...session, status: classifyCheckout(session) }));
}

async function getCheckoutSession(env, merchantId, checkoutId) {
  const row = await dbFirst(env, `SELECT * FROM checkout_sessions WHERE merchant_id = ? AND id = ? LIMIT 1`, [merchantId, checkoutId]);
  return row ? { ...checkoutSessionRecord(row), status: classifyCheckout(checkoutSessionRecord(row)) } : null;
}

async function listMerchantGiftCards(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM gift_cards WHERE merchant_id = ? ORDER BY updated_at DESC`, [merchantId]);
  return rows.map(giftCardRecord);
}

async function listGiftCardLedger(env, merchantId, giftCardId = '') {
  const rows = await dbAll(env, `
    SELECT * FROM gift_card_ledger
    WHERE merchant_id = ? ${giftCardId ? 'AND gift_card_id = ?' : ''}
    ORDER BY created_at DESC
  `, giftCardId ? [merchantId, giftCardId] : [merchantId]);
  return rows.map(giftCardLedgerRecord);
}

async function findGiftCardByCode(env, merchantId, code = '') {
  if (!code) return null;
  const codeHash = await hashGiftCardCode(env.GIFT_CARD_SECRET || env.SESSION_SECRET || '', code);
  const row = await dbFirst(env, `SELECT * FROM gift_cards WHERE merchant_id = ? AND code_hash = ? LIMIT 1`, [merchantId, codeHash]);
  return row ? giftCardRecord(row) : null;
}

async function redeemGiftCardForOrder(env, merchantId, orderId, code = '', requestedCents = 0) {
  const codeHash = await hashGiftCardCode(env.GIFT_CARD_SECRET || env.SESSION_SECRET || '', code);
  const row = await dbFirst(env, `SELECT * FROM gift_cards WHERE merchant_id = ? AND code_hash = ? LIMIT 1`, [merchantId, codeHash]);
  if (!row) return { appliedCents: 0, reason: 'not_found' };
  const preview = previewGiftCardRedemption({ ...giftCardRecord(row), active: Number(row.active || 0) === 1 }, requestedCents);
  if (!preview.appliedCents) return preview;
  const nextBalance = Math.max(0, Number(row.balance_cents || 0) - preview.appliedCents);
  await dbRun(env, `UPDATE gift_cards SET balance_cents = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [nextBalance, row.id, merchantId]);
  await dbRun(env, `INSERT INTO gift_card_ledger (id, merchant_id, gift_card_id, order_id, kind, amount_cents, balance_after_cents, note) VALUES (?, ?, ?, ?, 'redeemed', ?, ?, ?)`, [uid('gcl'), merchantId, row.id, orderId, -preview.appliedCents, nextBalance, `Redeemed on order ${orderId}`]);
  return { ...preview, giftCardId: row.id, codeLast4: row.code_last4 || String(code).slice(-4).toUpperCase() };
}

async function listRiskAssessments(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM risk_assessments WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 200`, [merchantId]);
  return rows.map(riskAssessmentRecord);
}

async function persistRiskAssessment(env, merchantId, orderId, order, signals = {}) {
  const scored = scoreOrderRisk(order, signals);
  const id = uid('risk');
  await dbRun(env, `INSERT INTO risk_assessments (id, merchant_id, order_id, score, decision, reasons_json, signals_json) VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, merchantId, orderId || null, scored.score, scored.decision, JSON.stringify(scored.reasons), JSON.stringify(scored.signals)]);
  return riskAssessmentRecord(await dbFirst(env, `SELECT * FROM risk_assessments WHERE id = ? LIMIT 1`, [id]));
}

async function listWebhookEndpoints(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM webhook_endpoints WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId]);
  return rows.map(webhookEndpointRecord);
}

async function listWebhookDeliveries(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM webhook_deliveries WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 200`, [merchantId]);
  return rows.map(webhookDeliveryRecord);
}

async function queueWebhookEvent(env, merchantId, eventType, payload = {}) {
  const endpoints = await dbAll(env, `SELECT * FROM webhook_endpoints WHERE merchant_id = ? AND active = 1`, [merchantId]);
  const deliveryIds = [];
  for (const endpoint of endpoints) {
    const events = (() => { try { return JSON.parse(endpoint.events_json || '[]'); } catch { return []; } })();
    if (!events.includes(eventType) && !events.includes('*')) continue;
    const id = uid('whd');
    await dbRun(env, `INSERT INTO webhook_deliveries (id, merchant_id, endpoint_id, event_type, status, payload_json) VALUES (?, ?, ?, ?, 'queued', ?)`, [id, merchantId, endpoint.id, eventType, JSON.stringify({ eventType, merchantId, createdAt: new Date().toISOString(), data: payload })]);
    deliveryIds.push(id);
  }
  return deliveryIds;
}

async function resolveWebhookSecret(env, row) {
  if (env.WEBHOOK_SIGNING_SECRET) return env.WEBHOOK_SIGNING_SECRET;
  if (row.secret_cipher_json) {
    const decrypted = await decryptProviderConfig(env, row.secret_cipher_json);
    if (decrypted.secret) return decrypted.secret;
  }
  return '';
}

async function markWebhookDeliveryFailure(env, row, error, httpStatus = 0) {
  const state = nextQueueFailureState(row, error?.message || error, env);
  await dbRun(env, `
    UPDATE webhook_deliveries
    SET status = ?, attempt_count = ?, http_status = ?, response_text = ?,
        next_attempt_at = CASE WHEN ? IS NULL THEN NULL ELSE datetime('now', ?) END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND merchant_id = ?
  `, [state.status, state.attemptCount, httpStatus, state.error, state.nextAttemptSql, state.nextAttemptSql, row.id, row.merchant_id]);
  return state;
}

async function dispatchWebhookDeliveries(env, merchantId, limit = 25) {
  const rows = await dbAll(env, `
    SELECT webhook_deliveries.*, webhook_endpoints.url, webhook_endpoints.headers_json, webhook_endpoints.secret_preview, webhook_endpoints.secret_cipher_json
    FROM webhook_deliveries
    INNER JOIN webhook_endpoints ON webhook_endpoints.id = webhook_deliveries.endpoint_id
    WHERE webhook_deliveries.merchant_id = ?
      AND webhook_deliveries.status IN ('queued', 'failed')
      AND ${dueQueuePredicate('webhook_deliveries')}
    ORDER BY webhook_deliveries.created_at ASC
    LIMIT ?
  `, [merchantId, limit]);
  let delivered = 0;
  let deadLettered = 0;
  const failures = [];
  for (const row of rows) {
    try {
      const secret = await resolveWebhookSecret(env, row);
      if (!secret) throw new Error('Webhook endpoint has no retrievable signing secret; create a new endpoint so the encrypted secret can be stored.');
      const endpoint = {
        id: row.endpoint_id,
        url: row.url,
        headers: (() => { try { return JSON.parse(row.headers_json || '{}'); } catch { return {}; } })(),
        secret
      };
      const delivery = webhookDeliveryRecord(row);
      const spec = await buildSignedWebhookRequest(endpoint, delivery);
      const res = await fetch(spec.url, { method: spec.method, headers: spec.headers, body: spec.body });
      const responseText = (await res.text()).slice(0, 500);
      if (!res.ok) {
        const state = await markWebhookDeliveryFailure(env, row, `Webhook HTTP ${res.status}: ${responseText}`, res.status);
        if (state.deadLetter) deadLettered += 1;
        failures.push({ id: row.id, status: state.status, httpStatus: res.status, attemptCount: state.attemptCount, nextAttemptInMinutes: state.retryDelayMinutes });
        continue;
      }
      await dbRun(env, `
        UPDATE webhook_deliveries
        SET status = 'delivered', attempt_count = attempt_count + 1, http_status = ?, response_text = ?,
            next_attempt_at = NULL, delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND merchant_id = ?
      `, [res.status, responseText, row.id, merchantId]);
      delivered += 1;
    } catch (error) {
      const state = await markWebhookDeliveryFailure(env, row, error);
      if (state.deadLetter) deadLettered += 1;
      failures.push({ id: row.id, status: state.status, attemptCount: state.attemptCount, nextAttemptInMinutes: state.retryDelayMinutes, error: state.error });
    }
  }
  return queueRunSummary({ attempted: rows.length, succeeded: delivered, failed: failures.length, deadLettered, failures });
}

async function audit(env, merchantId, eventType, summary, targetType = '', targetId = '', meta = {}, actor = {}) {
  await dbRun(env, `INSERT INTO audit_events (id, merchant_id, actor_role, actor_ref, event_type, summary, target_type, target_id, meta_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [uid('aud'), merchantId || null, actor.role || 'system', actor.email || actor.id || '', eventType, summary || eventType, targetType, targetId, JSON.stringify(meta || {})]);
}

async function listAuditEvents(env, merchantId) {
  return dbAll(env, `SELECT * FROM audit_events WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 200`, [merchantId]);
}


async function listMerchantBundles(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM product_bundles WHERE merchant_id = ? ORDER BY updated_at DESC`, [merchantId]);
  const itemRows = await dbAll(env, `
    SELECT product_bundle_items.*, products.title AS product_title, products.price_cents AS unit_price_cents, products.inventory_on_hand,
           product_variants.title AS variant_title, product_variants.sku AS variant_sku
    FROM product_bundle_items
    LEFT JOIN products ON products.id = product_bundle_items.product_id
    LEFT JOIN product_variants ON product_variants.id = product_bundle_items.variant_id
    WHERE product_bundle_items.merchant_id = ?
    ORDER BY product_bundle_items.position ASC, product_bundle_items.created_at ASC
  `, [merchantId]);
  return rows.map((row) => bundleRecord(row, itemRows.filter((item) => item.bundle_id === row.id)));
}

async function getMerchantBundle(env, merchantId, bundleId) {
  const row = await dbFirst(env, `SELECT * FROM product_bundles WHERE id = ? AND merchant_id = ? LIMIT 1`, [bundleId, merchantId]);
  if (!row) return null;
  const itemRows = await dbAll(env, `
    SELECT product_bundle_items.*, products.title AS product_title, products.price_cents AS unit_price_cents, products.inventory_on_hand
    FROM product_bundle_items
    LEFT JOIN products ON products.id = product_bundle_items.product_id
    WHERE product_bundle_items.bundle_id = ? AND product_bundle_items.merchant_id = ?
    ORDER BY product_bundle_items.position ASC, product_bundle_items.created_at ASC
  `, [bundleId, merchantId]);
  return bundleRecord(row, itemRows);
}

async function listMerchantSuppliers(env, merchantId) {
  return (await dbAll(env, `SELECT * FROM suppliers WHERE merchant_id = ? ORDER BY active DESC, updated_at DESC`, [merchantId])).map(supplierRecord);
}

async function listMerchantPurchaseOrders(env, merchantId) {
  const rows = await dbAll(env, `
    SELECT purchase_orders.*, suppliers.name AS supplier_name
    FROM purchase_orders
    LEFT JOIN suppliers ON suppliers.id = purchase_orders.supplier_id
    WHERE purchase_orders.merchant_id = ?
    ORDER BY purchase_orders.updated_at DESC
  `, [merchantId]);
  const itemRows = await dbAll(env, `SELECT * FROM purchase_order_items WHERE merchant_id = ? ORDER BY created_at ASC`, [merchantId]);
  return rows.map((row) => purchaseOrderRecord(row, itemRows.filter((item) => item.purchase_order_id === row.id)));
}

async function getPurchaseOrder(env, merchantId, purchaseOrderId) {
  const row = await dbFirst(env, `SELECT purchase_orders.*, suppliers.name AS supplier_name FROM purchase_orders LEFT JOIN suppliers ON suppliers.id = purchase_orders.supplier_id WHERE purchase_orders.id = ? AND purchase_orders.merchant_id = ? LIMIT 1`, [purchaseOrderId, merchantId]);
  if (!row) return null;
  const itemRows = await dbAll(env, `SELECT * FROM purchase_order_items WHERE purchase_order_id = ? AND merchant_id = ? ORDER BY created_at ASC`, [purchaseOrderId, merchantId]);
  return purchaseOrderRecord(row, itemRows);
}

async function listCustomerSegments(env, merchantId) {
  return (await dbAll(env, `SELECT * FROM customer_segments WHERE merchant_id = ? ORDER BY active DESC, updated_at DESC`, [merchantId])).map(customerSegmentRecord);
}

async function listPriceLists(env, merchantId) {
  const rows = await dbAll(env, `
    SELECT price_lists.*, customer_segments.name AS segment_name
    FROM price_lists
    LEFT JOIN customer_segments ON customer_segments.id = price_lists.segment_id
    WHERE price_lists.merchant_id = ?
    ORDER BY price_lists.active DESC, price_lists.updated_at DESC
  `, [merchantId]);
  const itemRows = await dbAll(env, `
    SELECT price_list_items.*, products.title AS product_title
    FROM price_list_items
    LEFT JOIN products ON products.id = price_list_items.product_id
    WHERE price_list_items.merchant_id = ?
    ORDER BY price_list_items.created_at ASC
  `, [merchantId]);
  return rows.map((row) => priceListRecord(row, itemRows.filter((item) => item.price_list_id === row.id)));
}

async function listStaffRoles(env, merchantId) {
  return (await dbAll(env, `SELECT * FROM staff_roles WHERE merchant_id = ? ORDER BY active DESC, role_key ASC`, [merchantId])).map(staffRoleRecord);
}

async function listStaffMembers(env, merchantId) {
  const rows = await dbAll(env, `
    SELECT staff_members.*, staff_roles.name AS role_name, staff_roles.permissions_json AS role_permissions_json
    FROM staff_members
    LEFT JOIN staff_roles ON staff_roles.id = staff_members.role_id
    WHERE staff_members.merchant_id = ?
    ORDER BY staff_members.status ASC, staff_members.email ASC
  `, [merchantId]);
  return rows.map((row) => staffMemberRecord(row, staffRoleRecord({ id: row.role_id, merchant_id: merchantId, role_key: '', name: row.role_name || '', permissions_json: row.role_permissions_json || '[]', active: 1 })));
}

async function listStaffInvitations(env, merchantId) {
  const rows = await dbAll(env, `
    SELECT staff_invitations.*, staff_roles.name AS role_name
    FROM staff_invitations
    LEFT JOIN staff_roles ON staff_roles.id = staff_invitations.role_id
    WHERE staff_invitations.merchant_id = ?
    ORDER BY staff_invitations.created_at DESC
  `, [merchantId]);
  return rows.map(staffInvitationRecord);
}

async function listPosRegisters(env, merchantId) {
  const rows = await dbAll(env, `
    SELECT pos_registers.*, inventory_locations.name AS location_name
    FROM pos_registers
    LEFT JOIN inventory_locations ON inventory_locations.id = pos_registers.location_id
    WHERE pos_registers.merchant_id = ?
    ORDER BY pos_registers.active DESC, pos_registers.updated_at DESC
  `, [merchantId]);
  return rows.map(registerRecord);
}

async function listPosShifts(env, merchantId) {
  const rows = await dbAll(env, `
    SELECT pos_shifts.*, pos_registers.name AS register_name, staff_members.name AS staff_name
    FROM pos_shifts
    LEFT JOIN pos_registers ON pos_registers.id = pos_shifts.register_id
    LEFT JOIN staff_members ON staff_members.id = pos_shifts.staff_member_id
    WHERE pos_shifts.merchant_id = ?
    ORDER BY pos_shifts.opened_at DESC
    LIMIT 100
  `, [merchantId]);
  return rows.map(shiftRecord);
}

async function listPosCarts(env, merchantId) {
  return (await dbAll(env, `SELECT * FROM pos_carts WHERE merchant_id = ? ORDER BY updated_at DESC LIMIT 200`, [merchantId])).map(posCartRecord);
}

async function getPosCart(env, merchantId, cartId) {
  const row = await dbFirst(env, `SELECT * FROM pos_carts WHERE id = ? AND merchant_id = ? LIMIT 1`, [cartId, merchantId]);
  return row ? posCartRecord(row) : null;
}

function safeJsonParse(value, fallback = {}) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

function buildPosTerminalTender(payment = {}) {
  return [{
    type: 'stripe_terminal',
    amountCents: Number(payment.amountCents || 0),
    reference: payment.providerReference || '',
    note: payment.readerId ? `reader:${payment.readerId}` : ''
  }];
}

async function ensurePosTerminalOrderShell(env, merchant, cart, details = {}) {
  const existingOrderId = String(details.orderId || cart.orderId || '');
  if (existingOrderId) {
    const existingOrder = await getOrderDetails(env, existingOrderId, merchant.id);
    if (existingOrder) return existingOrder;
  }
  const orderId = uid('ord');
  const orderNumber = details.orderNumber || `POS-${String(Date.now()).slice(-8)}`;
  const receiptNumber = details.receiptNumber || `RCT-${orderNumber.slice(-8)}`;
  await dbRun(env, `INSERT INTO orders (id, merchant_id, customer_id, order_number, status, payment_status, payment_reference, currency, customer_name, customer_email, shipping_address_json, subtotal_cents, discount_code, discount_cents, shipping_cents, tax_cents, total_cents, items_json, notes) VALUES (?, ?, ?, ?, 'received', 'pending_provider', ?, ?, ?, ?, '{}', ?, '', ?, 0, ?, ?, ?, ?)`, [orderId, merchant.id, cart.customerId || null, orderNumber, details.providerReference || '', cart.currency || merchant.currency || 'USD', details.customerName || 'POS Customer', details.customerEmail || '', cart.subtotalCents, cart.discountCents, cart.taxCents, cart.totalCents, JSON.stringify(cart.items || []), details.note || 'POS terminal payment initiated']);
  await dbRun(env, `UPDATE pos_carts SET status = 'pending_provider', receipt_number = ?, order_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [receiptNumber, orderId, cart.id, merchant.id]);
  return getOrderDetails(env, orderId, merchant.id);
}

async function ensurePosTerminalInventoryAllocated(env, merchantId, orderId, cart = {}) {
  const existingAllocations = await dbAll(env, `SELECT id FROM order_allocations WHERE order_id = ? LIMIT 1`, [orderId]);
  if (existingAllocations.length) return false;
  for (const item of cart.items || []) {
    if (item.productId) await allocateProductInventory(env, merchantId, item.productId, item.quantity, orderId);
  }
  return true;
}

async function listMerchantRefunds(env, merchantId) {
  return (await dbAll(env, `SELECT * FROM refunds WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 200`, [merchantId])).map(refundRecord);
}

async function sumOrderRefunds(env, merchantId, orderId) {
  return (await dbAll(env, `SELECT * FROM refunds WHERE merchant_id = ? AND order_id = ? ORDER BY created_at DESC`, [merchantId, orderId])).map(refundRecord);
}


async function listWorkflowRules(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM commerce_workflow_rules WHERE merchant_id = ? ORDER BY active DESC, updated_at DESC`, [merchantId]);
  return rows.map(workflowRuleRecord);
}

async function listWorkflowRuns(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM commerce_workflow_runs WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 200`, [merchantId]);
  return rows.map(workflowRunRecord);
}

async function executeWorkflowRules(env, merchantId, eventType, payload = {}, actor = {}) {
  const rules = (await listWorkflowRules(env, merchantId)).filter((rule) => rule.active && rule.triggerEvent === String(eventType || '').toLowerCase());
  const runs = [];
  for (const rule of rules) {
    const evaluated = evaluateWorkflowRule(rule, { eventType, payload });
    const effects = buildAutomationActionEffects(evaluated.actions || []);
    const result = { ...effects, notifications: [], webhooks: [], audits: [] };
    if (evaluated.matched) {
      for (const action of evaluated.actions || []) {
        if (action.type === 'queue_notification') {
          const notificationId = await queueNotification(env, {
            merchantId,
            orderId: payload.order?.id || payload.orderId || null,
            customerId: payload.customer?.id || payload.order?.customerId || null,
            channel: action.target || 'email',
            templateKey: action.templateKey || 'automation',
            recipient: action.payload?.recipient || payload.order?.customerEmail || payload.customer?.email || '',
            subject: action.subject || `${rule.name} notification`,
            bodyText: action.bodyText || action.note || rule.name,
            meta: { ruleId: rule.id, actionType: action.type, payload: action.payload || {} }
          });
          if (notificationId) result.notifications.push(notificationId);
        }
        if (action.type === 'queue_webhook') {
          const ids = await queueWebhookEvent(env, merchantId, action.target || eventType, { ruleId: rule.id, payload, actionPayload: action.payload || {} });
          result.webhooks.push(...ids);
        }
        if (action.type === 'hold_order' && (payload.order?.id || payload.orderId)) {
          const orderId = payload.order?.id || payload.orderId;
          await dbRun(env, `UPDATE orders SET status = 'on_hold' WHERE id = ? AND merchant_id = ?`, [orderId, merchantId]);
          result.audits.push(await audit(env, merchantId, 'workflow.order_hold', `Workflow ${rule.name} placed order on hold`, 'order', orderId, { ruleId: rule.id }, actor));
        }
        if (action.type === 'create_task') {
          result.audits.push(await audit(env, merchantId, 'workflow.task', action.note || `Workflow task: ${rule.name}`, 'workflow_rule', rule.id, { action }, actor));
        }
      }
    }
    const runId = uid('wfr');
    await dbRun(env, `INSERT INTO commerce_workflow_runs (id, merchant_id, rule_id, event_type, event_ref, status, matched, actions_json, result_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [runId, merchantId, rule.id, eventType, payload.order?.id || payload.orderId || payload.checkoutId || '', evaluated.status, evaluated.matched ? 1 : 0, JSON.stringify(evaluated.actions || []), JSON.stringify(result)]);
    runs.push(workflowRunRecord(await dbFirst(env, `SELECT * FROM commerce_workflow_runs WHERE id = ? LIMIT 1`, [runId])));
  }
  return { ruleCount: rules.length, matchedCount: runs.filter((run) => run.matched).length, runs };
}

async function listLoyaltyPrograms(env, merchantId) {
  const rows = await dbAll(env, `SELECT * FROM loyalty_programs WHERE merchant_id = ? ORDER BY active DESC, created_at DESC`, [merchantId]);
  return rows.map(loyaltyProgramRecord);
}

async function getActiveLoyaltyProgram(env, merchantId) {
  const row = await dbFirst(env, `SELECT * FROM loyalty_programs WHERE merchant_id = ? AND active = 1 ORDER BY updated_at DESC, created_at DESC LIMIT 1`, [merchantId]);
  return row ? loyaltyProgramRecord(row) : null;
}

async function listLoyaltyLedger(env, merchantId, customerId = '') {
  const rows = await dbAll(env, `SELECT * FROM loyalty_ledger WHERE merchant_id = ? ${customerId ? 'AND customer_id = ?' : ''} ORDER BY created_at DESC LIMIT 300`, customerId ? [merchantId, customerId] : [merchantId]);
  return rows.map(loyaltyLedgerRecord);
}

async function applyLoyaltyForOrder(env, merchantId, order) {
  if (!order?.customerId) return null;
  const program = await getActiveLoyaltyProgram(env, merchantId);
  if (!program) return null;
  const earned = calculateEarnedPoints(order, program);
  if (!earned.points) return { program, earned, ledgerId: null };
  const id = uid('loy');
  await dbRun(env, `INSERT INTO loyalty_ledger (id, merchant_id, customer_id, order_id, points_delta, reason, note) VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, merchantId, order.customerId, order.id, earned.points, 'order_earned', `Earned from order ${order.orderNumber || order.id}`]);
  return { program, earned, ledgerId: id };
}

async function listProductReviews(env, merchantId, productId = '') {
  const rows = await dbAll(env, `
    SELECT product_reviews.*, products.title AS product_title
    FROM product_reviews
    LEFT JOIN products ON products.id = product_reviews.product_id
    WHERE product_reviews.merchant_id = ? ${productId ? 'AND product_reviews.product_id = ?' : ''}
    ORDER BY product_reviews.created_at DESC
    LIMIT 300
  `, productId ? [merchantId, productId] : [merchantId]);
  return rows.map(productReviewRecord);
}

async function listInventoryTransfers(env, merchantId) {
  const rows = await dbAll(env, `
    SELECT inventory_transfers.*, from_locations.name AS from_location_name, to_locations.name AS to_location_name
    FROM inventory_transfers
    LEFT JOIN inventory_locations AS from_locations ON from_locations.id = inventory_transfers.from_location_id
    LEFT JOIN inventory_locations AS to_locations ON to_locations.id = inventory_transfers.to_location_id
    WHERE inventory_transfers.merchant_id = ?
    ORDER BY inventory_transfers.created_at DESC
    LIMIT 200
  `, [merchantId]);
  return rows.map(inventoryTransferRecord);
}

async function completeInventoryTransfer(env, merchantId, transferId, actor = {}) {
  const row = await dbFirst(env, `SELECT * FROM inventory_transfers WHERE id = ? AND merchant_id = ? LIMIT 1`, [transferId, merchantId]);
  if (!row) throw new Error('Inventory transfer not found.');
  const transfer = inventoryTransferRecord(row);
  if (transfer.status === 'completed') return transfer;
  if (transfer.fromLocationId === transfer.toLocationId) throw new Error('Transfer locations must be different.');
  const sourceLevels = [];
  for (const item of transfer.items) {
    const level = await dbFirst(env, `SELECT available FROM inventory_levels WHERE location_id = ? AND product_id = ? LIMIT 1`, [transfer.fromLocationId, item.productId]);
    sourceLevels.push({ productId: item.productId, available: Number(level?.available || 0) });
  }
  const plan = buildInventoryTransferPlan(transfer, sourceLevels);
  if (!plan.ok) throw new Error(`Insufficient source inventory: ${plan.checks.filter((item) => !item.canTransfer).map((item) => `${item.productId} short ${item.shortBy}`).join(', ')}`);
  for (const item of transfer.items) {
    const source = await dbFirst(env, `SELECT available FROM inventory_levels WHERE location_id = ? AND product_id = ? LIMIT 1`, [transfer.fromLocationId, item.productId]);
    const target = await dbFirst(env, `SELECT available FROM inventory_levels WHERE location_id = ? AND product_id = ? LIMIT 1`, [transfer.toLocationId, item.productId]);
    const beforeSource = Number(source?.available || 0);
    const beforeTarget = Number(target?.available || 0);
    const afterSource = Math.max(0, beforeSource - item.quantity);
    const afterTarget = beforeTarget + item.quantity;
    await upsertInventoryLevel(env, merchantId, item.productId, transfer.fromLocationId, afterSource);
    await upsertInventoryLevel(env, merchantId, item.productId, transfer.toLocationId, afterTarget);
    await dbRun(env, `INSERT INTO inventory_adjustments (id, merchant_id, location_id, product_id, kind, delta, before_available, after_available, note, reference) VALUES (?, ?, ?, ?, 'transfer_out', ?, ?, ?, ?, ?)`, [uid('iadj'), merchantId, transfer.fromLocationId, item.productId, -item.quantity, beforeSource, afterSource, `Transfer ${transfer.id} out`, transfer.reference || transfer.id]);
    await dbRun(env, `INSERT INTO inventory_adjustments (id, merchant_id, location_id, product_id, kind, delta, before_available, after_available, note, reference) VALUES (?, ?, ?, ?, 'transfer_in', ?, ?, ?, ?, ?)`, [uid('iadj'), merchantId, transfer.toLocationId, item.productId, item.quantity, beforeTarget, afterTarget, `Transfer ${transfer.id} in`, transfer.reference || transfer.id]);
  }
  await dbRun(env, `UPDATE inventory_transfers SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [transfer.id, merchantId]);
  await audit(env, merchantId, 'inventory_transfer.completed', `Inventory transfer completed`, 'inventory_transfer', transfer.id, { unitCount: plan.unitCount }, actor);
  return inventoryTransferRecord(await dbFirst(env, `SELECT * FROM inventory_transfers WHERE id = ? LIMIT 1`, [transfer.id]));
}


async function processSystemQueues(env, { merchantId = '', limit = 25 } = {}) {
  const merchants = merchantId ? [{ id: merchantId }] : await dbAll(env, `SELECT id FROM merchants ORDER BY created_at ASC LIMIT 500`);
  const runs = [];
  for (const merchant of merchants) {
    const id = merchant.id || merchant.merchant_id;
    if (!id) continue;
    const notifications = await dispatchQueuedNotifications(env, id, limit);
    const webhooks = await dispatchWebhookDeliveries(env, id, limit);
    runs.push({ merchantId: id, notifications, webhooks });
  }
  return { ok: true, merchantCount: runs.length, runs };
}

async function countFirst(env, sql, bindings = []) {
  try {
    const row = await dbFirst(env, sql, bindings);
    return Number(row?.count || 0);
  } catch {
    return 0;
  }
}

async function buildSystemSecurityReadiness(env, merchantId) {
  const [queuedNotifications, deadNotifications, queuedWebhooks, deadWebhooks, activeProviderConnections, validationRuns] = await Promise.all([
    countFirst(env, `SELECT COUNT(*) AS count FROM notification_messages WHERE merchant_id = ? AND status IN ('queued','failed')`, [merchantId]),
    countFirst(env, `SELECT COUNT(*) AS count FROM notification_messages WHERE merchant_id = ? AND status = 'dead_letter'`, [merchantId]),
    countFirst(env, `SELECT COUNT(*) AS count FROM webhook_deliveries WHERE merchant_id = ? AND status IN ('queued','failed')`, [merchantId]),
    countFirst(env, `SELECT COUNT(*) AS count FROM webhook_deliveries WHERE merchant_id = ? AND status = 'dead_letter'`, [merchantId]),
    countFirst(env, `SELECT COUNT(*) AS count FROM provider_connections WHERE merchant_id = ? AND active = 1`, [merchantId]),
    listProviderValidationRuns(env, merchantId).catch(() => [])
  ]);
  const lastPassedByConnection = new Map();
  for (const run of validationRuns) {
    if (!lastPassedByConnection.has(run.connectionId) && run.status === 'passed') lastPassedByConnection.set(run.connectionId, run);
  }
  const validatedActiveConnections = [...lastPassedByConnection.keys()].length;
  const production = productionRuntimeReadiness(env);
  return {
    runtime: runtimeSecurityReadiness(env),
    production,
    queues: {
      queuedNotifications,
      deadNotifications,
      queuedWebhooks,
      deadWebhooks,
      hasDeadLetters: deadNotifications + deadWebhooks > 0
    },
    providers: {
      activeConnections: activeProviderConnections,
      validatedActiveConnections,
      lastValidationRuns: validationRuns.slice(0, 12),
      needsValidation: Math.max(0, activeProviderConnections - validatedActiveConnections)
    },
    verdict: {
      ok: production.ok && deadNotifications + deadWebhooks === 0 && activeProviderConnections === validatedActiveConnections,
      blockers: [
        ...(deadNotifications + deadWebhooks > 0 ? ['queue_dead_letters_present'] : []),
        ...(activeProviderConnections > validatedActiveConnections ? ['active_provider_connections_need_live_validation'] : []),
        ...(env.CORS_ALLOW_ALL === 'true' ? ['cors_allow_all_enabled'] : []),
        ...production.blockers
      ]
    }
  };
}

async function handleApi(request, env, url) {
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return json({ ok: true, hasDb: Boolean(env.DB), hasAssets: Boolean(env.ASSETS), hasAeToken: Boolean(env.AE_COMMAND_TOKEN) });
  }

  const customerResponse = await handleCustomerApi(request, env, url);
  if (customerResponse) return customerResponse;

  if (request.method === 'POST' && url.pathname === '/api/merchant/register') {
    const body = await readJson(request) || {};
    if (!body.brandName || !body.slug || !body.email || !body.password) return json({ error: 'brandName, slug, email, and password are required.' }, 400);
    const slug = slugify(body.slug);
    const exists = await dbFirst(env, `SELECT id FROM merchants WHERE slug = ? OR lower(email) = lower(?) LIMIT 1`, [slug, body.email]);
    if (exists) return json({ error: 'Merchant with that slug or email already exists.' }, 409);
    const merchantId = uid('mrc');
    const passwordHash = await hashPassword(body.email, body.password);
    const theme = normalizeMerchantUpdate(body);
    await dbRun(env, `
      INSERT INTO merchants (
        id, slug, brand_name, email, password_hash, currency,
        accent_color, surface_color, background_color, text_color,
        hero_title, hero_tagline, checkout_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [merchantId, slug, body.brandName, body.email, passwordHash, theme.currency, theme.accentColor, theme.surfaceColor, theme.backgroundColor, theme.textColor, theme.heroTitle || body.brandName, theme.heroTagline, theme.checkoutNote]);
    const token = await createSession(env, { merchantId, email: body.email, role: 'merchant_owner' });
    return json({ ok: true, merchant: merchantRecord(await dbFirst(env, `SELECT * FROM merchants WHERE id = ?`, [merchantId])) }, 201, { 'Set-Cookie': setSessionCookie(token) });
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/login') {
    const body = await readJson(request) || {};
    const email = String(body.email || '').trim().toLowerCase();
    const guard = await guardAuthAttempt(request, env, 'merchant_login', email);
    if (guard.locked) return guard.locked;
    const merchant = await dbFirst(env, `SELECT * FROM merchants WHERE lower(email) = lower(?) LIMIT 1`, [email]);
    if (!merchant) {
      await recordAuthFailure(env, guard, 'merchant_login', email, 'merchant_not_found');
      return unauthorized('Invalid credentials.');
    }
    const passwordOk = await verifyPassword(merchant.email, body.password || '', merchant.password_hash);
    if (!passwordOk) {
      await recordAuthFailure(env, guard, 'merchant_login', email, 'bad_password');
      return unauthorized('Invalid credentials.');
    }
    await recordAuthSuccess(env, guard, 'merchant_login', email);
    const token = await createSession(env, { merchantId: merchant.id, email: merchant.email, role: 'merchant_owner' });
    return json({ ok: true, merchant: merchantRecord(merchant) }, 200, { 'Set-Cookie': setSessionCookie(token) });
  }

  if (request.method === 'POST' && url.pathname === '/api/ae/login') {
    const body = await readJson(request) || {};
    if (!env.AE_COMMAND_TOKEN || body.token !== env.AE_COMMAND_TOKEN) return unauthorized('Invalid AE token.');
    const token = await createSession(env, { merchantId: null, email: 'ae-command@skyecommerce.system', role: 'ae_admin' });
    return json({ ok: true }, 200, { 'Set-Cookie': setSessionCookie(token) });
  }

  if (request.method === 'POST' && url.pathname === '/api/staff/login') {
    const body = await readJson(request) || {};
    const slug = slugify(body.slug || '');
    const staffEmail = String(body.email || '').trim().toLowerCase();
    if (!slug || !staffEmail || !body.password) return json({ error: 'slug, email, and password are required.' }, 400);
    const guard = await guardAuthAttempt(request, env, 'staff_login', `${slug}:${staffEmail}`);
    if (guard.locked) return guard.locked;
    const merchant = await dbFirst(env, `SELECT id, slug, brand_name FROM merchants WHERE slug = ? LIMIT 1`, [slug]);
    if (!merchant) {
      await recordAuthFailure(env, guard, 'staff_login', `${slug}:${staffEmail}`, 'merchant_not_found');
      return unauthorized('Invalid staff credentials.');
    }
    const staffRow = await dbFirst(env, `SELECT staff_members.*, staff_roles.name AS role_name, staff_roles.permissions_json AS role_permissions_json FROM staff_members LEFT JOIN staff_roles ON staff_roles.id = staff_members.role_id WHERE staff_members.merchant_id = ? AND lower(staff_members.email) = lower(?) AND staff_members.status = 'active' LIMIT 1`, [merchant.id, staffEmail]);
    if (!staffRow || !staffRow.password_hash) {
      await recordAuthFailure(env, guard, 'staff_login', `${slug}:${staffEmail}`, 'staff_not_found_or_no_password');
      return unauthorized('Invalid staff credentials.');
    }
    const passwordOk = await verifyPassword(staffRow.email, body.password || '', staffRow.password_hash);
    if (!passwordOk) {
      await recordAuthFailure(env, guard, 'staff_login', `${slug}:${staffEmail}`, 'bad_password');
      return unauthorized('Invalid staff credentials.');
    }
    await recordAuthSuccess(env, guard, 'staff_login', `${slug}:${staffEmail}`);
    await dbRun(env, `UPDATE staff_members SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [staffRow.id, merchant.id]);
    const token = await createSession(env, { merchantId: merchant.id, email: staffRow.email, role: 'merchant_staff' });
    const rolePermissions = (() => { try { return JSON.parse(staffRow.role_permissions_json || '[]'); } catch { return []; } })();
    const directPermissions = (() => { try { return JSON.parse(staffRow.permissions_json || '[]'); } catch { return []; } })();
    return json({ ok: true, merchant: { id: merchant.id, slug: merchant.slug, brandName: merchant.brand_name }, staff: staffMemberRecord(staffRow, { permissions: rolePermissions }), permissions: [...new Set([...rolePermissions, ...directPermissions])] }, 200, { 'Set-Cookie': setSessionCookie(token) });
  }

  if (request.method === 'POST' && url.pathname === '/api/staff/invitations/accept') {
    const body = await readJson(request) || {};
    if (!body.token || !body.password) return json({ error: 'token and password are required.' }, 400);
    const tokenHash = await sha256Hex(String(body.token || ''));
    const invitation = await dbFirst(env, `SELECT staff_invitations.*, merchants.slug AS merchant_slug, merchants.brand_name AS merchant_brand_name FROM staff_invitations INNER JOIN merchants ON merchants.id = staff_invitations.merchant_id WHERE staff_invitations.token_hash = ? AND staff_invitations.status = 'pending' LIMIT 1`, [tokenHash]);
    if (!invitation) return json({ error: 'Invitation not found or already used.' }, 404);
    if (invitation.expires_at && Date.parse(invitation.expires_at) && Date.parse(invitation.expires_at) < Date.now()) return json({ error: 'Invitation has expired.' }, 410);
    const existing = await dbFirst(env, `SELECT id FROM staff_members WHERE merchant_id = ? AND lower(email) = lower(?) LIMIT 1`, [invitation.merchant_id, invitation.email]);
    if (existing) return json({ error: 'Staff member already exists for this invitation.' }, 409);
    const memberId = uid('stm');
    const passwordHash = await hashPassword(invitation.email, body.password);
    const name = String(body.name || invitation.name || '').trim();
    await dbRun(env, `INSERT INTO staff_members (id, merchant_id, role_id, email, name, status, permissions_json, password_hash) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`, [memberId, invitation.merchant_id, invitation.role_id || null, invitation.email, name, invitation.permissions_json || '[]', passwordHash]);
    await dbRun(env, `UPDATE staff_invitations SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [invitation.id, invitation.merchant_id]);
    const token = await createSession(env, { merchantId: invitation.merchant_id, email: invitation.email, role: 'merchant_staff' });
    return json({ ok: true, merchant: { id: invitation.merchant_id, slug: invitation.merchant_slug, brandName: invitation.merchant_brand_name }, staffMemberId: memberId }, 201, { 'Set-Cookie': setSessionCookie(token) });
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
  }

  if (request.method === 'GET' && url.pathname === '/api/auth/me') {
    const session = await getSession(request, env);
    if (!session) return json({ ok: false, session: null });
    if (session.role === 'merchant_owner' && session.merchantId) {
      const merchant = await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [session.merchantId]);
      return json({ ok: true, session: { ...session, merchant: merchantRecord(merchant) } });
    }
    return json({ ok: true, session });
  }

  const staffPermissionError = await enforceStaffRoutePermission(request, env, url);
  if (staffPermissionError) return staffPermissionError;

  if (request.method === 'GET' && url.pathname === '/api/merchant') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const merchant = await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [auth.session.merchantId]);
    return json({ ok: true, merchant: merchantRecord(merchant), theme: defaultTheme(merchantRecord(merchant)) });
  }

  if (request.method === 'PUT' && url.pathname === '/api/merchant') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = normalizeMerchantUpdate(await readJson(request) || {});
    await dbRun(env, `
      UPDATE merchants
      SET brand_name = ?, currency = ?, accent_color = ?, surface_color = ?, background_color = ?, text_color = ?,
          hero_title = ?, hero_tagline = ?, checkout_note = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [body.brandName, body.currency, body.accentColor, body.surfaceColor, body.backgroundColor, body.textColor, body.heroTitle, body.heroTagline, body.checkoutNote, auth.session.merchantId]);
    const merchant = await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [auth.session.merchantId]);
    return json({ ok: true, merchant: merchantRecord(merchant) });
  }

  if (request.method === 'GET' && url.pathname === '/api/analytics/summary') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const [products, orders, returns, jobs, customers, locations, inventoryLevels] = await Promise.all([
      listMerchantProducts(env, auth.session.merchantId),
      dbAll(env, `SELECT * FROM orders WHERE merchant_id = ? ORDER BY created_at DESC`, [auth.session.merchantId]),
      listMerchantReturns(env, auth.session.merchantId),
      dbAll(env, `SELECT * FROM import_jobs WHERE merchant_id = ? ORDER BY created_at DESC`, [auth.session.merchantId]),
      dbAll(env, `SELECT * FROM customer_accounts WHERE merchant_id = ? ORDER BY created_at DESC`, [auth.session.merchantId]),
      listMerchantInventoryLocations(env, auth.session.merchantId),
      listMerchantInventoryLevels(env, auth.session.merchantId)
    ]);
    return json({ ok: true, analytics: buildMerchantAnalytics({ products, orders: orders.map(orderSummary), returns, importJobs: jobs.map((job) => ({ id: job.id, kind: job.kind, status: job.status, sourceRef: job.source_ref || '', createdAt: job.created_at })), customers, locations, inventoryLevels }) });
  }


  if (request.method === 'GET' && url.pathname === '/api/system/security-readiness') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, readiness: await buildSystemSecurityReadiness(env, auth.session.merchantId) });
  }

  if (request.method === 'GET' && url.pathname === '/api/system/production-readiness') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const production = productionRuntimeReadiness(env);
    const connections = await listMerchantProviderConnections(env, auth.session.merchantId);
    const runtime = providerRuntimeMatrix(env, connections.filter((item) => item.active));
    production.providerRuntime = runtime;
    production.blockers = [...new Set([...(production.blockers || []), ...(runtime.blockers || [])])];
    production.ok = production.blockers.length === 0;
    return json({ ok: production.ok, production }, production.ok ? 200 : 409);
  }

  if (request.method === 'POST' && url.pathname === '/api/system/orders/release-stale-reservations') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    const minutes = Math.max(5, Number(body.minutes || url.searchParams.get('minutes') || 30) || 30);
    const modifier = `-${minutes} minutes`;
    const rows = await dbAll(env, `SELECT * FROM orders WHERE merchant_id = ? AND payment_status IN ('pending_provider', 'pending_provider_failure') AND status != 'cancelled' AND datetime(created_at) <= datetime('now', ?) ORDER BY created_at ASC`, [auth.session.merchantId, modifier]);
    let released = 0;
    const releasedOrderIds = [];
    for (const row of rows) {
      const paymentRows = await dbAll(env, `SELECT * FROM payment_transactions WHERE order_id = ? ORDER BY created_at DESC`, [row.id]);
      if (paymentRows.some((payment) => ['paid', 'authorized'].includes(String(payment.status || '').toLowerCase()))) continue;
      const detailedOrder = await getOrderDetails(env, row.id, auth.session.merchantId);
      if (!detailedOrder) continue;
      await releaseOrderInventoryAfterPaymentFailure(env, auth.session.merchantId, detailedOrder);
      await dbRun(env, `UPDATE payment_transactions SET status = 'voided', updated_at = CURRENT_TIMESTAMP WHERE order_id = ? AND status IN ('pending', 'authorized')`, [row.id]);
      await dbRun(env, `UPDATE orders SET status = 'cancelled', payment_status = 'voided', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [row.id, auth.session.merchantId]);
      await appendOrderEvent(env, row.id, { kind: 'checkout_expired', summary: `Checkout expired after ${minutes} minutes`, status: 'cancelled', paymentStatus: 'voided', detail: 'Reserved inventory released because the public checkout did not complete in time.' });
      released += 1;
      releasedOrderIds.push(row.id);
    }
    return json({ ok: true, minutes, released, releasedOrderIds });
  }

  if (request.method === 'POST' && url.pathname === '/api/system/queues/run') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const result = await processSystemQueues(env, { merchantId: auth.session.merchantId, limit: Number(url.searchParams.get('limit') || 25) });
    return json(result);
  }

  if (request.method === 'GET' && url.pathname === '/api/workflows/rules') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, rules: await listWorkflowRules(env, auth.session.merchantId), runs: await listWorkflowRuns(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/workflows/rules') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeWorkflowRuleInput(await readJson(request) || {});
    if (!payload.name || !payload.triggerEvent || !payload.actions.length) return json({ error: 'name, triggerEvent, and at least one action are required.' }, 400);
    const id = uid('wfrule');
    await dbRun(env, `INSERT INTO commerce_workflow_rules (id, merchant_id, rule_key, name, trigger_event, conditions_json, actions_json, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.key, payload.name, payload.triggerEvent, JSON.stringify(payload.conditions), JSON.stringify(payload.actions), payload.active ? 1 : 0]);
    await audit(env, auth.session.merchantId, 'workflow_rule.created', `Workflow rule created: ${payload.name}`, 'workflow_rule', id, { triggerEvent: payload.triggerEvent }, auth.session);
    return json({ ok: true, rule: workflowRuleRecord(await dbFirst(env, `SELECT * FROM commerce_workflow_rules WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'POST' && url.pathname === '/api/workflows/run') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    const result = await executeWorkflowRules(env, auth.session.merchantId, body.eventType || 'system.validation', body.payload || {}, auth.session);
    return json({ ok: true, result, runs: await listWorkflowRuns(env, auth.session.merchantId) });
  }

  if (request.method === 'GET' && url.pathname === '/api/loyalty/programs') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, programs: await listLoyaltyPrograms(env, auth.session.merchantId), ledger: await listLoyaltyLedger(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/loyalty/programs') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeLoyaltyProgramInput(await readJson(request) || {});
    const id = uid('loyp');
    await dbRun(env, `INSERT INTO loyalty_programs (id, merchant_id, name, earn_points_per_dollar, redeem_cents_per_point, minimum_redeem_points, active) VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.name, payload.earnPointsPerDollar, payload.redeemCentsPerPoint, payload.minimumRedeemPoints, payload.active ? 1 : 0]);
    await audit(env, auth.session.merchantId, 'loyalty_program.created', `Loyalty program created: ${payload.name}`, 'loyalty_program', id, payload, auth.session);
    return json({ ok: true, program: loyaltyProgramRecord(await dbFirst(env, `SELECT * FROM loyalty_programs WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/loyalty/ledger') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const customerId = url.searchParams.get('customerId') || '';
    const ledger = await listLoyaltyLedger(env, auth.session.merchantId, customerId);
    return json({ ok: true, ledger, summary: summarizeLoyaltyBalance(ledger) });
  }

  if (request.method === 'POST' && url.pathname === '/api/loyalty/ledger') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeLoyaltyLedgerInput(await readJson(request) || {});
    if (!payload.customerId || !payload.pointsDelta) return json({ error: 'customerId and points are required.' }, 400);
    const id = uid('loy');
    await dbRun(env, `INSERT INTO loyalty_ledger (id, merchant_id, customer_id, order_id, points_delta, reason, note) VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.customerId, payload.orderId || null, payload.pointsDelta, payload.reason, payload.note]);
    await audit(env, auth.session.merchantId, 'loyalty_ledger.created', `Loyalty ledger adjusted by ${payload.pointsDelta} points`, 'customer', payload.customerId, payload, auth.session);
    const ledger = await listLoyaltyLedger(env, auth.session.merchantId, payload.customerId);
    return json({ ok: true, entry: loyaltyLedgerRecord(await dbFirst(env, `SELECT * FROM loyalty_ledger WHERE id = ? LIMIT 1`, [id])), summary: summarizeLoyaltyBalance(ledger) }, 201);
  }

  if (request.method === 'POST' && url.pathname === '/api/loyalty/redeem-preview') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    const program = await getActiveLoyaltyProgram(env, auth.session.merchantId);
    if (!program) return json({ ok: false, error: 'No active loyalty program.' }, 404);
    const ledger = await listLoyaltyLedger(env, auth.session.merchantId, String(body.customerId || ''));
    const summary = summarizeLoyaltyBalance(ledger);
    return json({ ok: true, program, summary, redemption: previewLoyaltyRedemption(summary.balancePoints, Number(body.requestedPoints || 0), program) });
  }

  if (request.method === 'GET' && url.pathname === '/api/product-reviews') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const productId = url.searchParams.get('productId') || '';
    const reviews = await listProductReviews(env, auth.session.merchantId, productId);
    return json({ ok: true, reviews, summary: summarizeProductReviews(reviews) });
  }

  if (request.method === 'POST' && url.pathname === '/api/product-reviews') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = moderateReview(await readJson(request) || {}, { autoApproveMinRating: 4, minBodyLength: 8, blockedTerms: ['spam', 'scam'] });
    if (!payload.productId || !payload.rating) return json({ error: 'productId and rating are required.' }, 400);
    const product = await dbFirst(env, `SELECT id FROM products WHERE id = ? AND merchant_id = ? LIMIT 1`, [payload.productId, auth.session.merchantId]);
    if (!product) return json({ error: 'Product not found.' }, 404);
    const id = uid('rev');
    await dbRun(env, `INSERT INTO product_reviews (id, merchant_id, product_id, customer_id, customer_name, customer_email, rating, title, body, status, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.productId, payload.customerId || null, payload.customerName, payload.customerEmail, payload.rating, payload.title, payload.body, payload.status, payload.source]);
    await audit(env, auth.session.merchantId, 'review.created', `Product review created`, 'product', payload.productId, { rating: payload.rating, status: payload.status, moderationReason: payload.moderationReason }, auth.session);
    await queueWebhookEvent(env, auth.session.merchantId, 'review.created', { reviewId: id, productId: payload.productId, rating: payload.rating, status: payload.status });
    return json({ ok: true, review: productReviewRecord(await dbFirst(env, `SELECT * FROM product_reviews WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/inventory-transfers') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, transfers: await listInventoryTransfers(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/inventory-transfers') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeInventoryTransferInput(await readJson(request) || {});
    if (!payload.fromLocationId || !payload.toLocationId || !payload.items.length) return json({ error: 'fromLocationId, toLocationId, and items are required.' }, 400);
    if (payload.fromLocationId === payload.toLocationId) return json({ error: 'Transfer source and destination must be different.' }, 400);
    const id = uid('itr');
    await dbRun(env, `INSERT INTO inventory_transfers (id, merchant_id, from_location_id, to_location_id, status, reference, note, items_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.fromLocationId, payload.toLocationId, payload.status, payload.reference, payload.note, JSON.stringify(payload.items)]);
    await audit(env, auth.session.merchantId, 'inventory_transfer.created', `Inventory transfer created`, 'inventory_transfer', id, { unitCount: payload.items.reduce((sum, item) => sum + item.quantity, 0) }, auth.session);
    return json({ ok: true, transfer: inventoryTransferRecord(await dbFirst(env, `SELECT * FROM inventory_transfers WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  const inventoryTransferCompleteMatch = url.pathname.match(/^\/api\/inventory-transfers\/([^/]+)\/complete$/);
  if (inventoryTransferCompleteMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    try {
      const transfer = await completeInventoryTransfer(env, auth.session.merchantId, decodeURIComponent(inventoryTransferCompleteMatch[1]), auth.session);
      return json({ ok: true, transfer, transfers: await listInventoryTransfers(env, auth.session.merchantId), levels: await listMerchantInventoryLevels(env, auth.session.merchantId) });
    } catch (error) {
      return json({ error: error.message }, 409);
    }
  }


  if (request.method === 'GET' && url.pathname === '/api/product-bundles') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, bundles: await listMerchantBundles(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/product-bundles') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeBundleInput(await readJson(request) || {});
    if (!payload.title || !payload.items.length) return json({ error: 'title and at least one bundle item are required.' }, 400);
    const id = uid('bnd');
    await dbRun(env, `INSERT INTO product_bundles (id, merchant_id, slug, title, description, image_url, pricing_mode, fixed_price_cents, discount_bps, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.slug, payload.title, payload.description, payload.imageUrl, payload.pricingMode, payload.fixedPriceCents, payload.discountBps, payload.status]);
    for (const [index, item] of payload.items.entries()) {
      await dbRun(env, `INSERT INTO product_bundle_items (id, merchant_id, bundle_id, product_id, variant_id, quantity, required, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [uid('bndi'), auth.session.merchantId, id, item.productId, item.variantId, item.quantity, item.required ? 1 : 0, item.position || index]);
    }
    await audit(env, auth.session.merchantId, 'bundle.created', `Bundle ${payload.title} created`, 'bundle', id, { itemCount: payload.items.length }, auth.session);
    return json({ ok: true, bundle: await getMerchantBundle(env, auth.session.merchantId, id) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/suppliers') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, suppliers: await listMerchantSuppliers(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/suppliers') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeSupplierInput(await readJson(request) || {});
    if (!payload.name) return json({ error: 'name is required.' }, 400);
    const id = uid('sup');
    await dbRun(env, `INSERT INTO suppliers (id, merchant_id, name, contact_name, email, phone, website, country_code, lead_time_days, minimum_order_cents, active, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.name, payload.contactName, payload.email, payload.phone, payload.website, payload.countryCode, payload.leadTimeDays, payload.minimumOrderCents, payload.active ? 1 : 0, payload.notes]);
    await audit(env, auth.session.merchantId, 'supplier.created', `Supplier ${payload.name} created`, 'supplier', id, {}, auth.session);
    return json({ ok: true, supplier: supplierRecord(await dbFirst(env, `SELECT * FROM suppliers WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/purchase-orders') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, purchaseOrders: await listMerchantPurchaseOrders(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/purchase-orders') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizePurchaseOrderInput(await readJson(request) || {});
    if (!payload.items.length) return json({ error: 'At least one purchase order item is required.' }, 400);
    const id = uid('po');
    const location = payload.locationId ? { id: payload.locationId } : await ensureDefaultInventoryLocation(env, auth.session.merchantId);
    await dbRun(env, `INSERT INTO purchase_orders (id, merchant_id, supplier_id, location_id, status, expected_at, currency, total_cost_cents, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.supplierId || null, location?.id || null, payload.status, payload.expectedAt, payload.currency, payload.totalCostCents, payload.notes]);
    for (const item of payload.items) {
      await dbRun(env, `INSERT INTO purchase_order_items (id, merchant_id, purchase_order_id, product_id, variant_id, sku, title, quantity, received_quantity, unit_cost_cents, line_total_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [uid('poi'), auth.session.merchantId, id, item.productId, item.variantId, item.sku, item.title, item.quantity, item.receivedQuantity, item.unitCostCents, item.lineTotalCents]);
    }
    await audit(env, auth.session.merchantId, 'purchase_order.created', `Purchase order ${id} created`, 'purchase_order', id, { totalCostCents: payload.totalCostCents }, auth.session);
    return json({ ok: true, purchaseOrder: await getPurchaseOrder(env, auth.session.merchantId, id) }, 201);
  }

  const purchaseOrderReceiveMatch = url.pathname.match(/^\/api\/purchase-orders\/([^/]+)\/receive$/);
  if (purchaseOrderReceiveMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const purchaseOrderId = decodeURIComponent(purchaseOrderReceiveMatch[1]);
    const po = await getPurchaseOrder(env, auth.session.merchantId, purchaseOrderId);
    if (!po) return json({ error: 'Purchase order not found.' }, 404);
    const receipt = buildPurchaseOrderReceipt(po, await readJson(request) || {});
    const location = po.locationId ? { id: po.locationId } : await ensureDefaultInventoryLocation(env, auth.session.merchantId);
    for (const item of receipt.items) {
      if (!item.receiveQuantity) continue;
      await dbRun(env, `UPDATE purchase_order_items SET received_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [item.afterReceivedQuantity, item.id, auth.session.merchantId]);
      if (item.productId) {
        const levels = await listMerchantInventoryLevels(env, auth.session.merchantId, item.productId);
        const level = levels.find((entry) => entry.locationId === location.id);
        await upsertInventoryLevel(env, auth.session.merchantId, item.productId, location.id, Number(level?.available || 0) + item.receiveQuantity);
        if (item.variantId) await dbRun(env, `UPDATE product_variants SET inventory_on_hand = inventory_on_hand + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [item.receiveQuantity, item.variantId, auth.session.merchantId]);
      }
    }
    await dbRun(env, `UPDATE purchase_orders SET status = ?, received_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE received_at END, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [receipt.complete ? 'received' : 'partial', receipt.complete ? 1 : 0, purchaseOrderId, auth.session.merchantId]);
    await audit(env, auth.session.merchantId, 'purchase_order.received', `Received ${receipt.receivedUnits} units`, 'purchase_order', purchaseOrderId, { complete: receipt.complete }, auth.session);
    return json({ ok: true, receipt, purchaseOrder: await getPurchaseOrder(env, auth.session.merchantId, purchaseOrderId) });
  }

  if (request.method === 'GET' && url.pathname === '/api/customer-segments') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, segments: await listCustomerSegments(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/customer-segments') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeCustomerSegmentInput(await readJson(request) || {});
    const id = uid('seg');
    await dbRun(env, `INSERT INTO customer_segments (id, merchant_id, name, segment_key, rules_json, active) VALUES (?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.name, payload.key, JSON.stringify(payload.rules), payload.active ? 1 : 0]);
    return json({ ok: true, segment: customerSegmentRecord(await dbFirst(env, `SELECT * FROM customer_segments WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/price-lists') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, priceLists: await listPriceLists(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/price-lists') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizePriceListInput(await readJson(request) || {});
    const id = uid('prl');
    await dbRun(env, `INSERT INTO price_lists (id, merchant_id, name, segment_id, currency, active) VALUES (?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.name, payload.segmentId || null, payload.currency, payload.active ? 1 : 0]);
    for (const item of payload.items) await dbRun(env, `INSERT INTO price_list_items (id, merchant_id, price_list_id, product_id, variant_id, adjustment_type, adjustment_bps, price_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [uid('pli'), auth.session.merchantId, id, item.productId, item.variantId, item.adjustmentType, item.adjustmentBps, item.priceCents]);
    return json({ ok: true, priceList: (await listPriceLists(env, auth.session.merchantId)).find((entry) => entry.id === id) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/staff/roles') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, roles: await listStaffRoles(env, auth.session.merchantId), permissionCheckExample: hasStaffPermission({ effectivePermissions: ['orders:*'] }, 'orders:write') });
  }

  if (request.method === 'POST' && url.pathname === '/api/staff/roles') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeStaffRoleInput(await readJson(request) || {});
    const id = uid('role');
    await dbRun(env, `INSERT INTO staff_roles (id, merchant_id, role_key, name, permissions_json, active) VALUES (?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.key, payload.name, JSON.stringify(payload.permissions), payload.active ? 1 : 0]);
    return json({ ok: true, role: staffRoleRecord(await dbFirst(env, `SELECT * FROM staff_roles WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/staff/members') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, members: await listStaffMembers(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/staff/members') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const rawBody = await readJson(request) || {};
    const payload = normalizeStaffMemberInput(rawBody);
    if (!payload.email) return json({ error: 'email is required.' }, 400);
    const id = uid('stm');
    const passwordHash = rawBody.password ? await hashPassword(payload.email, rawBody.password) : '';
    await dbRun(env, `INSERT INTO staff_members (id, merchant_id, role_id, email, name, status, permissions_json, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.roleId || null, payload.email, payload.name, payload.status, JSON.stringify(payload.permissions), passwordHash]);
    return json({ ok: true, member: (await listStaffMembers(env, auth.session.merchantId)).find((entry) => entry.id === id) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/staff/invitations') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, invitations: await listStaffInvitations(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/staff/invitations') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeStaffInvitationInput(await readJson(request) || {});
    if (!payload.email) return json({ error: 'email is required.' }, 400);
    const rawToken = uid('invite');
    const id = uid('inv');
    await dbRun(env, `INSERT INTO staff_invitations (id, merchant_id, role_id, email, name, token_hash, status, permissions_json, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.roleId || null, payload.email, payload.name, await sha256Hex(rawToken), payload.status, JSON.stringify(payload.permissions), payload.expiresAt]);
    return json({ ok: true, invitation: staffInvitationRecord(await dbFirst(env, `SELECT * FROM staff_invitations WHERE id = ? LIMIT 1`, [id])), inviteToken: rawToken }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/pos/registers') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, registers: await listPosRegisters(env, auth.session.merchantId), shifts: await listPosShifts(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/pos/registers') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeRegisterInput(await readJson(request) || {});
    const id = uid('reg');
    await dbRun(env, `INSERT INTO pos_registers (id, merchant_id, location_id, name, status, cash_drawer_cents, active) VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.locationId || null, payload.name, payload.status, payload.cashDrawerCents, payload.active ? 1 : 0]);
    return json({ ok: true, register: registerRecord(await dbFirst(env, `SELECT * FROM pos_registers WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  const posShiftOpenMatch = url.pathname.match(/^\/api\/pos\/registers\/([^/]+)\/shifts\/open$/);
  if (posShiftOpenMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const registerId = decodeURIComponent(posShiftOpenMatch[1]);
    const register = registerRecord(await dbFirst(env, `SELECT * FROM pos_registers WHERE id = ? AND merchant_id = ? LIMIT 1`, [registerId, auth.session.merchantId]));
    if (!register) return json({ error: 'Register not found.' }, 404);
    const payload = normalizeShiftOpenInput(await readJson(request) || {}, register);
    const id = uid('shift');
    await dbRun(env, `INSERT INTO pos_shifts (id, merchant_id, register_id, staff_member_id, status, opening_cash_cents, cash_expected_cents, note) VALUES (?, ?, ?, ?, 'open', ?, ?, ?)`, [id, auth.session.merchantId, register.id, payload.staffMemberId || null, payload.openingCashCents, payload.openingCashCents, payload.note]);
    await dbRun(env, `UPDATE pos_registers SET status = 'open', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [register.id, auth.session.merchantId]);
    return json({ ok: true, shift: shiftRecord(await dbFirst(env, `SELECT * FROM pos_shifts WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  const posShiftCloseMatch = url.pathname.match(/^\/api\/pos\/shifts\/([^/]+)\/close$/);
  if (posShiftCloseMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const shiftId = decodeURIComponent(posShiftCloseMatch[1]);
    const shift = shiftRecord(await dbFirst(env, `SELECT * FROM pos_shifts WHERE id = ? AND merchant_id = ? LIMIT 1`, [shiftId, auth.session.merchantId]));
    if (!shift) return json({ error: 'Shift not found.' }, 404);
    const payload = normalizeShiftCloseInput(await readJson(request) || {});
    const cashSales = await dbFirst(env, `SELECT COALESCE(SUM(total_cents), 0) AS cash_total FROM pos_carts WHERE merchant_id = ? AND shift_id = ? AND status = 'paid' AND tenders_json LIKE '%"type":"cash"%'`, [auth.session.merchantId, shift.id]);
    const expected = Number(shift.openingCashCents || 0) + Number(cashSales?.cash_total || 0);
    await dbRun(env, `UPDATE pos_shifts SET status = 'closed', closing_cash_cents = ?, cash_expected_cents = ?, cash_variance_cents = ?, closed_at = CURRENT_TIMESTAMP, note = ? WHERE id = ? AND merchant_id = ?`, [payload.closingCashCents, expected, payload.closingCashCents - expected, payload.note, shift.id, auth.session.merchantId]);
    await dbRun(env, `UPDATE pos_registers SET status = 'active', cash_drawer_cents = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [payload.closingCashCents, shift.registerId, auth.session.merchantId]);
    return json({ ok: true, shift: shiftRecord(await dbFirst(env, `SELECT * FROM pos_shifts WHERE id = ? LIMIT 1`, [shift.id])) });
  }

  if (request.method === 'GET' && url.pathname === '/api/pos/carts') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, carts: await listPosCarts(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/pos/carts') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizePosCartInput(await readJson(request) || {});
    if (!payload.items.length) return json({ error: 'At least one cart item is required.' }, 400);
    const id = uid('cart');
    await dbRun(env, `INSERT INTO pos_carts (id, merchant_id, register_id, shift_id, customer_id, status, currency, subtotal_cents, discount_cents, tax_cents, total_cents, items_json, tenders_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.registerId || null, payload.shiftId || null, payload.customerId || null, payload.status, payload.currency, payload.subtotalCents, payload.discountCents, payload.taxCents, payload.totalCents, JSON.stringify(payload.items), JSON.stringify(payload.tenders)]);
    return json({ ok: true, cart: await getPosCart(env, auth.session.merchantId, id) }, 201);
  }

  const posCartCheckoutMatch = url.pathname.match(/^\/api\/pos\/carts\/([^/]+)\/checkout$/);
  if (posCartCheckoutMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const cartId = decodeURIComponent(posCartCheckoutMatch[1]);
    const cart = await getPosCart(env, auth.session.merchantId, cartId);
    if (!cart) return json({ error: 'POS cart not found.' }, 404);
    const body = await readJson(request) || {};
    const receipt = buildPosCheckoutReceipt(cart, body.tenders || cart.tenders || []);
    if (!receipt.paid) return json({ error: 'Tendered amount does not cover cart total.', receipt }, 409);
    const merchant = merchantRecord(await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [auth.session.merchantId]));
    const orderId = uid('ord');
    const orderNumber = `POS-${String(Date.now()).slice(-8)}`;
    const receiptNumber = `RCT-${orderNumber.slice(-8)}`;
    await dbRun(env, `INSERT INTO orders (id, merchant_id, customer_id, order_number, status, payment_status, payment_reference, currency, customer_name, customer_email, shipping_address_json, subtotal_cents, discount_code, discount_cents, shipping_cents, tax_cents, total_cents, items_json, notes) VALUES (?, ?, ?, ?, 'fulfilled', 'paid', ?, ?, ?, ?, '{}', ?, '', ?, 0, ?, ?, ?, ?)`, [orderId, auth.session.merchantId, cart.customerId || null, orderNumber, receiptNumber, cart.currency || merchant.currency || 'USD', body.customerName || 'POS Customer', body.customerEmail || '', cart.subtotalCents, cart.discountCents, cart.taxCents, cart.totalCents, JSON.stringify(cart.items), body.notes || 'POS checkout']);
    await dbRun(env, `INSERT INTO payment_transactions (id, merchant_id, order_id, provider, provider_reference, checkout_token, status, amount_cents, currency, payload_json, captured_at) VALUES (?, ?, ?, ?, ?, ?, 'captured', ?, ?, ?, CURRENT_TIMESTAMP)`, [uid('pay'), auth.session.merchantId, orderId, receipt.tenders[0]?.type || 'pos', receiptNumber, uid('poschk'), cart.totalCents, cart.currency || merchant.currency || 'USD', JSON.stringify(receipt)]);
    for (const item of cart.items) if (item.productId) await allocateProductInventory(env, auth.session.merchantId, item.productId, item.quantity, orderId);
    await dbRun(env, `UPDATE pos_carts SET status = 'paid', tenders_json = ?, receipt_number = ?, order_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [JSON.stringify(receipt.tenders), receiptNumber, orderId, cart.id, auth.session.merchantId]);
    await appendOrderEvent(env, orderId, { kind: 'pos_checkout', summary: `POS receipt ${receiptNumber} captured`, status: 'fulfilled', paymentStatus: 'paid', detail: JSON.stringify(receipt) });
    await audit(env, auth.session.merchantId, 'pos.checkout', `POS checkout ${receiptNumber} captured`, 'order', orderId, { cartId: cart.id, totalCents: cart.totalCents }, auth.session);
    return json({ ok: true, receipt: { ...receipt, receiptNumber, orderNumber, orderId }, cart: await getPosCart(env, auth.session.merchantId, cart.id) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/refunds') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, refunds: await listMerchantRefunds(env, auth.session.merchantId) });
  }

  const orderRefundsMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/refunds$/);
  if (orderRefundsMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const orderId = decodeURIComponent(orderRefundsMatch[1]);
    const order = await getOrderDetails(env, orderId, auth.session.merchantId);
    if (!order) return json({ error: 'Order not found.' }, 404);
    const priorRefunds = await sumOrderRefunds(env, auth.session.merchantId, orderId);
    const rawRefundBody = await readJson(request) || {};
    const payload = normalizeRefundRequestInput(rawRefundBody, order);
    const preview = buildRefundPreview(order, priorRefunds, payload);
    if (!preview.valid) return json({ error: 'Refund amount exceeds available refundable balance or is zero.', preview }, 409);
    const id = uid('rfnd');
    const refundNumber = `RF-${String(Date.now()).slice(-8)}`;
    let providerDispatch = {};
    let status = payload.status === 'pending' && payload.provider === 'manual' ? 'succeeded' : payload.status;
    if (Object.prototype.hasOwnProperty.call(rawRefundBody, 'simulate')) {
      return json({ error: 'Non-live refund flags are not accepted in the production package.', code: 'REFUND_NONLIVE_FLAGS_REMOVED' }, 400);
    }
    const digitalPayment = (order.payments || []).find((item) => ['stripe', 'paypal'].includes(item.provider) && item.providerReference) || null;
    if (payload.provider === 'manual' && digitalPayment) {
      return json({ error: `Order was paid through ${digitalPayment.provider}; use live ${digitalPayment.provider} refund submission instead of manual refund recording.`, code: 'LIVE_REFUND_PROVIDER_REQUIRED' }, 409);
    }
    if (['stripe', 'paypal'].includes(payload.provider)) {
      const connection = await resolveProviderConnection(env, auth.session.merchantId, payload.provider, rawRefundBody.providerConnectionId || rawRefundBody.connectionId || '');
      if (!connection) return json({ error: `No active ${payload.provider} provider connection found for this merchant refund.` }, 409);
      const payment = (order.payments || []).find((item) => item.provider === payload.provider && item.providerReference) || {};
      const providerRef = payload.providerRef || payment.providerReference || order.paymentReference || '';
      if (!providerRef) return json({ error: `A live ${payload.provider} provider reference is required before a refund can be submitted.`, code: 'REFUND_PROVIDER_REFERENCE_REQUIRED' }, 409);
      try {
        providerDispatch = await executeProviderRefund(connection, { refund: { ...payload, id, refundNumber, amountCents: preview.approvedCents, providerRef }, payment, order }, env);
        if (providerDispatch.status !== 'executed') return json({ error: `${payload.provider} refund submission failed.`, result: providerDispatch }, 502);
        status = 'succeeded';
      } catch (error) {
        return json({ error: error.message, code: error.code || 'REFUND_SUBMISSION_FAILED', missing: error.missing || [] }, error.code === 'PROVIDER_SECRETS_MISSING' ? 409 : 502);
      }
    }
    await dbRun(env, `INSERT INTO refunds (id, merchant_id, order_id, refund_number, amount_cents, currency, provider, provider_ref, reason, status, note, restock, items_json, provider_dispatch_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, order.id, refundNumber, preview.approvedCents, order.currency || 'USD', payload.provider, payload.providerRef || providerDispatch.providerReference || refundNumber, payload.reason, status, payload.note, payload.restock ? 1 : 0, JSON.stringify(payload.items), JSON.stringify(providerDispatch)]);
    if (payload.restock) for (const item of payload.items) if (item.productId) await restockProductInventory(env, auth.session.merchantId, item.productId, item.quantity);
    if (preview.completeRefund) await dbRun(env, `UPDATE orders SET payment_status = 'refunded' WHERE id = ? AND merchant_id = ?`, [order.id, auth.session.merchantId]);
    await appendOrderEvent(env, order.id, { kind: 'refund_created', summary: `Refund ${refundNumber} ${status}`, status: order.status, paymentStatus: preview.completeRefund ? 'refunded' : order.paymentStatus, detail: `${preview.approvedCents} cents refunded through ${payload.provider}` });
    await audit(env, auth.session.merchantId, 'refund.created', `Refund ${refundNumber} created`, 'refund', id, { amountCents: preview.approvedCents, orderId: order.id }, auth.session);
    await queueWebhookEvent(env, auth.session.merchantId, 'refund.created', { refund: refundRecord(await dbFirst(env, `SELECT * FROM refunds WHERE id = ? LIMIT 1`, [id])), orderId: order.id });
    return json({ ok: true, refund: refundRecord(await dbFirst(env, `SELECT * FROM refunds WHERE id = ? LIMIT 1`, [id])), preview }, 201);
  }


  if (request.method === 'GET' && url.pathname === '/api/checkouts') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, checkouts: await listMerchantCheckouts(env, auth.session.merchantId, url.searchParams.get('status') || '') });
  }


  if (request.method === 'POST' && url.pathname === '/api/checkouts') {
    const body = normalizeCheckoutInput(await readJson(request) || {});
    const merchant = await dbFirst(env, `SELECT * FROM merchants WHERE slug = ? LIMIT 1`, [slugify(body.slug || '')]);
    if (!merchant) return json({ error: 'Store not found.' }, 404);
    const customer = await resolveCustomerSessionForMerchant(request, env, merchant.id);
    const [shippingProfiles, taxProfiles, discountCodes] = await Promise.all([
      listMerchantShipping(env, merchant.id),
      listMerchantTaxes(env, merchant.id),
      listMerchantDiscountCodes(env, merchant.id)
    ]);
    const quoteItems = [];
    const storedItems = [];
    for (const entry of body.items) {
      const product = await dbFirst(env, `SELECT * FROM products WHERE id = ? AND merchant_id = ? LIMIT 1`, [entry.productId, merchant.id]);
      if (!product) continue;
      const productView = productRecord(product);
      const variants = await getProductVariants(env, merchant.id, product.id);
      const sellable = resolveSellableVariant(productView, variants, entry);
      quoteItems.push({ productId: product.id, variantId: sellable.variantId || '', unitPriceCents: sellable.unitPriceCents, quantity: entry.quantity });
      storedItems.push({ ...entry, variantId: sellable.variantId || '', title: product.title, variantTitle: sellable.title, optionLabel: sellable.optionLabel, sku: sellable.sku, unitPriceCents: sellable.unitPriceCents });
    }
    if (!storedItems.length) return json({ error: 'At least one valid checkout item is required.' }, 400);
    const quote = computeOrderQuote(quoteItems, shippingProfiles, taxProfiles, body.shippingAddress || {}, body.shippingCode || '', body.discountCode || '', discountCodes);
    const id = uid('chk');
    await dbRun(env, `
      INSERT INTO checkout_sessions (id, merchant_id, customer_id, customer_email, customer_name, source, status, items_json, shipping_address_json, quote_json, subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents, meta_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, merchant.id, customer?.id || body.customerId || null, body.customerEmail || customer?.email || '', body.customerName || buildCustomerDisplayName(customer || {}), body.source, body.status, JSON.stringify(storedItems), JSON.stringify(body.shippingAddress || {}), JSON.stringify(quote), quote.subtotalCents, quote.discountCents, quote.shippingCents, quote.taxCents, quote.totalCents, JSON.stringify(body.metadata || {})]);
    await queueWebhookEvent(env, merchant.id, 'checkout.created', { checkoutId: id, totalCents: quote.totalCents, customerEmail: body.customerEmail || customer?.email || '' });
    return json({ ok: true, checkout: await getCheckoutSession(env, merchant.id, id), checkoutUrl: `${publicBaseUrl(env, url)}/store/index.html?slug=${merchant.slug}&checkout=${id}` }, 201);
  }

  const checkoutRecoverMatch = url.pathname.match(/^\/api\/checkouts\/([^/]+)\/recover$/);
  if (checkoutRecoverMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const checkoutId = decodeURIComponent(checkoutRecoverMatch[1]);
    const checkout = await getCheckoutSession(env, auth.session.merchantId, checkoutId);
    if (!checkout) return json({ error: 'Checkout not found.' }, 404);
    if (!checkout.customerEmail) return json({ error: 'Checkout has no recoverable customer email.' }, 400);
    const merchantRow = await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [auth.session.merchantId]);
    const merchant = merchantRecord(merchantRow);
    const notification = buildCheckoutRecoveryNotification({ merchant, checkout, storefrontUrl: `${publicBaseUrl(env, url)}/store/index.html?slug=${merchant.slug}&checkout=${checkout.id}` });
    const notificationId = await queueNotification(env, { merchantId: auth.session.merchantId, customerId: checkout.customerId || null, channel: notification.channel, templateKey: notification.templateKey, recipient: notification.recipient, subject: notification.subject, bodyText: notification.bodyText, meta: notification.meta });
    await dbRun(env, `UPDATE checkout_sessions SET status = 'abandoned', recovery_count = recovery_count + 1, last_recovered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [checkout.id, auth.session.merchantId]);
    await audit(env, auth.session.merchantId, 'checkout.recovery_queued', `Recovery queued for checkout ${checkout.id}`, 'checkout', checkout.id, { notificationId }, auth.session);
    await queueWebhookEvent(env, auth.session.merchantId, 'checkout.recovery_queued', { checkoutId: checkout.id, notificationId });
    return json({ ok: true, notificationId, checkout: await getCheckoutSession(env, auth.session.merchantId, checkout.id) });
  }

  if (request.method === 'GET' && url.pathname === '/api/gift-cards') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, giftCards: await listMerchantGiftCards(env, auth.session.merchantId), ledger: await listGiftCardLedger(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/gift-cards') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = normalizeGiftCardIssueInput(await readJson(request) || {});
    if (!body.code || !body.balanceCents) return json({ error: 'code and balanceCents are required.' }, 400);
    const codeHash = await hashGiftCardCode(env.GIFT_CARD_SECRET || env.SESSION_SECRET || '', body.code);
    const id = uid('gft');
    await dbRun(env, `INSERT INTO gift_cards (id, merchant_id, code_hash, code_last4, customer_email, initial_balance_cents, balance_cents, currency, note, active, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, codeHash, body.code.slice(-4), body.customerEmail, body.initialBalanceCents, body.balanceCents, body.currency, body.note, body.active ? 1 : 0, body.expiresAt]);
    await dbRun(env, `INSERT INTO gift_card_ledger (id, merchant_id, gift_card_id, kind, amount_cents, balance_after_cents, note) VALUES (?, ?, ?, 'issued', ?, ?, ?)`, [uid('gcl'), auth.session.merchantId, id, body.balanceCents, body.balanceCents, body.note || 'Gift card issued']);
    await audit(env, auth.session.merchantId, 'gift_card.issued', `Gift card issued for ${body.balanceCents} cents`, 'gift_card', id, { codeLast4: body.code.slice(-4) }, auth.session);
    return json({ ok: true, giftCard: giftCardRecord(await dbFirst(env, `SELECT * FROM gift_cards WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'POST' && url.pathname === '/api/gift-cards/redeem-preview') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    const card = await findGiftCardByCode(env, auth.session.merchantId, body.code || '');
    if (!card) return json({ ok: false, error: 'Gift card not found.' }, 404);
    return json({ ok: true, redemption: previewGiftCardRedemption(card, Number(body.requestedCents || 0)), giftCard: card });
  }

  if (request.method === 'GET' && url.pathname === '/api/risk/assessments') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, assessments: await listRiskAssessments(env, auth.session.merchantId) });
  }

  if (request.method === 'GET' && url.pathname === '/api/webhooks/endpoints') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, endpoints: await listWebhookEndpoints(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/webhooks/endpoints') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = normalizeWebhookEndpointInput(await readJson(request) || {});
    if (!body.url || !/^https:\/\//i.test(body.url)) return json({ error: 'A secure https webhook url is required.' }, 400);
    const id = uid('whk');
    const secretHash = body.secret ? await sha256Hex(body.secret) : '';
    const secretCipher = body.secret ? await encryptProviderConfig(env, { secret: body.secret }) : null;
    await dbRun(env, `
      INSERT INTO webhook_endpoints (id, merchant_id, name, url, events_json, secret_hash, secret_preview, secret_cipher_json, headers_json, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, auth.session.merchantId, body.name, body.url, JSON.stringify(body.events), secretHash, body.secret ? body.secret.slice(-6) : '', secretCipher ? JSON.stringify(secretCipher) : '', JSON.stringify(body.headers), body.active ? 1 : 0]);
    await audit(env, auth.session.merchantId, 'webhook.created', `Webhook endpoint created: ${body.name}`, 'webhook_endpoint', id, { events: body.events }, auth.session);
    return json({ ok: true, endpoint: webhookEndpointRecord(await dbFirst(env, `SELECT * FROM webhook_endpoints WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/webhooks/deliveries') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, deliveries: await listWebhookDeliveries(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/webhooks/test') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    const ids = await queueWebhookEvent(env, auth.session.merchantId, body.eventType || 'system.validation', { message: 'Webhook validation event', validation: true });
    return json({ ok: true, queued: ids.length, deliveryIds: ids }, 201);
  }

  if (request.method === 'POST' && url.pathname === '/api/webhooks/dispatch') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const result = await dispatchWebhookDeliveries(env, auth.session.merchantId, Number(url.searchParams.get('limit') || 25));
    return json({ ok: result.failed === 0, result });
  }

  if (request.method === 'GET' && url.pathname === '/api/audit-events') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, events: await listAuditEvents(env, auth.session.merchantId) });
  }

  if (request.method === 'GET' && url.pathname === '/api/tax-nexus/rules') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, rules: await listMerchantTaxNexusRules(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/tax-nexus/rules') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeTaxNexusRuleInput(await readJson(request) || {});
    const id = uid('nexus');
    await dbRun(env, `
      INSERT INTO tax_nexus_rules (id, merchant_id, label, country_code, state_code, threshold_cents, threshold_orders, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, auth.session.merchantId, payload.label, payload.countryCode, payload.stateCode, payload.thresholdCents, payload.thresholdOrders, payload.active ? 1 : 0]);
    return json({ ok: true, rule: taxNexusRuleRecord(await dbFirst(env, `SELECT * FROM tax_nexus_rules WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/tax-nexus/rollups') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, rollups: await listMerchantTaxNexusRollups(env, auth.session.merchantId) });
  }

  if (request.method === 'GET' && url.pathname === '/api/notifications') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, notifications: await listMerchantNotifications(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/notifications/dispatch') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    const dispatched = await dispatchQueuedNotifications(env, auth.session.merchantId, Math.max(1, Number(body.limit || 25) || 25));
    return json({ ok: true, dispatched, notifications: await listMerchantNotifications(env, auth.session.merchantId) });
  }

  if (request.method === 'GET' && url.pathname === '/api/provider-connections') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, connections: await listMerchantProviderConnections(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/provider-connections') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeProviderConnectionInput(await readJson(request) || {});
    const id = uid('pcon');
    const encryptedConfig = await encryptProviderConfig(env, payload.config || {});
    await dbRun(env, `
      INSERT INTO provider_connections (id, merchant_id, name, provider, environment, account_label, endpoint_base, config_json, config_encrypted, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, auth.session.merchantId, payload.name, payload.provider, payload.environment, payload.accountLabel, payload.endpointBase, JSON.stringify(encryptedConfig), 1, payload.active ? 1 : 0]);
    return json({ ok: true, connection: await toProviderConnectionRecord(env, await dbFirst(env, `SELECT * FROM provider_connections WHERE id = ? AND merchant_id = ? LIMIT 1`, [id, auth.session.merchantId]), { exposeConfig: false }) }, 201);
  }

  if (request.method === 'POST' && url.pathname === '/api/provider-connections/preview') {
    return json({ error: 'Provider preview route has been removed from the production package.' }, 404);
  }

  if (request.method === 'POST' && url.pathname === '/api/provider-connections/health') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    const connection = body.connectionId ? await getMerchantProviderConnection(env, auth.session.merchantId, String(body.connectionId)) : providerConnectionRecord(normalizeProviderConnectionInput(body.connection || body));
    if (!connection) return json({ error: 'Provider connection not found.' }, 404);
    try {
      const result = await executeProviderHealth(connection, env);
      return json({ ok: result.status === 'executed', connection, result });
    } catch (error) {
      return json({ error: error.message, code: error.code || 'PROVIDER_HEALTH_FAILED', missing: error.missing || [] }, error.code === 'PROVIDER_SECRETS_MISSING' ? 409 : 502);
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/provider-connections/validate-all') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const connections = (await listMerchantProviderConnections(env, auth.session.merchantId)).filter((connection) => connection.active);
    if (!connections.length) return json({ error: 'No active provider connections found.' }, 404);
    const results = [];
    for (const connection of connections) {
      try {
        const result = await executeProviderHealth(connection, env);
        const run = await recordProviderValidationRun(env, auth.session.merchantId, connection.id, connection.provider, 'connection_health', result, [], '');
        results.push({ connectionId: connection.id, provider: connection.provider, ok: result.status === 'executed', result, validation: run });
      } catch (error) {
        const run = await recordProviderValidationRun(env, auth.session.merchantId, connection.id, connection.provider, 'connection_health', {}, error.missing || [], error.message || 'Provider validation failed.');
        results.push({ connectionId: connection.id, provider: connection.provider, ok: false, error: error.message, code: error.code || 'PROVIDER_VALIDATION_FAILED', missing: error.missing || [], validation: run });
      }
    }
    const ok = results.every((row) => row.ok);
    await audit(env, auth.session.merchantId, ok ? 'provider.validation_all' : 'provider.validation_all_failed', `Validated ${results.length} provider connection health check(s)`, 'provider_connection', '', { total: results.length, passed: results.filter((row) => row.ok).length, failed: results.filter((row) => !row.ok).length }, auth.session);
    return json({ ok, summary: { total: results.length, passed: results.filter((row) => row.ok).length, failed: results.filter((row) => !row.ok).length }, results }, ok ? 200 : 409);
  }

  if (request.method === 'GET' && url.pathname === '/api/provider-validations') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, validations: await listProviderValidationRuns(env, auth.session.merchantId) });
  }

  const providerValidateMatch = url.pathname.match(/^\/api\/provider-connections\/([^/]+)\/validate$/);
  if (providerValidateMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const connectionId = decodeURIComponent(providerValidateMatch[1]);
    const connection = await getMerchantProviderConnection(env, auth.session.merchantId, connectionId);
    if (!connection) return json({ error: 'Provider connection not found.' }, 404);
    try {
      const result = await executeProviderHealth(connection, env);
      const run = await recordProviderValidationRun(env, auth.session.merchantId, connection.id, connection.provider, 'connection_health', result, [], '');
      await audit(env, auth.session.merchantId, 'provider.validation', `Provider validation ${run.status}: ${connection.provider}`, 'provider_connection', connection.id, { validationRunId: run.id, httpStatus: run.httpStatus }, auth.session);
      return json({ ok: result.status === 'executed', connection, result, validation: run }, result.status === 'executed' ? 200 : 502);
    } catch (error) {
      const run = await recordProviderValidationRun(env, auth.session.merchantId, connection.id, connection.provider, 'connection_health', {}, error.missing || [], error.message || 'Provider validation failed.');
      await audit(env, auth.session.merchantId, 'provider.validation_failed', `Provider validation failed: ${connection.provider}`, 'provider_connection', connection.id, { validationRunId: run.id, missing: run.missing, error: run.error }, auth.session);
      return json({ error: error.message, code: error.code || 'PROVIDER_VALIDATION_FAILED', missing: error.missing || [], validation: run }, error.code === 'PROVIDER_SECRETS_MISSING' ? 409 : 502);
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/provider-connections/dispatch') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    const connection = body.connectionId ? await getMerchantProviderConnection(env, auth.session.merchantId, String(body.connectionId)) : providerConnectionRecord(normalizeProviderConnectionInput(body.connection || body));
    if (!connection) return json({ error: 'Provider connection not found.' }, 404);
    try {
      const result = await executeNativeProviderDispatch(connection, body.payload || body, env);
      return json({ ok: result.status === 'executed', connection, result });
    } catch (error) {
      return json({ error: error.message, code: error.code || 'PROVIDER_DISPATCH_FAILED', missing: error.missing || [] }, error.code === 'PROVIDER_SECRETS_MISSING' ? 409 : 502);
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/payments/transactions') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, transactions: await listMerchantPaymentTransactions(env, auth.session.merchantId) });
  }

  if (request.method === 'GET' && url.pathname === '/api/carrier-profiles') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, carrierProfiles: await listMerchantCarrierProfiles(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/carrier-profiles') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeCarrierProfileInput(await readJson(request) || {});
    if (!payload.name) return json({ error: 'name is required.' }, 400);
    const carrierPolicy = enforceCarrierProviderPolicy(payload.provider, env);
    if (!carrierPolicy.ok) return json({ error: carrierPolicy.message, code: carrierPolicy.code, blockers: carrierPolicy.blockers }, 409);
    const id = uid('car');
    await dbRun(env, `
      INSERT INTO carrier_profiles (id, merchant_id, name, provider, account_label, enabled, services_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, auth.session.merchantId, payload.name, payload.provider, payload.accountLabel, payload.enabled ? 1 : 0, JSON.stringify(payload.services || [])]);
    return json({ ok: true, carrierProfile: carrierProfileRecord(await dbFirst(env, `SELECT * FROM carrier_profiles WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/sales-channels') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, channels: await listMerchantSalesChannels(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/sales-channels') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeSalesChannelInput(await readJson(request) || {});
    if (!payload.name) return json({ error: 'name is required.' }, 400);
    const channelPolicy = enforceChannelProviderPolicy(payload.type, env);
    if (!channelPolicy.ok) return json({ error: channelPolicy.message, code: channelPolicy.code, blockers: channelPolicy.blockers }, 409);
    const id = uid('chn');
    await dbRun(env, `
      INSERT INTO sales_channels (id, merchant_id, name, type, destination_url, format, config_json, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, auth.session.merchantId, payload.name, payload.type, payload.destinationUrl, payload.format, JSON.stringify(payload.config || {}), payload.active ? 1 : 0]);
    return json({ ok: true, channel: salesChannelRecord(await dbFirst(env, `SELECT * FROM sales_channels WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/channel-sync-jobs') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, jobs: await listMerchantChannelSyncJobs(env, auth.session.merchantId) });
  }

  const salesChannelSyncMatch = url.pathname.match(/^\/api\/sales-channels\/([^/]+)\/sync$/);
  if (salesChannelSyncMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const channelId = decodeURIComponent(salesChannelSyncMatch[1]);
    const channel = await dbFirst(env, `SELECT * FROM sales_channels WHERE id = ? AND merchant_id = ? LIMIT 1`, [channelId, auth.session.merchantId]);
    if (!channel) return json({ error: 'Sales channel not found.' }, 404);
    const merchant = await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [auth.session.merchantId]);
    const [products, shipping, taxes, discounts, collections, pages, navigation] = await Promise.all([
      listMerchantProducts(env, auth.session.merchantId),
      listMerchantShipping(env, auth.session.merchantId),
      listMerchantTaxes(env, auth.session.merchantId),
      listMerchantDiscountCodes(env, auth.session.merchantId),
      listMerchantCollections(env, auth.session.merchantId),
      listMerchantPages(env, auth.session.merchantId),
      listMerchantNavigation(env, auth.session.merchantId)
    ]);
    const snapshot = buildStorefrontSnapshot(merchantRecord(merchant), products, shipping, taxes, discounts, collections, pages, navigation);
    const channelRecord = salesChannelRecord(channel);
    const channelPolicy = enforceChannelProviderPolicy(channelRecord.type, env);
    if (!channelPolicy.ok) return json({ error: channelPolicy.message, code: channelPolicy.code, blockers: channelPolicy.blockers }, 409);
    const exportPayload = buildChannelCatalogExport({ merchant: merchantRecord(merchant), channel: channelRecord, products, collections, pages, navigation, snapshot });
    let result = buildChannelSyncDispatch(channelRecord, exportPayload);
    if (['google_merchant', 'meta_catalog', 'tiktok_catalog'].includes(channelRecord.type)) {
      const connection = await resolveProviderConnection(env, auth.session.merchantId, channelRecord.type, channelRecord.config?.providerConnectionId || '');
      if (!connection) return json({ error: `No active ${channelRecord.type} provider connection found for this merchant.` }, 409);
      try {
        const providerDispatch = await executeNativeProviderDispatch(connection, { exportPayload }, env);
        result = { ...result, status: providerDispatch.status === 'executed' ? 'executed' : 'failed', providerDispatch };
      } catch (error) {
        result = { ...result, status: 'failed', error: error.message, code: error.code || 'CHANNEL_PROVIDER_FAILED', missing: error.missing || [] };
      }
    }
    const id = uid('job');
    await dbRun(env, `
      INSERT INTO channel_sync_jobs (id, merchant_id, sales_channel_id, status, export_json, result_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, auth.session.merchantId, channelId, result.status, JSON.stringify(exportPayload), JSON.stringify(result)]);
    return json({ ok: true, job: channelSyncJobRecord(await dbFirst(env, `SELECT * FROM channel_sync_jobs WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/subscription-plans') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, plans: await listMerchantSubscriptionPlans(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/subscription-plans') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeSubscriptionPlanInput(await readJson(request) || {});
    if (!payload.name) return json({ error: 'name is required.' }, 400);
    const id = uid('plan');
    await dbRun(env, `
      INSERT INTO subscription_plans (id, merchant_id, name, code, amount_cents, currency, interval_unit, interval_count, trial_days, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, auth.session.merchantId, payload.name, payload.code, payload.amountCents, payload.currency, payload.intervalUnit, payload.intervalCount, payload.trialDays, payload.active ? 1 : 0]);
    return json({ ok: true, plan: subscriptionPlanRecord(await dbFirst(env, `SELECT * FROM subscription_plans WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/subscriptions') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, subscriptions: await listMerchantSubscriptions(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/subscriptions') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    const plan = await dbFirst(env, `SELECT * FROM subscription_plans WHERE id = ? AND merchant_id = ? LIMIT 1`, [body.planId, auth.session.merchantId]);
    if (!plan) return json({ error: 'Subscription plan not found.' }, 404);
    const customer = await dbFirst(env, `SELECT * FROM customer_accounts WHERE id = ? AND merchant_id = ? LIMIT 1`, [body.customerId, auth.session.merchantId]);
    if (!customer) return json({ error: 'Customer not found.' }, 404);
    const payload = normalizeSubscriptionCreateInput(body, subscriptionPlanRecord(plan));
    const id = uid('sub');
    await dbRun(env, `
      INSERT INTO customer_subscriptions (id, merchant_id, plan_id, customer_id, status, amount_cents, currency, interval_unit, interval_count, current_period_start, current_period_end, next_charge_at, cancel_at_period_end)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, auth.session.merchantId, plan.id, customer.id, payload.status, payload.amountCents, payload.currency, payload.intervalUnit, payload.intervalCount, payload.currentPeriodStart, payload.currentPeriodEnd, payload.nextChargeAt, payload.cancelAtPeriodEnd ? 1 : 0]);
    return json({ ok: true, subscription: customerSubscriptionRecord(await dbFirst(env, `SELECT * FROM customer_subscriptions WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/subscription-invoices') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, invoices: await listMerchantSubscriptionInvoices(env, auth.session.merchantId) });
  }

  if (request.method === 'GET' && url.pathname === '/api/subscription-dunning-events') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, events: await listMerchantDunningEvents(env, auth.session.merchantId) });
  }

  const subscriptionInvoicePaymentSessionMatch = url.pathname.match(/^\/api\/subscription-invoices\/([^/]+)\/payments\/session$/);
  if (subscriptionInvoicePaymentSessionMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const invoiceId = decodeURIComponent(subscriptionInvoicePaymentSessionMatch[1]);
    const invoice = await dbFirst(env, `SELECT * FROM subscription_invoices WHERE id = ? AND merchant_id = ? LIMIT 1`, [invoiceId, auth.session.merchantId]);
    if (!invoice) return json({ error: 'Subscription invoice not found.' }, 404);
    if ((invoice.status || 'open') === 'paid') return json({ error: 'Subscription invoice already paid.' }, 409);
    const subscription = await dbFirst(env, `SELECT * FROM customer_subscriptions WHERE id = ? AND merchant_id = ? LIMIT 1`, [invoice.subscription_id, auth.session.merchantId]);
    if (!subscription) return json({ error: 'Subscription not found for invoice.' }, 404);
    const merchant = await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [auth.session.merchantId]);
    const payload = normalizeInvoicePaymentSessionInput(await readJson(request) || {}, subscriptionInvoiceRecord(invoice));
    const paymentPolicy = enforcePaymentProviderPolicy(payload.provider, env);
    if (!paymentPolicy.ok) return json({ error: paymentPolicy.message, code: paymentPolicy.code, blockers: paymentPolicy.blockers }, 409);
    const connection = await resolveProviderConnection(env, auth.session.merchantId, payload.provider, payload.providerConnectionId);
    if (!connection) return json({ error: `No active ${payload.provider} provider connection found for this merchant.` }, 409);
    const transactionId = uid('sip');
    const checkoutToken = uid('schk');
    let providerDispatch = null;
    try {
      providerDispatch = await executeNativeProviderDispatch(connection, {
        payment: { amountCents: payload.amountCents, currency: payload.currency, returnUrl: payload.returnUrl, cancelUrl: payload.cancelUrl },
        context: { orderNumber: `SUB-${invoiceId.slice(-6).toUpperCase()}`, origin: buildAbsoluteOrigin(url) }
      }, env);
      if (providerDispatch.status !== 'executed' || !providerDispatch.checkoutUrl) return json({ error: `${payload.provider} checkout failed.`, providerDispatch }, 502);
    } catch (error) {
      return json({ error: error.message, code: error.code || 'PAYMENT_PROVIDER_FAILED', missing: error.missing || [] }, error.code === 'PROVIDER_SECRETS_MISSING' ? 409 : 502);
    }
    await dbRun(env, `
      INSERT INTO subscription_invoice_payments (id, merchant_id, invoice_id, provider, provider_reference, checkout_token, status, amount_cents, currency, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [transactionId, auth.session.merchantId, invoiceId, payload.provider, providerDispatch.providerReference || '', checkoutToken, 'pending', payload.amountCents, payload.currency, JSON.stringify({ ...payload.metadata, subscriptionId: subscription.id, providerConnectionId: payload.providerConnectionId || '', providerDispatch })]);
    const session = buildHostedPaymentSession({
      transactionId,
      checkoutToken,
      provider: payload.provider,
      amountCents: payload.amountCents,
      currency: payload.currency,
      merchantSlug: merchant.slug,
      orderNumber: `SUB-${invoiceId.slice(-6).toUpperCase()}`,
      externalCheckoutUrl: providerDispatch.checkoutUrl,
      providerReference: providerDispatch.providerReference || '',
      returnUrl: payload.returnUrl,
      cancelUrl: payload.cancelUrl
    });
    await recordDunningEvent(env, auth.session.merchantId, subscription.id, invoiceId, 'payment_session_created', `Payment session ${checkoutToken} created`);
    return json({ ok: true, session, payment: paymentTransactionRecord({ id: transactionId, merchant_id: auth.session.merchantId, order_id: '', provider: payload.provider, checkout_token: checkoutToken, status: 'pending', amount_cents: payload.amountCents, currency: payload.currency, payload_json: JSON.stringify({ subscriptionInvoiceId: invoiceId }) }), events: await listMerchantDunningEvents(env, auth.session.merchantId) }, 201);
  }

  const subscriptionInvoiceDunningMatch = url.pathname.match(/^\/api\/subscription-invoices\/([^/]+)\/dunning$/);
  if (subscriptionInvoiceDunningMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const invoiceId = decodeURIComponent(subscriptionInvoiceDunningMatch[1]);
    const invoice = await dbFirst(env, `SELECT * FROM subscription_invoices WHERE id = ? AND merchant_id = ? LIMIT 1`, [invoiceId, auth.session.merchantId]);
    if (!invoice) return json({ error: 'Subscription invoice not found.' }, 404);
    const subscription = await dbFirst(env, `SELECT * FROM customer_subscriptions WHERE id = ? AND merchant_id = ? LIMIT 1`, [invoice.subscription_id, auth.session.merchantId]);
    if (!subscription) return json({ error: 'Subscription not found for invoice.' }, 404);
    const body = await readJson(request) || {};
    await recordDunningEvent(env, auth.session.merchantId, subscription.id, invoiceId, body.stage || 'dunning_sent', body.note || 'Manual reminder queued');
    if ((body.stage || '').toLowerCase() === 'payment_failed' || (body.stage || '').toLowerCase() === 'dunning_sent') {
      await dbRun(env, `UPDATE customer_subscriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, ['past_due', subscription.id, auth.session.merchantId]);
    }
    return json({ ok: true, events: await listMerchantDunningEvents(env, auth.session.merchantId), subscription: customerSubscriptionRecord(await dbFirst(env, `SELECT * FROM customer_subscriptions WHERE id = ? LIMIT 1`, [subscription.id])) });
  }

  const subscriptionMatch = url.pathname.match(/^\/api\/subscriptions\/([^/]+)$/);
  if (subscriptionMatch && request.method === 'PUT') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const id = decodeURIComponent(subscriptionMatch[1]);
    const existing = await dbFirst(env, `SELECT * FROM customer_subscriptions WHERE id = ? AND merchant_id = ? LIMIT 1`, [id, auth.session.merchantId]);
    if (!existing) return json({ error: 'Subscription not found.' }, 404);
    const patch = normalizeSubscriptionPatch(await readJson(request) || {}, customerSubscriptionRecord(existing));
    await dbRun(env, `UPDATE customer_subscriptions SET status = ?, cancel_at_period_end = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [patch.status, patch.cancelAtPeriodEnd ? 1 : 0, id, auth.session.merchantId]);
    return json({ ok: true, subscription: customerSubscriptionRecord(await dbFirst(env, `SELECT * FROM customer_subscriptions WHERE id = ? LIMIT 1`, [id])) });
  }

  const subscriptionRenewMatch = url.pathname.match(/^\/api\/subscriptions\/([^/]+)\/renew$/);
  if (subscriptionRenewMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const id = decodeURIComponent(subscriptionRenewMatch[1]);
    const existing = await dbFirst(env, `SELECT * FROM customer_subscriptions WHERE id = ? AND merchant_id = ? LIMIT 1`, [id, auth.session.merchantId]);
    if (!existing) return json({ error: 'Subscription not found.' }, 404);
    const subscription = customerSubscriptionRecord(existing);
    if (subscription.status === 'cancelled') return json({ error: 'Cancelled subscriptions cannot renew.' }, 409);
    if (subscription.cancelAtPeriodEnd) return json({ error: 'Subscription is marked to cancel at period end.' }, 409);
    const renewal = buildSubscriptionRenewal(subscription);
    const invoiceId = uid('inv');
    await dbRun(env, `
      INSERT INTO subscription_invoices (id, merchant_id, subscription_id, customer_id, order_id, status, amount_cents, currency, period_start, period_end, due_at)
      VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
    `, [invoiceId, auth.session.merchantId, subscription.id, subscription.customerId, renewal.invoice.status, renewal.invoice.amountCents, renewal.invoice.currency, renewal.invoice.periodStart, renewal.invoice.periodEnd, renewal.invoice.dueAt]);
    await dbRun(env, `
      UPDATE customer_subscriptions
      SET status = ?, current_period_start = ?, current_period_end = ?, next_charge_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND merchant_id = ?
    `, ['active', renewal.nextPeriodStart, renewal.nextPeriodEnd, renewal.nextChargeAt, subscription.id, auth.session.merchantId]);
    return json({ ok: true, subscription: customerSubscriptionRecord(await dbFirst(env, `SELECT * FROM customer_subscriptions WHERE id = ? LIMIT 1`, [subscription.id])), invoice: subscriptionInvoiceRecord(await dbFirst(env, `SELECT * FROM subscription_invoices WHERE id = ? LIMIT 1`, [invoiceId])) });
  }

  if (request.method === 'GET' && url.pathname === '/api/provider-smoke/runs') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, runs: await listMerchantProviderSmokeRuns(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/provider-smoke/run') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const connections = await listMerchantProviderConnections(env, auth.session.merchantId);
    const activeConnections = connections.filter((item) => item.active);
    if (!activeConnections.length) return json({ error: 'At least one active provider connection is required for production provider smoke.' }, 409);
    const results = [];
    for (const connection of activeConnections) {
      try {
        const result = await executeProviderHealth(connection, env);
        results.push({ provider: connection.provider, pass: result.status === 'executed', issues: result.status === 'executed' ? [] : ['provider_health_failed'], checks: ['provider_health'], result });
      } catch (error) {
        results.push({ provider: connection.provider, pass: false, issues: [error.code || 'provider_health_failed', ...(error.missing || [])], checks: ['provider_health'], error: error.message });
      }
    }
    const summary = summarizeProviderSmoke(results);
    await recordProviderSmokeRun(env, auth.session.merchantId, 'providers', summary);
    return json({ ok: summary.pass, summary, runs: await listMerchantProviderSmokeRuns(env, auth.session.merchantId) }, summary.pass ? 200 : 502);
  }

  if (request.method === 'POST' && url.pathname === '/api/subscription-invoices/webhook') {
    const raw = await request.text();
    const signature = request.headers.get('x-skye-signature') || '';
    const expected = await hmacHex(env.PAYMENT_WEBHOOK_SECRET || env.SESSION_SECRET, raw);
    if (!signature || signature !== expected) return json({ error: 'Invalid webhook signature.' }, 401);
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch { return json({ error: 'Malformed webhook body.' }, 400); }
    const incoming = normalizePaymentWebhookInput(body);
    if (!incoming.checkoutToken) return json({ error: 'checkoutToken is required.' }, 400);
    const existing = await dbFirst(env, `SELECT * FROM subscription_invoice_payments WHERE checkout_token = ? LIMIT 1`, [incoming.checkoutToken]);
    if (!existing) return json({ error: 'Subscription invoice payment session not found.' }, 404);
    const next = applyPaymentWebhook(existing, incoming);
    await dbRun(env, `
      UPDATE subscription_invoice_payments
      SET provider_reference = ?, status = ?, amount_cents = ?, currency = ?, payload_json = ?, authorized_at = ?, captured_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [incoming.providerReference || existing.provider_reference || '', next.status, next.amountCents, next.currency, JSON.stringify(incoming.raw || {}), next.authorizedAt || null, next.capturedAt || null, existing.id]);
    const invoice = await dbFirst(env, `SELECT * FROM subscription_invoices WHERE id = ? LIMIT 1`, [existing.invoice_id]);
    if (!invoice) return json({ error: 'Subscription invoice not found.' }, 404);
    const subscription = await dbFirst(env, `SELECT * FROM customer_subscriptions WHERE id = ? LIMIT 1`, [invoice.subscription_id]);
    if (!subscription) return json({ error: 'Subscription not found.' }, 404);
    const mapped = applyInvoicePaymentUpdate(invoice, next, subscription);
    await dbRun(env, `UPDATE subscription_invoices SET status = ? WHERE id = ? AND merchant_id = ?`, [mapped.invoiceStatus, invoice.id, existing.merchant_id]);
    await dbRun(env, `UPDATE customer_subscriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [mapped.subscriptionStatus, subscription.id, existing.merchant_id]);
    await recordDunningEvent(env, existing.merchant_id, subscription.id, invoice.id, mapped.dunningStage, incoming.note || incoming.providerReference || mapped.dunningStage);
    return json({ ok: true, payment: { id: existing.id, invoiceId: invoice.id, provider: existing.provider, checkoutToken: existing.checkout_token, status: next.status, amountCents: next.amountCents, currency: next.currency }, invoice: subscriptionInvoiceRecord(await dbFirst(env, `SELECT * FROM subscription_invoices WHERE id = ? LIMIT 1`, [invoice.id])), subscription: customerSubscriptionRecord(await dbFirst(env, `SELECT * FROM customer_subscriptions WHERE id = ? LIMIT 1`, [subscription.id])), events: await listMerchantDunningEvents(env, existing.merchant_id) });
  }

  const nativePaymentWebhookMatch = url.pathname.match(/^\/api\/payments\/webhook\/native\/([^/]+)$/);
  if (nativePaymentWebhookMatch && request.method === 'POST') {
    const provider = decodeURIComponent(nativePaymentWebhookMatch[1]);
    const raw = await request.text();
    if (provider === 'stripe') {
      const verified = await verifyStripeWebhookSignature(env, raw, request.headers.get('stripe-signature') || '');
      if (!verified) return json({ error: 'Invalid Stripe webhook signature.' }, 401);
    }
    if (provider === 'paypal') {
      try {
        const verified = await verifyPaypalWebhookSignature(env, raw, request.headers);
        if (!verified?.ok) return json({ error: 'Invalid PayPal webhook signature.', verification: verified }, 401);
      } catch (error) {
        return json({ error: error.message, code: error.code || 'PAYPAL_WEBHOOK_VERIFICATION_FAILED', missing: error.missing || [] }, error.code === 'PROVIDER_SECRETS_MISSING' || error.code === 'PAYPAL_WEBHOOK_ID_REQUIRED' ? 409 : 401);
      }
    }
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch { return json({ error: 'Malformed webhook body.' }, 400); }
    const incoming = normalizeNativePaymentWebhookInput(provider, body);
    if (!incoming.checkoutToken && !incoming.providerReference) return json({ error: 'Native webhook could not be mapped to a checkout token or provider reference.' }, 400);
    const existing = incoming.checkoutToken
      ? await dbFirst(env, `SELECT * FROM payment_transactions WHERE checkout_token = ? OR provider_reference = ? LIMIT 1`, [incoming.checkoutToken, incoming.providerReference || ''])
      : await dbFirst(env, `SELECT * FROM payment_transactions WHERE provider_reference = ? LIMIT 1`, [incoming.providerReference || '']);
    if (!existing) return json({ error: 'Payment session not found.' }, 404);
    const next = applyPaymentWebhook(existing, incoming);
    await dbRun(env, `
      UPDATE payment_transactions
      SET provider_reference = ?, status = ?, amount_cents = ?, currency = ?, payload_json = ?, authorized_at = ?, captured_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [incoming.providerReference || existing.provider_reference || '', next.status, next.amountCents || existing.amount_cents || 0, next.currency || existing.currency || 'USD', JSON.stringify(incoming.raw || {}), next.authorizedAt || null, next.capturedAt || null, existing.id]);
    await syncOrderAfterPaymentWebhook(env, existing, incoming, next);
    return json({ ok: true, transaction: paymentTransactionRecord(await dbFirst(env, `SELECT * FROM payment_transactions WHERE id = ? LIMIT 1`, [existing.id])) });
  }

  if (request.method === 'POST' && url.pathname === '/api/payments/webhook') {
    const raw = await request.text();
    const signature = request.headers.get('x-skye-signature') || '';
    const expected = await hmacHex(env.PAYMENT_WEBHOOK_SECRET || env.SESSION_SECRET, raw);
    if (!signature || signature !== expected) return json({ error: 'Invalid webhook signature.' }, 401);
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch { return json({ error: 'Malformed webhook body.' }, 400); }
    const incoming = normalizePaymentWebhookInput(body);
    if (!incoming.checkoutToken) return json({ error: 'checkoutToken is required.' }, 400);
    const existing = await dbFirst(env, `SELECT * FROM payment_transactions WHERE checkout_token = ? LIMIT 1`, [incoming.checkoutToken]);
    if (!existing) return json({ error: 'Payment session not found.' }, 404);
    const next = applyPaymentWebhook(existing, incoming);
    await dbRun(env, `
      UPDATE payment_transactions
      SET provider_reference = ?, status = ?, amount_cents = ?, currency = ?, payload_json = ?, authorized_at = ?, captured_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [incoming.providerReference || existing.provider_reference || '', next.status, next.amountCents, next.currency, JSON.stringify(incoming.raw || {}), next.authorizedAt || null, next.capturedAt || null, existing.id]);
    await syncOrderAfterPaymentWebhook(env, existing, incoming, next);
    return json({ ok: true, transaction: paymentTransactionRecord(await dbFirst(env, `SELECT * FROM payment_transactions WHERE id = ? LIMIT 1`, [existing.id])) });
  }

  if (request.method === 'GET' && url.pathname === '/api/products') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, products: await listMerchantProducts(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/products') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    if (!body.title) return json({ error: 'title is required.' }, 400);
    const slug = slugify(body.slug || body.title);
    const taken = await dbFirst(env, `SELECT id FROM products WHERE merchant_id = ? AND slug = ? LIMIT 1`, [auth.session.merchantId, slug]);
    if (taken) return json({ error: 'Product slug already exists.' }, 409);
    const id = uid('prd');
    await dbRun(env, `
      INSERT INTO products (
        id, merchant_id, slug, title, short_description, description_html, price_cents, compare_at_cents,
        sku, inventory_on_hand, track_inventory, status, hero_image_url, source_type, source_ref
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      auth.session.merchantId,
      slug,
      body.title,
      body.shortDescription || '',
      cleanHtml(body.descriptionHtml || ''),
      Number(body.priceCents || 0),
      Number(body.compareAtCents || 0),
      body.sku || '',
      Number(body.inventoryOnHand || 0),
      body.trackInventory ? 1 : 0,
      body.status || 'active',
      body.heroImageUrl || '',
      body.sourceType || 'manual',
      body.sourceRef || ''
    ]);
    if (body.trackInventory && Number(body.inventoryOnHand || 0) > 0) {
      await seedDefaultInventoryForProduct(env, auth.session.merchantId, id, Number(body.inventoryOnHand || 0));
    }
    return json({ ok: true, product: productRecord(await dbFirst(env, `SELECT * FROM products WHERE id = ? LIMIT 1`, [id])) }, 201);
  }


  const productMediaMatch = url.pathname.match(/^\/api\/products\/([^/]+)\/media$/);
  if (productMediaMatch && request.method === 'GET') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const productId = decodeURIComponent(productMediaMatch[1]);
    const product = await dbFirst(env, `SELECT * FROM products WHERE id = ? AND merchant_id = ? LIMIT 1`, [productId, auth.session.merchantId]);
    if (!product) return json({ error: 'Product not found.' }, 404);
    return json({ ok: true, media: await listProductMedia(env, auth.session.merchantId, productId), imports: await listDonorVisualImports(env, auth.session.merchantId) });
  }

  const productMediaIngestMatch = url.pathname.match(/^\/api\/products\/([^/]+)\/media\/ingest-url$/);
  if (productMediaIngestMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const productId = decodeURIComponent(productMediaIngestMatch[1]);
    const product = await dbFirst(env, `SELECT * FROM products WHERE id = ? AND merchant_id = ? LIMIT 1`, [productId, auth.session.merchantId]);
    if (!product) return json({ error: 'Product not found.' }, 404);
    const body = await readJson(request) || {};
    const sourceUrl = requireHttpsUrl(body.url || body.sourceUrl || '', 'sourceUrl');
    const importId = uid('dvis');
    await dbRun(env, `INSERT INTO donor_visual_imports (id, merchant_id, product_id, source_url, status, result_json) VALUES (?, ?, ?, ?, 'running', '{}')`, [importId, auth.session.merchantId, productId, sourceUrl]);
    let result;
    try {
      const fetched = await fetch(sourceUrl, { headers: { 'user-agent': 'SkyeCommerce-DonorVisualIngest/1.18.0' } });
      const html = await fetched.text();
      if (!fetched.ok) throw new Error(`Donor source returned HTTP ${fetched.status}.`);
      result = extractDonorVisualsFromHtml(html, sourceUrl);
      const selected = result.images[0] || null;
      let inserted = 0;
      for (const [index, image] of result.images.entries()) {
        const media = buildProductMediaRecord({ merchantId: auth.session.merchantId, productId, url: image.url, alt: image.source || result.title || product.title, source: image.kind, position: index });
        await dbRun(env, `INSERT OR IGNORE INTO product_media (id, merchant_id, product_id, url, alt, source, position) VALUES (?, ?, ?, ?, ?, ?, ?)`, [media.id, media.merchantId, media.productId, media.url, media.alt, media.source, media.position]);
        inserted += 1;
      }
      if (selected?.url) await dbRun(env, `UPDATE products SET hero_image_url = COALESCE(NULLIF(hero_image_url, ''), ?), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [selected.url, productId, auth.session.merchantId]);
      await dbRun(env, `UPDATE donor_visual_imports SET status = 'complete', image_count = ?, selected_image_url = ?, result_json = ? WHERE id = ?`, [result.images.length, selected?.url || '', JSON.stringify({ ...result, inserted }), importId]);
      return json({ ok: true, import: donorVisualImportRecord(await dbFirst(env, `SELECT * FROM donor_visual_imports WHERE id = ? LIMIT 1`, [importId])), media: await listProductMedia(env, auth.session.merchantId, productId) }, 201);
    } catch (error) {
      await dbRun(env, `UPDATE donor_visual_imports SET status = 'failed', result_json = ? WHERE id = ?`, [JSON.stringify({ error: error.message }), importId]);
      return json({ error: error.message, importId }, 502);
    }
  }

  const productVariantsMatch = url.pathname.match(/^\/api\/products\/([^/]+)\/variants$/);
  if (productVariantsMatch) {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const productId = decodeURIComponent(productVariantsMatch[1]);
    const product = await dbFirst(env, `SELECT * FROM products WHERE id = ? AND merchant_id = ? LIMIT 1`, [productId, auth.session.merchantId]);
    if (!product) return json({ error: 'Product not found.' }, 404);
    if (request.method === 'GET') {
      return json({ ok: true, variants: await getProductVariants(env, auth.session.merchantId, productId) });
    }
    if (request.method === 'POST') {
      const body = normalizeVariantInput(await readJson(request) || {}, productRecord(product));
      const id = uid('var');
      await dbRun(env, `
        INSERT INTO product_variants (id, merchant_id, product_id, title, sku, option1, option2, option3, price_cents, compare_at_cents, inventory_on_hand, track_inventory, status, position)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, auth.session.merchantId, productId, body.title, body.sku, body.option1, body.option2, body.option3, body.priceCents, body.compareAtCents, body.inventoryOnHand, body.trackInventory ? 1 : 0, body.status, body.position]);
      await audit(env, auth.session.merchantId, 'product_variant.created', `Variant created for ${product.title}`, 'product_variant', id, { productId }, auth.session);
      return json({ ok: true, variant: productVariantRecord(await dbFirst(env, `SELECT * FROM product_variants WHERE id = ? LIMIT 1`, [id])) }, 201);
    }
  }

  const productVariantMatch = url.pathname.match(/^\/api\/product-variants\/([^/]+)$/);
  if (productVariantMatch) {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const variantId = decodeURIComponent(productVariantMatch[1]);
    const existing = await dbFirst(env, `SELECT product_variants.*, products.title AS product_title FROM product_variants INNER JOIN products ON products.id = product_variants.product_id WHERE product_variants.id = ? AND product_variants.merchant_id = ? LIMIT 1`, [variantId, auth.session.merchantId]);
    if (!existing) return json({ error: 'Product variant not found.' }, 404);
    if (request.method === 'PUT') {
      const body = normalizeVariantInput(await readJson(request) || {}, { title: existing.product_title, price_cents: existing.price_cents, compare_at_cents: existing.compare_at_cents, inventory_on_hand: existing.inventory_on_hand, track_inventory: existing.track_inventory });
      await dbRun(env, `UPDATE product_variants SET title = ?, sku = ?, option1 = ?, option2 = ?, option3 = ?, price_cents = ?, compare_at_cents = ?, inventory_on_hand = ?, track_inventory = ?, status = ?, position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [body.title, body.sku, body.option1, body.option2, body.option3, body.priceCents, body.compareAtCents, body.inventoryOnHand, body.trackInventory ? 1 : 0, body.status, body.position, variantId, auth.session.merchantId]);
      await audit(env, auth.session.merchantId, 'product_variant.updated', `Variant ${variantId} updated`, 'product_variant', variantId, { productId: existing.product_id }, auth.session);
      return json({ ok: true, variant: productVariantRecord(await dbFirst(env, `SELECT * FROM product_variants WHERE id = ? LIMIT 1`, [variantId])) });
    }
    if (request.method === 'DELETE') {
      await dbRun(env, `DELETE FROM product_variants WHERE id = ? AND merchant_id = ?`, [variantId, auth.session.merchantId]);
      await audit(env, auth.session.merchantId, 'product_variant.deleted', `Variant ${variantId} deleted`, 'product_variant', variantId, { productId: existing.product_id }, auth.session);
      return json({ ok: true, deleted: variantId });
    }
  }

  const productMatch = url.pathname.match(/^\/api\/products\/([^/]+)$/);
  if (productMatch) {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const id = decodeURIComponent(productMatch[1]);
    const existing = await dbFirst(env, `SELECT * FROM products WHERE id = ? AND merchant_id = ? LIMIT 1`, [id, auth.session.merchantId]);
    if (!existing) return json({ error: 'Product not found.' }, 404);
    if (request.method === 'PUT') {
      const body = await readJson(request) || {};
      await dbRun(env, `
        UPDATE products
        SET slug = ?, title = ?, short_description = ?, description_html = ?, price_cents = ?, compare_at_cents = ?,
            sku = ?, inventory_on_hand = ?, track_inventory = ?, status = ?, hero_image_url = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND merchant_id = ?
      `, [
        slugify(body.slug || body.title || existing.slug),
        body.title || existing.title,
        body.shortDescription || '',
        cleanHtml(body.descriptionHtml || ''),
        Number(body.priceCents || 0),
        Number(body.compareAtCents || 0),
        body.sku || '',
        Number(body.inventoryOnHand || 0),
        body.trackInventory ? 1 : 0,
        body.status || 'active',
        body.heroImageUrl || '',
        id,
        auth.session.merchantId
      ]);
      const levels = await listMerchantInventoryLevels(env, auth.session.merchantId, id);
      if (levels.length) {
        await syncProductInventoryTotal(env, auth.session.merchantId, id);
      } else if (body.trackInventory && Number(body.inventoryOnHand || 0) > 0) {
        await seedDefaultInventoryForProduct(env, auth.session.merchantId, id, Number(body.inventoryOnHand || 0));
      }
      return json({ ok: true, product: productRecord(await dbFirst(env, `SELECT * FROM products WHERE id = ? LIMIT 1`, [id])) });
    }
    if (request.method === 'DELETE') {
      await dbRun(env, `DELETE FROM products WHERE id = ? AND merchant_id = ?`, [id, auth.session.merchantId]);
      return json({ ok: true, deleted: id });
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/inventory/locations') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, locations: await listMerchantInventoryLocations(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/inventory/locations') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = normalizeInventoryLocationInput(await readJson(request) || {});
    const id = uid('loc');
    if (body.isDefault) await dbRun(env, `UPDATE inventory_locations SET is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE merchant_id = ?`, [auth.session.merchantId]);
    await dbRun(env, `
      INSERT INTO inventory_locations (id, merchant_id, name, code, priority, active, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, auth.session.merchantId, body.name, body.code, body.priority, body.active ? 1 : 0, body.isDefault ? 1 : 0]);
    return json({ ok: true, location: locationRecord(await dbFirst(env, `SELECT * FROM inventory_locations WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  const inventoryLocationMatch = url.pathname.match(/^\/api\/inventory\/locations\/([^/]+)$/);
  if (inventoryLocationMatch && request.method === 'PUT') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const id = decodeURIComponent(inventoryLocationMatch[1]);
    const existing = await dbFirst(env, `SELECT * FROM inventory_locations WHERE id = ? AND merchant_id = ? LIMIT 1`, [id, auth.session.merchantId]);
    if (!existing) return json({ error: 'Inventory location not found.' }, 404);
    const body = normalizeInventoryLocationInput(await readJson(request) || {}, locationRecord(existing));
    if (body.isDefault) await dbRun(env, `UPDATE inventory_locations SET is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE merchant_id = ?`, [auth.session.merchantId]);
    await dbRun(env, `
      UPDATE inventory_locations
      SET name = ?, code = ?, priority = ?, active = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND merchant_id = ?
    `, [body.name, body.code, body.priority, body.active ? 1 : 0, body.isDefault ? 1 : 0, id, auth.session.merchantId]);
    return json({ ok: true, location: locationRecord(await dbFirst(env, `SELECT * FROM inventory_locations WHERE id = ? LIMIT 1`, [id])) });
  }

  if (request.method === 'GET' && url.pathname === '/api/inventory/levels') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, levels: await listMerchantInventoryLevels(env, auth.session.merchantId, url.searchParams.get('productId') || '') });
  }

  if (request.method === 'GET' && url.pathname === '/api/inventory/adjustments') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, adjustments: await listMerchantInventoryAdjustments(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/inventory/adjustments') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeInventoryAdjustmentInput(await readJson(request) || {});
    if (!payload.productId) return json({ error: 'productId is required for an inventory adjustment.' }, 400);
    const adjustment = await applyInventoryAdjustment(env, auth.session.merchantId, payload);
    return json({ ok: true, adjustment }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/shipping-profiles') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, shippingProfiles: await listMerchantShipping(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/shipping-profiles') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    const id = uid('shp');
    await dbRun(env, `INSERT INTO shipping_profiles (id, merchant_id, name, origin_country, origin_state, rates_json) VALUES (?, ?, ?, ?, ?, ?)`, [
      id,
      auth.session.merchantId,
      body.name || 'Standard shipping',
      body.originCountry || env.DEFAULT_COUNTRY_CODE || 'US',
      body.originState || env.DEFAULT_STATE_CODE || '',
      JSON.stringify(Array.isArray(body.rates) ? body.rates : [])
    ]);
    return json({ ok: true, shippingProfile: shippingRecord(await dbFirst(env, `SELECT * FROM shipping_profiles WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/tax-profiles') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, taxProfiles: await listMerchantTaxes(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/tax-profiles') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    const id = uid('tax');
    await dbRun(env, `INSERT INTO tax_profiles (id, merchant_id, label, country_code, state_code, rate_bps) VALUES (?, ?, ?, ?, ?, ?)`, [
      id,
      auth.session.merchantId,
      body.label || 'Sales tax',
      String(body.countryCode || env.DEFAULT_COUNTRY_CODE || 'US').toUpperCase(),
      String(body.stateCode || '').toUpperCase(),
      Number(body.rateBps || 0)
    ]);
    return json({ ok: true, taxProfile: taxRecord(await dbFirst(env, `SELECT * FROM tax_profiles WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/discount-codes') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, discountCodes: await listMerchantDiscountCodes(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/discount-codes') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = normalizeDiscountInput(await readJson(request) || {});
    if (!body.code) return json({ error: 'code is required.' }, 400);
    const existing = await dbFirst(env, `SELECT id FROM discount_codes WHERE merchant_id = ? AND code = ? LIMIT 1`, [auth.session.merchantId, body.code]);
    if (existing) return json({ error: 'Discount code already exists for this merchant.' }, 409);
    if (body.type === 'percent' && !body.amountBps) return json({ error: 'amountBps is required for percent discounts.' }, 400);
    if (body.type === 'fixed' && !body.amountCents) return json({ error: 'amountCents is required for fixed discounts.' }, 400);
    const id = uid('dsc');
    await dbRun(env, `
      INSERT INTO discount_codes (
        id, merchant_id, code, title, type, amount_cents, amount_bps,
        minimum_subtotal_cents, active, starts_at, ends_at, usage_limit
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, auth.session.merchantId, body.code, body.title, body.type, body.amountCents, body.amountBps, body.minimumSubtotalCents, body.active, body.startsAt || null, body.endsAt || null, body.usageLimit]);
    return json({ ok: true, discountCode: discountRecord(await dbFirst(env, `SELECT * FROM discount_codes WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  const discountMatch = url.pathname.match(/^\/api\/discount-codes\/([^/]+)$/);
  if (discountMatch) {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const id = decodeURIComponent(discountMatch[1]);
    const existing = await dbFirst(env, `SELECT * FROM discount_codes WHERE id = ? AND merchant_id = ? LIMIT 1`, [id, auth.session.merchantId]);
    if (!existing) return json({ error: 'Discount code not found.' }, 404);
    if (request.method === 'PUT') {
      const body = normalizeDiscountInput(await readJson(request) || {});
      await dbRun(env, `
        UPDATE discount_codes
        SET title = ?, type = ?, amount_cents = ?, amount_bps = ?, minimum_subtotal_cents = ?, active = ?, starts_at = ?, ends_at = ?, usage_limit = ?
        WHERE id = ? AND merchant_id = ?
      `, [body.title, body.type, body.amountCents, body.amountBps, body.minimumSubtotalCents, body.active, body.startsAt || null, body.endsAt || null, body.usageLimit, id, auth.session.merchantId]);
      return json({ ok: true, discountCode: discountRecord(await dbFirst(env, `SELECT * FROM discount_codes WHERE id = ? LIMIT 1`, [id])) });
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/collections') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, collections: await listMerchantCollections(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/collections') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = normalizeCollectionInput(await readJson(request) || {});
    if (!body.title) return json({ error: 'title is required.' }, 400);
    const exists = await dbFirst(env, `SELECT id FROM collections WHERE merchant_id = ? AND slug = ? LIMIT 1`, [auth.session.merchantId, body.slug]);
    if (exists) return json({ error: 'Collection slug already exists for this merchant.' }, 409);
    const id = uid('col');
    await dbRun(env, `INSERT INTO collections (id, merchant_id, slug, title, description, sort_mode, visible) VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, body.slug, body.title, body.description, body.sortMode, body.visible ? 1 : 0]);
    for (const [index, productId] of [...new Set(body.productIds)].entries()) {
      const product = await dbFirst(env, `SELECT id FROM products WHERE id = ? AND merchant_id = ? LIMIT 1`, [productId, auth.session.merchantId]);
      if (!product) continue;
      await dbRun(env, `INSERT INTO collection_products (collection_id, product_id, position) VALUES (?, ?, ?)`, [id, productId, index]);
    }
    return json({ ok: true, collection: (await listMerchantCollections(env, auth.session.merchantId)).find((item) => item.id === id) }, 201);
  }

  const collectionMatch = url.pathname.match(/^\/api\/collections\/([^/]+)$/);
  if (collectionMatch && request.method === 'PUT') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const id = decodeURIComponent(collectionMatch[1]);
    const existing = await dbFirst(env, `SELECT id FROM collections WHERE id = ? AND merchant_id = ? LIMIT 1`, [id, auth.session.merchantId]);
    if (!existing) return json({ error: 'Collection not found.' }, 404);
    const body = normalizeCollectionInput(await readJson(request) || {});
    if (!body.title) return json({ error: 'title is required.' }, 400);
    await dbRun(env, `UPDATE collections SET slug = ?, title = ?, description = ?, sort_mode = ?, visible = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [body.slug, body.title, body.description, body.sortMode, body.visible ? 1 : 0, id, auth.session.merchantId]);
    await dbRun(env, `DELETE FROM collection_products WHERE collection_id = ?`, [id]);
    for (const [index, productId] of [...new Set(body.productIds)].entries()) {
      const product = await dbFirst(env, `SELECT id FROM products WHERE id = ? AND merchant_id = ? LIMIT 1`, [productId, auth.session.merchantId]);
      if (!product) continue;
      await dbRun(env, `INSERT INTO collection_products (collection_id, product_id, position) VALUES (?, ?, ?)`, [id, productId, index]);
    }
    return json({ ok: true, collection: (await listMerchantCollections(env, auth.session.merchantId)).find((item) => item.id === id) });
  }

  if (request.method === 'GET' && url.pathname === '/api/pages') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, pages: await listMerchantPages(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/pages') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = normalizePageInput(await readJson(request) || {});
    if (!body.title) return json({ error: 'title is required.' }, 400);
    const exists = await dbFirst(env, `SELECT id FROM content_pages WHERE merchant_id = ? AND slug = ? LIMIT 1`, [auth.session.merchantId, body.slug]);
    if (exists) return json({ error: 'Page slug already exists for this merchant.' }, 409);
    const id = uid('page');
    await dbRun(env, `INSERT INTO content_pages (id, merchant_id, slug, title, body_html, visible) VALUES (?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, body.slug, body.title, body.bodyHtml, body.visible ? 1 : 0]);
    return json({ ok: true, page: pageRecord(await dbFirst(env, `SELECT * FROM content_pages WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  const pageMatch = url.pathname.match(/^\/api\/pages\/([^/]+)$/);
  if (pageMatch && request.method === 'PUT') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const id = decodeURIComponent(pageMatch[1]);
    const existing = await dbFirst(env, `SELECT id FROM content_pages WHERE id = ? AND merchant_id = ? LIMIT 1`, [id, auth.session.merchantId]);
    if (!existing) return json({ error: 'Page not found.' }, 404);
    const body = normalizePageInput(await readJson(request) || {});
    if (!body.title) return json({ error: 'title is required.' }, 400);
    await dbRun(env, `UPDATE content_pages SET slug = ?, title = ?, body_html = ?, visible = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [body.slug, body.title, body.bodyHtml, body.visible ? 1 : 0, id, auth.session.merchantId]);
    return json({ ok: true, page: pageRecord(await dbFirst(env, `SELECT * FROM content_pages WHERE id = ? LIMIT 1`, [id])) });
  }

  if (request.method === 'GET' && url.pathname === '/api/navigation') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, navigation: await listMerchantNavigation(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/navigation') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = normalizeNavLinkInput(await readJson(request) || {});
    if (!body.label) return json({ error: 'label is required.' }, 400);
    const id = uid('nav');
    await dbRun(env, `INSERT INTO navigation_links (id, merchant_id, label, type, href, target_ref, position, visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, body.label, body.type, body.href, body.targetRef, body.position, body.visible ? 1 : 0]);
    return json({ ok: true, navigationLink: navLinkRecord(await dbFirst(env, `SELECT * FROM navigation_links WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  const navigationMatch = url.pathname.match(/^\/api\/navigation\/([^/]+)$/);
  if (navigationMatch && request.method === 'PUT') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const id = decodeURIComponent(navigationMatch[1]);
    const existing = await dbFirst(env, `SELECT id FROM navigation_links WHERE id = ? AND merchant_id = ? LIMIT 1`, [id, auth.session.merchantId]);
    if (!existing) return json({ error: 'Navigation link not found.' }, 404);
    const body = normalizeNavLinkInput(await readJson(request) || {});
    if (!body.label) return json({ error: 'label is required.' }, 400);
    await dbRun(env, `UPDATE navigation_links SET label = ?, type = ?, href = ?, target_ref = ?, position = ?, visible = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [body.label, body.type, body.href, body.targetRef, body.position, body.visible ? 1 : 0, id, auth.session.merchantId]);
    return json({ ok: true, navigationLink: navLinkRecord(await dbFirst(env, `SELECT * FROM navigation_links WHERE id = ? LIMIT 1`, [id])) });
  }

  if (request.method === 'POST' && url.pathname === '/api/publish') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const published = await buildAndPersistSnapshot(env, auth.session.merchantId);
    const merchant = merchantRecord(await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [auth.session.merchantId]));
    return json({
      ok: true,
      snapshotId: published.snapshotId,
      merchant,
      previewUrl: `${publicBaseUrl(env, url)}/s/${merchant.slug}`,
      productCount: published.snapshot.productCount
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/import-jobs') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const rows = await dbAll(env, `SELECT * FROM import_jobs WHERE merchant_id = ? ORDER BY created_at DESC`, [auth.session.merchantId]);
    return json({ ok: true, jobs: rows.map((row) => ({ id: row.id, kind: row.kind, sourceRef: row.source_ref, status: row.status, log: JSON.parse(row.log_json || '{}'), createdAt: row.created_at })) });
  }

  if (request.method === 'POST' && url.pathname === '/api/import/shopify/csv') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    if (!body.csvText) return json({ error: 'csvText is required.' }, 400);
    const jobId = await createImportJob(env, auth.session.merchantId, 'shopify_csv', 'inline', 'running');
    const products = parseShopifyCsvProducts(body.csvText);
    const applied = await upsertImportedProducts(env, auth.session.merchantId, products, 'shopify_csv');
    await dbRun(env, `UPDATE import_jobs SET status = 'complete', log_json = ? WHERE id = ?`, [JSON.stringify({ imported: applied.length }), jobId]);
    return json({ ok: true, jobId, imported: applied.length, results: applied });
  }

  if (request.method === 'POST' && url.pathname === '/api/import/shopify/graphql') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    if (!body.storeDomain || !body.accessToken) return json({ error: 'storeDomain and accessToken are required.' }, 400);
    const apiVersion = body.apiVersion || env.SHOPIFY_API_VERSION || '2025-10';
    const endpoint = `https://${body.storeDomain.replace(/^https?:\/\//, '')}/admin/api/${apiVersion}/graphql.json`;
    const jobId = await createImportJob(env, auth.session.merchantId, 'shopify_graphql', endpoint, 'running');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Shopify-Access-Token': body.accessToken
      },
      body: JSON.stringify({
        query: `query ImportProducts($first:Int!){ products(first:$first){ edges { node { id handle title descriptionHtml images(first:1){ edges { node { url } } } variants(first:1){ edges { node { sku inventoryQuantity price compareAtPrice } } } } } } }`,
        variables: { first: Number(body.limit || 50) }
      })
    });
    const payload = await res.json();
    if (!res.ok) {
      await dbRun(env, `UPDATE import_jobs SET status = 'failed', log_json = ? WHERE id = ?`, [JSON.stringify(payload), jobId]);
      return json({ error: 'Shopify GraphQL import failed.', details: payload }, 502);
    }
    const products = normalizeShopifyGraphQLProducts(payload);
    const applied = await upsertImportedProducts(env, auth.session.merchantId, products, 'shopify_graphql');
    await dbRun(env, `UPDATE import_jobs SET status = 'complete', log_json = ? WHERE id = ?`, [JSON.stringify({ imported: applied.length }), jobId]);
    return json({ ok: true, jobId, imported: applied.length, results: applied });
  }

  if (request.method === 'POST' && url.pathname === '/api/import/scan-url') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    if (!body.url) return json({ error: 'url is required.' }, 400);
    const jobId = await createImportJob(env, auth.session.merchantId, 'url_scan', body.url, 'running');
    const products = await fetchAndScanStorefront(body.url);
    const applied = await upsertImportedProducts(env, auth.session.merchantId, products, 'url_scan');
    await dbRun(env, `UPDATE import_jobs SET status = 'complete', log_json = ? WHERE id = ?`, [JSON.stringify({ imported: applied.length }), jobId]);
    return json({ ok: true, jobId, imported: applied.length, results: applied });
  }

  const storeBootstrapMatch = url.pathname.match(/^\/api\/store\/([^/]+)\/bootstrap$/);
  if (request.method === 'GET' && storeBootstrapMatch) {
    const slug = decodeURIComponent(storeBootstrapMatch[1]);
    const merchant = await dbFirst(env, `SELECT * FROM merchants WHERE slug = ? LIMIT 1`, [slug]);
    if (!merchant) return json({ error: 'Store not found.' }, 404);
    const latest = await dbFirst(env, `SELECT snapshot_json, published_at FROM storefront_snapshots WHERE merchant_id = ? ORDER BY published_at DESC LIMIT 1`, [merchant.id]);
    if (latest?.snapshot_json) {
      return json({ ok: true, snapshot: JSON.parse(latest.snapshot_json), publishedAt: latest.published_at, customerPortalUrl: `${publicBaseUrl(env, url)}/customer/index.html?slug=${merchant.slug}` });
    }
    const snapshot = buildStorefrontSnapshot(
      merchantRecord(merchant),
      await listMerchantProducts(env, merchant.id),
      await listMerchantShipping(env, merchant.id),
      await listMerchantTaxes(env, merchant.id),
      await listMerchantDiscountCodes(env, merchant.id),
      await listMerchantCollections(env, merchant.id),
      await listMerchantPages(env, merchant.id),
      await listMerchantNavigation(env, merchant.id)
    );
    return json({ ok: true, snapshot, publishedAt: null, customerPortalUrl: `${publicBaseUrl(env, url)}/customer/index.html?slug=${merchant.slug}` });
  }


  const storeProductMatch = url.pathname.match(/^\/api\/store\/([^/]+)\/products\/([^/]+)$/);
  if (request.method === 'GET' && storeProductMatch) {
    const slug = decodeURIComponent(storeProductMatch[1]);
    const productRef = decodeURIComponent(storeProductMatch[2]);
    const merchant = await dbFirst(env, `SELECT * FROM merchants WHERE slug = ? LIMIT 1`, [slug]);
    if (!merchant) return json({ error: 'Store not found.' }, 404);
    const product = await getStorefrontProductDetail(env, merchant.id, productRef);
    if (!product || product.status !== 'active') return json({ error: 'Product not found.' }, 404);
    return json({ ok: true, merchant: merchantRecord(merchant), product });
  }

  const publicOrderStatusMatch = url.pathname.match(/^\/api\/store\/([^/]+)\/orders\/([^/]+)\/status$/);
  if (request.method === 'GET' && publicOrderStatusMatch) {
    const slug = decodeURIComponent(publicOrderStatusMatch[1]);
    const orderId = decodeURIComponent(publicOrderStatusMatch[2]);
    const merchant = await dbFirst(env, `SELECT * FROM merchants WHERE slug = ? LIMIT 1`, [slug]);
    if (!merchant) return json({ error: 'Store not found.' }, 404);
    const access = url.searchParams.get('access') || '';
    const valid = await verifyPublicOrderAccessToken(env.PUBLIC_ORDER_STATUS_SECRET || env.SESSION_SECRET, merchant.slug, orderId, access);
    if (!valid) return json({ error: 'Invalid public order access token.' }, 401);
    const order = await getOrderDetails(env, orderId, merchant.id);
    if (!order) return json({ error: 'Order not found.' }, 404);
    const payments = await dbAll(env, `SELECT * FROM payment_transactions WHERE merchant_id = ? AND order_id = ? ORDER BY created_at DESC`, [merchant.id, orderId]);
    const latestPayment = payments[0] ? paymentTransactionRecord(payments[0]) : null;
    const canRetry = !['paid', 'refunded'].includes(String(order.paymentStatus || '').toLowerCase()) && ['pending_provider', 'pending_provider_failure', 'voided'].includes(String(order.paymentStatus || '').toLowerCase());
    const canCancel = !['paid', 'refunded', 'voided'].includes(String(order.paymentStatus || '').toLowerCase()) && String(order.status || '').toLowerCase() !== 'cancelled';
    const baseActionPath = `/api/store/${encodeURIComponent(merchant.slug)}/orders/${encodeURIComponent(orderId)}`;
    return json({
      ok: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalCents: order.totalCents,
        currency: order.currency,
        createdAt: order.createdAt,
        itemCount: Array.isArray(order.items) ? order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) : 0
      },
      payment: latestPayment ? { provider: latestPayment.provider, status: latestPayment.status, checkoutToken: latestPayment.checkoutToken, providerReference: latestPayment.providerReference, amountCents: latestPayment.amountCents, currency: latestPayment.currency } : null,
      actions: {
        canRetry,
        canCancel,
        retryUrl: canRetry ? `${baseActionPath}/retry-payment?access=${encodeURIComponent(access)}` : '',
        cancelUrl: canCancel ? `${baseActionPath}/cancel?access=${encodeURIComponent(access)}` : ''
      }
    });
  }

  const publicOrderRetryMatch = url.pathname.match(/^\/api\/store\/([^/]+)\/orders\/([^/]+)\/retry-payment$/);
  if (request.method === 'POST' && publicOrderRetryMatch) {
    const slug = decodeURIComponent(publicOrderRetryMatch[1]);
    const orderId = decodeURIComponent(publicOrderRetryMatch[2]);
    const merchant = await dbFirst(env, `SELECT * FROM merchants WHERE slug = ? LIMIT 1`, [slug]);
    if (!merchant) return json({ error: 'Store not found.' }, 404);
    const body = await readJson(request) || {};
    const access = url.searchParams.get('access') || body.access || '';
    const valid = await verifyPublicOrderAccessToken(env.PUBLIC_ORDER_STATUS_SECRET || env.SESSION_SECRET, merchant.slug, orderId, access);
    if (!valid) return json({ error: 'Invalid public order access token.' }, 401);
    const order = await getOrderDetails(env, orderId, merchant.id);
    if (!order) return json({ error: 'Order not found.' }, 404);
    if (['paid', 'refunded'].includes(String(order.paymentStatus || '').toLowerCase())) return json({ error: 'This order is not eligible for checkout retry.' }, 409);
    const payments = await dbAll(env, `SELECT * FROM payment_transactions WHERE merchant_id = ? AND order_id = ? ORDER BY created_at DESC`, [merchant.id, orderId]);
    const latestPayment = payments[0] ? paymentTransactionRecord(payments[0]) : null;
    const provider = normalizePublicCheckoutProvider(body) || latestPayment?.provider || '';
    if (!['stripe', 'paypal'].includes(provider)) return json({ error: 'Retry checkout requires stripe or paypal.' }, 400);
    await dbRun(env, `UPDATE payment_transactions SET status = 'voided', updated_at = CURRENT_TIMESTAMP WHERE merchant_id = ? AND order_id = ? AND status IN ('pending', 'authorized')`, [merchant.id, orderId]);
    if (String(order.status || '').toLowerCase() === 'cancelled') {
      await dbRun(env, `UPDATE orders SET status = 'received', payment_status = 'pending_provider', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [orderId, merchant.id]);
    } else {
      await dbRun(env, `UPDATE orders SET payment_status = 'pending_provider', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [orderId, merchant.id]);
    }
    const refreshedOrder = await getOrderDetails(env, orderId, merchant.id);
    try {
      const accessToken = await publicOrderAccessToken(env, merchant.slug, orderId);
      const urls = buildPublicCheckoutReturnUrls(buildAbsoluteOrigin(url), merchant.slug, orderId, accessToken);
      const payment = await createHostedOrderPaymentSession(env, merchantRecord(merchant), refreshedOrder, {
        provider,
        amountCents: refreshedOrder.totalCents,
        currency: refreshedOrder.currency || merchant.currency || 'USD',
        customerEmail: refreshedOrder.customerEmail || '',
        returnUrl: urls.returnUrl,
        cancelUrl: urls.cancelUrl,
        metadata: { source: 'public_storefront_retry', orderId, orderNumber: refreshedOrder.orderNumber }
      }, url);
      if (payment.session) payment.session.statusUrl = `${buildAbsoluteOrigin(url)}/api/store/${encodeURIComponent(merchant.slug)}/orders/${encodeURIComponent(orderId)}/status?access=${encodeURIComponent(accessToken)}`;
      await appendOrderEvent(env, orderId, {
        kind: 'checkout_retry_started',
        summary: `Checkout retry started through ${provider}`,
        status: refreshedOrder.status,
        paymentStatus: 'pending_provider',
        detail: `Public storefront retry created a new ${provider} checkout session.`
      });
      return json({ ok: true, orderId, orderNumber: refreshedOrder.orderNumber, paymentStatus: 'pending_provider', paymentSession: payment.session, paymentTransaction: payment.transaction, publicStatusUrl: `${buildAbsoluteOrigin(url)}/api/store/${encodeURIComponent(merchant.slug)}/orders/${encodeURIComponent(orderId)}/status?access=${encodeURIComponent(accessToken)}` });
    } catch (error) {
      return json({ error: error.message, code: error.code || 'PAYMENT_PROVIDER_FAILED', blockers: error.blockers || [], missing: error.missing || [], providerDispatch: error.providerDispatch || null }, error.status || 502);
    }
  }

  const publicOrderCancelMatch = url.pathname.match(/^\/api\/store\/([^/]+)\/orders\/([^/]+)\/cancel$/);
  if (request.method === 'POST' && publicOrderCancelMatch) {
    const slug = decodeURIComponent(publicOrderCancelMatch[1]);
    const orderId = decodeURIComponent(publicOrderCancelMatch[2]);
    const merchant = await dbFirst(env, `SELECT * FROM merchants WHERE slug = ? LIMIT 1`, [slug]);
    if (!merchant) return json({ error: 'Store not found.' }, 404);
    const body = await readJson(request) || {};
    const access = url.searchParams.get('access') || body.access || '';
    const valid = await verifyPublicOrderAccessToken(env.PUBLIC_ORDER_STATUS_SECRET || env.SESSION_SECRET, merchant.slug, orderId, access);
    if (!valid) return json({ error: 'Invalid public order access token.' }, 401);
    const order = await getOrderDetails(env, orderId, merchant.id);
    if (!order) return json({ error: 'Order not found.' }, 404);
    if (['paid', 'refunded'].includes(String(order.paymentStatus || '').toLowerCase())) return json({ error: 'Paid orders cannot be canceled from the public checkout lane.' }, 409);
    await releaseOrderInventoryAfterPaymentFailure(env, merchant.id, order);
    await dbRun(env, `UPDATE payment_transactions SET status = 'voided', updated_at = CURRENT_TIMESTAMP WHERE merchant_id = ? AND order_id = ? AND status IN ('pending', 'authorized')`, [merchant.id, orderId]);
    await dbRun(env, `UPDATE orders SET status = 'cancelled', payment_status = 'voided', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [orderId, merchant.id]);
    await appendOrderEvent(env, orderId, {
      kind: 'checkout_cancelled_public',
      summary: `Public checkout canceled for ${order.orderNumber}`,
      status: 'cancelled',
      paymentStatus: 'voided',
      detail: 'Pending provider checkout was canceled from the public storefront and reserved inventory was released.'
    });
    const refreshedOrder = await getOrderDetails(env, orderId, merchant.id);
    return json({ ok: true, order: refreshedOrder });
  }

  if (request.method === 'POST' && url.pathname === '/api/orders/quote') {
    const body = await readJson(request) || {};
    const merchant = await dbFirst(env, `SELECT * FROM merchants WHERE slug = ? LIMIT 1`, [slugify(body.slug || '')]);
    if (!merchant) return json({ error: 'Store not found.' }, 404);
    const [shippingProfiles, taxProfiles, discountCodes] = await Promise.all([
      listMerchantShipping(env, merchant.id),
      listMerchantTaxes(env, merchant.id),
      listMerchantDiscountCodes(env, merchant.id)
    ]);
    const items = [];
    const storedItems = [];
    for (const entry of Array.isArray(body.items) ? body.items : []) {
      const product = await dbFirst(env, `SELECT * FROM products WHERE id = ? AND merchant_id = ? LIMIT 1`, [entry.productId, merchant.id]);
      if (!product) continue;
      const productView = productRecord(product);
      const variants = await getProductVariants(env, merchant.id, product.id);
      const sellable = resolveSellableVariant(productView, variants, entry);
      const quantity = Math.max(1, Number(entry.quantity || 1));
      items.push({ productId: product.id, variantId: sellable.variantId || '', unitPriceCents: sellable.unitPriceCents, quantity });
      storedItems.push({ productId: product.id, variantId: sellable.variantId || '', title: product.title, variantTitle: sellable.title, optionLabel: sellable.optionLabel, sku: sellable.sku, quantity, unitPriceCents: sellable.unitPriceCents });
    }
    const quote = computeOrderQuote(items, shippingProfiles, taxProfiles, body.location || {}, body.shippingCode || '', body.discountCode || '', discountCodes);
    let giftCard = null;
    let giftCardRedemption = { appliedCents: 0, remainingBalanceCents: 0, reason: 'not_requested' };
    if (body.giftCardCode) {
      giftCard = await findGiftCardByCode(env, merchant.id, body.giftCardCode);
      giftCardRedemption = giftCard ? previewGiftCardRedemption(giftCard, quote.totalCents) : { appliedCents: 0, remainingBalanceCents: 0, reason: 'not_found' };
    }
    return json({ ok: true, quote: { ...quote, items: storedItems, giftCardAppliedCents: giftCardRedemption.appliedCents || 0, giftCardCodeLast4: giftCard?.codeLast4 || '', paymentDueCents: Math.max(0, quote.totalCents - Number(giftCardRedemption.appliedCents || 0)), giftCardRedemption } });
  }

  if (request.method === 'POST' && url.pathname === '/api/orders') {
    const body = await readJson(request) || {};
    const merchant = await dbFirst(env, `SELECT * FROM merchants WHERE slug = ? LIMIT 1`, [slugify(body.slug || '')]);
    if (!merchant) return json({ error: 'Store not found.' }, 404);
    const customer = await resolveCustomerSessionForMerchant(request, env, merchant.id);
    const checkout = body.checkoutSessionId ? await getCheckoutSession(env, merchant.id, String(body.checkoutSessionId)) : null;
    const customerName = String(body.customerName || checkout?.customerName || buildCustomerDisplayName(customer || {})).trim();
    const customerEmail = String(body.customerEmail || checkout?.customerEmail || customer?.email || '').trim().toLowerCase();
    const resolvedLocation = Object.keys(body.location || {}).length ? (body.location || {}) : (checkout?.shippingAddress || customer?.defaultAddress || {});
    if (!customerName || !customerEmail) return json({ error: 'customerName and customerEmail are required unless a customer account is signed in or checkout is recoverable.' }, 400);
    const [shippingProfiles, taxProfiles, discountCodes] = await Promise.all([
      listMerchantShipping(env, merchant.id),
      listMerchantTaxes(env, merchant.id),
      listMerchantDiscountCodes(env, merchant.id)
    ]);
    const rawItems = Array.isArray(body.items) && body.items.length ? body.items : (checkout?.items || []);
    const items = [];
    const storedItems = [];
    for (const entry of rawItems) {
      const product = await dbFirst(env, `SELECT * FROM products WHERE id = ? AND merchant_id = ? LIMIT 1`, [entry.productId, merchant.id]);
      if (!product) continue;
      const productView = productRecord(product);
      const variants = await getProductVariants(env, merchant.id, product.id);
      const sellable = resolveSellableVariant(productView, variants, entry);
      const quantity = Math.max(1, Number(entry.quantity || 1));
      const tracked = sellable.trackInventory || Number(product.track_inventory || 0);
      const available = sellable.variantId ? sellable.inventoryOnHand : Number(product.inventory_on_hand || 0);
      if (tracked && available < quantity) {
        return json({ error: `Insufficient inventory for ${product.title}${sellable.optionLabel ? ` (${sellable.optionLabel})` : ''}.` }, 409);
      }
      items.push({ productId: product.id, variantId: sellable.variantId || '', unitPriceCents: sellable.unitPriceCents, quantity });
      storedItems.push({ productId: product.id, variantId: sellable.variantId || '', title: product.title, variantTitle: sellable.title, optionLabel: sellable.optionLabel, sku: sellable.sku, quantity, unitPriceCents: sellable.unitPriceCents });
    }
    if (!items.length) return json({ error: 'At least one valid product is required.' }, 400);
    const quote = computeOrderQuote(items, shippingProfiles, taxProfiles, resolvedLocation, body.shippingCode || checkout?.quote?.shippingCode || '', body.discountCode || checkout?.quote?.discountCode || '', discountCodes);
    const orderId = uid('ord');
    const orderNumber = `SKY-${String(Date.now()).slice(-8)}`;
    let giftCardApplied = { appliedCents: 0, codeLast4: '', reason: 'not_requested' };
    if (body.giftCardCode) giftCardApplied = await redeemGiftCardForOrder(env, merchant.id, orderId, body.giftCardCode, quote.totalCents);
    const totalDueCents = Math.max(0, quote.totalCents - Number(giftCardApplied.appliedCents || 0));
    const requestedPaymentProvider = normalizePublicCheckoutProvider(body);
    if (totalDueCents > 0 && !requestedPaymentProvider) return json({ error: 'paymentProvider must be stripe or paypal for paid storefront checkout.' }, 400);
    const paymentStatus = totalDueCents === 0 ? 'paid' : 'pending_provider';

    await dbRun(env, `
      INSERT INTO orders (
        id, merchant_id, customer_id, order_number, status, payment_status, payment_reference, currency, customer_name, customer_email,
        shipping_address_json, subtotal_cents, discount_code, discount_cents, shipping_cents, tax_cents, total_cents, items_json, notes,
        gift_card_code_last4, gift_card_cents, checkout_session_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderId,
      merchant.id,
      customer?.id || checkout?.customerId || null,
      orderNumber,
      'received',
      paymentStatus,
      totalDueCents === 0 ? 'gift_card_paid' : '',
      merchant.currency || 'USD',
      customerName,
      customerEmail,
      JSON.stringify(resolvedLocation || {}),
      quote.subtotalCents,
      quote.discountCode || '',
      quote.discountCents,
      quote.shippingCents,
      quote.taxCents,
      totalDueCents,
      JSON.stringify(storedItems),
      body.notes || '',
      giftCardApplied.codeLast4 || '',
      Number(giftCardApplied.appliedCents || 0),
      checkout?.id || null
    ]);

    for (const entry of storedItems) {
      if (entry.variantId) {
        await dbRun(env, `UPDATE product_variants SET inventory_on_hand = MAX(0, inventory_on_hand - ?), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ? AND track_inventory = 1`, [entry.quantity, entry.variantId, merchant.id]);
      }
      await allocateProductInventory(env, merchant.id, entry.productId, entry.quantity, orderId);
    }
    if (quote.discountApplied && quote.discountCode) await dbRun(env, `UPDATE discount_codes SET usage_count = usage_count + 1 WHERE merchant_id = ? AND code = ?`, [merchant.id, quote.discountCode]);
    if (checkout?.id) await dbRun(env, `UPDATE checkout_sessions SET status = 'converted', converted_order_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [orderId, checkout.id, merchant.id]);

    await appendOrderEvent(env, orderId, {
      kind: 'order_created',
      summary: `Order ${orderNumber} received`,
      status: 'received',
      paymentStatus,
      detail: [quote.discountApplied ? `Discount ${quote.discountCode} applied.` : '', giftCardApplied.appliedCents ? `Gift card applied for ${giftCardApplied.appliedCents} cents.` : '', totalDueCents > 0 ? `Waiting for ${requestedPaymentProvider} checkout.` : ''].filter(Boolean).join(' ')
    });

    let createdOrder = await getOrderDetails(env, orderId, merchant.id);
    const customerRow = customer?.id ? await getCustomerById(env, customer.id) : null;
    await updateTaxNexusForOrder(env, merchant.id, createdOrder);
    const risk = await persistRiskAssessment(env, merchant.id, orderId, createdOrder, normalizeRiskSignalInput({
      ipAddress: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '',
      userAgent: request.headers.get('user-agent') || '',
      shippingCountry: resolvedLocation.countryCode || '',
      customerOrderCount: customer?.id ? (await dbAll(env, `SELECT id FROM orders WHERE merchant_id = ? AND customer_id = ?`, [merchant.id, customer.id])).length : 0,
      recentOrderCount: (await dbAll(env, `SELECT id FROM orders WHERE merchant_id = ? AND customer_email = ? AND datetime(created_at) > datetime('now', '-1 day')`, [merchant.id, customerEmail])).length
    }));
    await queueCommerceNotifications(env, 'order_created', {
      merchant: merchantRecord(merchant),
      order: createdOrder,
      customer: customerRow ? { id: customerRow.id, email: customerRow.email, phone: customerRow.phone, firstName: customerRow.first_name, lastName: customerRow.last_name } : customer
    });
    await queueWebhookEvent(env, merchant.id, 'order.created', { order: createdOrder, risk });
    const loyalty = await applyLoyaltyForOrder(env, merchant.id, createdOrder);
    const workflows = await executeWorkflowRules(env, merchant.id, 'order.created', { order: createdOrder, risk, loyalty }, { role: customer?.id ? 'customer' : 'storefront', email: customerEmail });
    await audit(env, merchant.id, 'order.created', `Order ${orderNumber} created`, 'order', orderId, { totalDueCents, giftCardAppliedCents: giftCardApplied.appliedCents || 0, riskDecision: risk.decision, loyaltyPoints: loyalty?.earned?.points || 0, workflowMatches: workflows?.matchedCount || 0 }, { role: customer?.id ? 'customer' : 'storefront', email: customerEmail });

    let paymentSession = null;
    let paymentTransaction = null;
    if (totalDueCents > 0) {
      try {
        const accessToken = await publicOrderAccessToken(env, merchant.slug, orderId);
        const urls = buildPublicCheckoutReturnUrls(buildAbsoluteOrigin(url), merchant.slug, orderId, accessToken);
        const payment = await createHostedOrderPaymentSession(env, merchantRecord(merchant), createdOrder, {
          provider: requestedPaymentProvider,
          amountCents: totalDueCents,
          currency: merchant.currency || 'USD',
          customerEmail,
          returnUrl: urls.returnUrl,
          cancelUrl: urls.cancelUrl,
          metadata: { source: 'public_storefront', orderId, orderNumber }
        }, url);
        paymentSession = payment.session;
        paymentTransaction = payment.transaction;
        if (paymentSession) paymentSession.statusUrl = `${buildAbsoluteOrigin(url)}/api/store/${encodeURIComponent(merchant.slug)}/orders/${encodeURIComponent(orderId)}/status?access=${encodeURIComponent(accessToken)}`;
      } catch (error) {
        await releaseOrderInventoryAfterPaymentFailure(env, merchant.id, createdOrder);
        await dbRun(env, `UPDATE orders SET payment_status = ? WHERE id = ? AND merchant_id = ?`, ['pending_provider_failure', orderId, merchant.id]);
        return json({ error: error.message, code: error.code || 'PAYMENT_PROVIDER_FAILED', blockers: error.blockers || [], missing: error.missing || [], providerDispatch: error.providerDispatch || null, orderId, orderNumber, paymentStatus: 'pending_provider_failure' }, error.status || 502);
      }
      createdOrder = await getOrderDetails(env, orderId, merchant.id);
    }

    return json({
      ok: true,
      orderId,
      orderNumber,
      status: 'received',
      paymentStatus: totalDueCents === 0 ? 'paid' : 'pending_provider',
      quote: { ...quote, giftCardAppliedCents: giftCardApplied.appliedCents || 0, paymentDueCents: totalDueCents },
      customerBound: Boolean(customer?.id),
      risk,
      loyalty,
      workflows,
      order: createdOrder,
      paymentSession,
      paymentTransaction,
      publicStatusUrl: `${buildAbsoluteOrigin(url)}/api/store/${encodeURIComponent(merchant.slug)}/orders/${encodeURIComponent(orderId)}/status?access=${encodeURIComponent(await publicOrderAccessToken(env, merchant.slug, orderId))}`
    }, 201);
  }
  if (request.method === 'GET' && url.pathname === '/api/orders') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const orders = await dbAll(env, `SELECT * FROM orders WHERE merchant_id = ? ORDER BY created_at DESC`, [auth.session.merchantId]);
    return json({ ok: true, orders: orders.map(orderSummary) });
  }

  const orderMatch = url.pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (orderMatch) {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const id = decodeURIComponent(orderMatch[1]);
    const existing = await getOrderDetails(env, id, auth.session.merchantId);
    if (!existing) return json({ error: 'Order not found.' }, 404);
    if (request.method === 'GET') {
      return json({ ok: true, order: existing });
    }
    if (request.method === 'PUT') {
      const patch = normalizeOrderPatch(await readJson(request) || {}, existing);
      await dbRun(env, `
        UPDATE orders
        SET status = ?, payment_status = ?, payment_reference = ?, notes = ?, created_at = created_at
        WHERE id = ? AND merchant_id = ?
      `, [patch.status, patch.paymentStatus, patch.paymentReference, patch.note || existing.notes || '', id, auth.session.merchantId]);
      await appendOrderEvent(env, id, {
        kind: 'order_updated',
        summary: `Order moved to ${patch.status}`,
        status: patch.status,
        paymentStatus: patch.paymentStatus,
        detail: patch.note || patch.paymentReference || 'Manual order update.'
      });
      const refreshedOrder = await getOrderDetails(env, id, auth.session.merchantId);
      if (existing.paymentStatus !== 'paid' && patch.paymentStatus === 'paid') {
        const merchant = await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [auth.session.merchantId]);
        const customerRow = refreshedOrder.customerId ? await getCustomerById(env, refreshedOrder.customerId) : null;
        await queueCommerceNotifications(env, 'payment_paid', {
          merchant: merchantRecord(merchant),
          order: refreshedOrder,
          payment: { status: 'paid', providerReference: patch.paymentReference || '' },
          customer: customerRow ? { id: customerRow.id, email: customerRow.email, phone: customerRow.phone, firstName: customerRow.first_name, lastName: customerRow.last_name } : null
        });
      }
      return json({ ok: true, order: refreshedOrder });
    }
  }

  const orderPaymentsMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/payments$/);
  if (orderPaymentsMatch && request.method === 'GET') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const orderId = decodeURIComponent(orderPaymentsMatch[1]);
    const order = await getOrderDetails(env, orderId, auth.session.merchantId);
    if (!order) return json({ error: 'Order not found.' }, 404);
    return json({ ok: true, payments: order.payments || [] });
  }

  const orderPaymentSessionMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/payments\/session$/);
  if (orderPaymentSessionMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const orderId = decodeURIComponent(orderPaymentSessionMatch[1]);
    const order = await getOrderDetails(env, orderId, auth.session.merchantId);
    if (!order) return json({ error: 'Order not found.' }, 404);
    const merchant = merchantRecord(await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [auth.session.merchantId]));
    try {
      const payment = await createHostedOrderPaymentSession(env, merchant, order, await readJson(request) || {}, url);
      return json({ ok: true, session: payment.session, transaction: payment.transaction }, 201);
    } catch (error) {
      return json({ error: error.message, code: error.code || 'PAYMENT_PROVIDER_FAILED', blockers: error.blockers || [], missing: error.missing || [], providerDispatch: error.providerDispatch || null }, error.status || (error.code === 'PROVIDER_SECRETS_MISSING' ? 409 : 502));
    }
  }

  const orderShippingLabelsMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/shipping-labels$/);
  if (orderShippingLabelsMatch && request.method === 'GET') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const orderId = decodeURIComponent(orderShippingLabelsMatch[1]);
    const order = await getOrderDetails(env, orderId, auth.session.merchantId);
    if (!order) return json({ error: 'Order not found.' }, 404);
    return json({ ok: true, shippingLabels: order.shippingLabels || [] });
  }

  const orderShippingQuotesMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/shipping-labels\/quotes$/);
  if (orderShippingQuotesMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const orderId = decodeURIComponent(orderShippingQuotesMatch[1]);
    const order = await getOrderDetails(env, orderId, auth.session.merchantId);
    if (!order) return json({ error: 'Order not found.' }, 404);
    const body = await readJson(request) || {};
    const profiles = await listMerchantCarrierProfiles(env, auth.session.merchantId);
    const profile = body.carrierProfileId
      ? profiles.find((item) => item.id === body.carrierProfileId)
      : (profiles.find((item) => item.enabled) || null);
    if (!profile) return json({ error: 'No enabled carrier profile found.' }, 409);
    const carrierPolicy = enforceCarrierProviderPolicy(profile.provider, env);
    if (!carrierPolicy.ok) return json({ error: carrierPolicy.message, code: carrierPolicy.code, blockers: carrierPolicy.blockers }, 409);
    const rateRequest = normalizeRateRequest(body, order);
    const connection = await resolveProviderConnection(env, auth.session.merchantId, 'ups', body.providerConnectionId || body.connectionId || '');
    if (!connection) return json({ error: 'No active UPS provider connection found for this merchant.' }, 409);
    try {
      const providerRates = await executeProviderCarrierRates(connection, { rateRequest, context: { orderNumber: order.orderNumber, shippingAddress: order.shippingAddress || {}, currency: order.currency || 'USD' } }, env);
      if (providerRates.status !== 'executed' || !providerRates.rates.length) return json({ error: 'UPS rate request failed.', providerRates }, 502);
      return json({ ok: true, rateRequest, quotes: providerRates.rates, carrierProfile: profile, providerRates });
    } catch (error) {
      return json({ error: error.message, code: error.code || 'CARRIER_RATE_PROVIDER_FAILED', missing: error.missing || [] }, error.code === 'PROVIDER_SECRETS_MISSING' ? 409 : 502);
    }
  }

  const orderShippingPurchaseMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/shipping-labels\/purchase$/);
  if (orderShippingPurchaseMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const orderId = decodeURIComponent(orderShippingPurchaseMatch[1]);
    const order = await getOrderDetails(env, orderId, auth.session.merchantId);
    if (!order) return json({ error: 'Order not found.' }, 404);
    const body = await readJson(request) || {};
    const profiles = await listMerchantCarrierProfiles(env, auth.session.merchantId);
    const profile = body.carrierProfileId
      ? profiles.find((item) => item.id === body.carrierProfileId)
      : (profiles.find((item) => item.enabled) || null);
    if (!profile) return json({ error: 'No enabled carrier profile found.' }, 409);
    const carrierPolicy = enforceCarrierProviderPolicy(profile.provider, env);
    if (!carrierPolicy.ok) return json({ error: carrierPolicy.message, code: carrierPolicy.code, blockers: carrierPolicy.blockers }, 409);
    const input = normalizeLabelPurchaseInput(body, order);
    const rateRequest = normalizeRateRequest(body, order);
    const connection = await resolveProviderConnection(env, auth.session.merchantId, 'ups', input.providerConnectionId || '');
    if (!connection) return json({ error: 'No active UPS provider connection found for this merchant.' }, 409);
    let providerRates = null;
    try {
      providerRates = await executeProviderCarrierRates(connection, { rateRequest, context: { orderNumber: order.orderNumber, shippingAddress: order.shippingAddress || {}, currency: order.currency || 'USD' } }, env);
    } catch (error) {
      return json({ error: error.message, code: error.code || 'CARRIER_RATE_PROVIDER_FAILED', missing: error.missing || [] }, error.code === 'PROVIDER_SECRETS_MISSING' ? 409 : 502);
    }
    const quotes = providerRates.rates || [];
    const selectedRate = quotes.find((item) => item.serviceCode === input.serviceCode) || quotes[0];
    if (providerRates.status !== 'executed' || !selectedRate) return json({ error: 'No live UPS rates available for label purchase.', providerRates }, 502);
    let fulfillmentId = input.fulfillmentId;
    if (!fulfillmentId) {
      fulfillmentId = uid('ful');
      await dbRun(env, `
        INSERT INTO fulfillments (id, order_id, carrier, service, tracking_number, tracking_url, status, note)
        VALUES (?, ?, ?, ?, '', '', ?, ?)
      `, [fulfillmentId, orderId, profile.provider, selectedRate.serviceCode, 'label_created', body.note || 'Label purchased']);
    }
    const labelId = uid('lbl');
    let providerDispatch = null;
    try {
      providerDispatch = await executeNativeProviderDispatch(connection, {
        label: { ...input, serviceCode: selectedRate.serviceCode, packages: input.packages },
        context: { orderNumber: order.orderNumber, shippingAddress: order.shippingAddress || {} }
      }, env);
      if (providerDispatch.status !== 'executed' || !providerDispatch.trackingNumber || !providerDispatch.labelUrl) return json({ error: 'UPS label purchase failed.', providerDispatch }, 502);
    } catch (error) {
      return json({ error: error.message, code: error.code || 'CARRIER_PROVIDER_FAILED', missing: error.missing || [] }, error.code === 'PROVIDER_SECRETS_MISSING' ? 409 : 502);
    }
    const purchased = purchaseShippingLabel({ profile, order, input, selectedRate, providerDispatch });
    await dbRun(env, `
      UPDATE fulfillments
      SET carrier = ?, service = ?, tracking_number = ?, tracking_url = ?, status = ?, note = ?, created_at = created_at
      WHERE id = ? AND order_id = ?
    `, [purchased.provider, selectedRate.serviceCode, purchased.trackingNumber, purchased.trackingUrl, 'label_created', body.note || 'Label purchased', fulfillmentId, orderId]);
    await dbRun(env, `
      INSERT INTO shipping_labels (id, merchant_id, order_id, fulfillment_id, provider, service_code, tracking_number, tracking_url, label_url, rate_cents, currency, status, package_summary, meta_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [labelId, auth.session.merchantId, orderId, fulfillmentId, purchased.provider, selectedRate.serviceCode, purchased.trackingNumber, purchased.trackingUrl, purchased.labelUrl, purchased.rateCents, purchased.currency, purchased.status, purchased.packageSummary, JSON.stringify(purchased.meta || {})]);
    await dbRun(env, `UPDATE orders SET status = CASE WHEN status IN ('received', 'confirmed') THEN 'packed' ELSE status END WHERE id = ? AND merchant_id = ?`, [orderId, auth.session.merchantId]);
    await appendOrderEvent(env, orderId, {
      kind: 'shipping_label_purchased',
      summary: `Shipping label ${purchased.trackingNumber} purchased`,
      status: 'packed',
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: 'label_created',
      detail: `${purchased.provider} · ${selectedRate.serviceCode} · ${purchased.labelUrl}`
    });
    const refreshedOrder = await getOrderDetails(env, orderId, auth.session.merchantId);
    const merchant = await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [auth.session.merchantId]);
    const customerRow = refreshedOrder.customerId ? await getCustomerById(env, refreshedOrder.customerId) : null;
    await queueCommerceNotifications(env, 'fulfillment_created', {
      merchant: merchantRecord(merchant),
      order: refreshedOrder,
      fulfillment: { carrier: purchased.provider, service: selectedRate.serviceCode, trackingNumber: purchased.trackingNumber, trackingUrl: purchased.trackingUrl, status: 'label_created', note: 'Shipping label purchased' },
      customer: customerRow ? { id: customerRow.id, email: customerRow.email, phone: customerRow.phone, firstName: customerRow.first_name, lastName: customerRow.last_name } : null
    });
    return json({ ok: true, label: shippingLabelRecord(await dbFirst(env, `SELECT * FROM shipping_labels WHERE id = ? LIMIT 1`, [labelId])), quotes, order: refreshedOrder }, 201);
  }


  const fulfillmentMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/fulfillments$/);
  if (fulfillmentMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const orderId = decodeURIComponent(fulfillmentMatch[1]);
    const order = await getOrderDetails(env, orderId, auth.session.merchantId);
    if (!order) return json({ error: 'Order not found.' }, 404);
    const payload = normalizeFulfillmentInput(await readJson(request) || {});
    if (!payload.trackingNumber && !payload.note) return json({ error: 'trackingNumber or note is required for a fulfillment record.' }, 400);
    const id = uid('ful');
    await dbRun(env, `
      INSERT INTO fulfillments (id, order_id, carrier, service, tracking_number, tracking_url, status, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, orderId, payload.carrier, payload.service, payload.trackingNumber, payload.trackingUrl, payload.status, payload.note]);
    await dbRun(env, `UPDATE orders SET status = ? WHERE id = ? AND merchant_id = ?`, ['fulfilled', orderId, auth.session.merchantId]);
    await appendOrderEvent(env, orderId, {
      kind: 'fulfillment_created',
      summary: payload.trackingNumber ? `Tracking ${payload.trackingNumber} created` : 'Fulfillment note added',
      status: 'fulfilled',
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: payload.status,
      detail: payload.note || payload.trackingUrl || payload.service || payload.carrier || ''
    });
    const refreshedOrder = await getOrderDetails(env, orderId, auth.session.merchantId);
    const merchant = await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [auth.session.merchantId]);
    const customerRow = refreshedOrder.customerId ? await getCustomerById(env, refreshedOrder.customerId) : null;
    await queueCommerceNotifications(env, 'fulfillment_created', {
      merchant: merchantRecord(merchant),
      order: refreshedOrder,
      fulfillment: { carrier: payload.carrier, service: payload.service, trackingNumber: payload.trackingNumber, trackingUrl: payload.trackingUrl, status: payload.status, note: payload.note },
      customer: customerRow ? { id: customerRow.id, email: customerRow.email, phone: customerRow.phone, firstName: customerRow.first_name, lastName: customerRow.last_name } : null
    });
    return json({ ok: true, fulfillment: fulfillmentRecord(await dbFirst(env, `SELECT * FROM fulfillments WHERE id = ? LIMIT 1`, [id])), order: refreshedOrder }, 201);
  }


  if (request.method === 'GET' && url.pathname === '/api/fulfillment-sync/jobs') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, jobs: await listFulfillmentSyncJobs(env, auth.session.merchantId) });
  }

  const orderFulfillmentSyncMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/fulfillment-sync$/);
  if (orderFulfillmentSyncMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const orderId = decodeURIComponent(orderFulfillmentSyncMatch[1]);
    const body = await readJson(request) || {};
    const order = await getOrderDetails(env, orderId, auth.session.merchantId);
    if (!order) return json({ error: 'Order not found.' }, 404);
    const merchant = merchantRecord(await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [auth.session.merchantId]));
    const targetUrl = requireHttpsUrl(body.targetUrl || env.FULFILLMENT_SYNC_URL || '', 'targetUrl');
    const payload = buildFulfillmentSyncPayload({ merchant, order, fulfillments: order.fulfillments || [], shippingLabels: order.shippingLabels || [], returnRequests: order.returns || [], eventType: body.eventType || 'order.fulfillment_sync' });
    const jobId = uid('fsync');
    await dbRun(env, `INSERT INTO fulfillment_sync_jobs (id, merchant_id, order_id, target, status, request_json) VALUES (?, ?, ?, ?, 'running', ?)`, [jobId, auth.session.merchantId, orderId, targetUrl, JSON.stringify(payload)]);
    try {
      const result = await executeSignedJsonPost({ url: targetUrl, payload, secret: body.signingSecret || env.FULFILLMENT_SYNC_SECRET || '', eventType: payload.eventType });
      await dbRun(env, `UPDATE fulfillment_sync_jobs SET status = ?, http_status = ?, response_json = ?, error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [result.status, result.httpStatus, JSON.stringify(result.response || {}), result.ok ? '' : `HTTP ${result.httpStatus}`, jobId]);
      await appendOrderEvent(env, orderId, { kind: 'fulfillment_sync', summary: `Fulfillment sync ${result.status}`, status: order.status, paymentStatus: order.paymentStatus, fulfillmentStatus: order.fulfillments?.[0]?.status || '', detail: `${targetUrl} · HTTP ${result.httpStatus}` });
      return json({ ok: result.ok, job: fulfillmentSyncJobRecord(await dbFirst(env, `SELECT * FROM fulfillment_sync_jobs WHERE id = ? LIMIT 1`, [jobId])) }, result.ok ? 201 : 502);
    } catch (error) {
      await dbRun(env, `UPDATE fulfillment_sync_jobs SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [error.message, jobId]);
      return json({ error: error.message, job: fulfillmentSyncJobRecord(await dbFirst(env, `SELECT * FROM fulfillment_sync_jobs WHERE id = ? LIMIT 1`, [jobId])) }, 502);
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/routex/handoffs') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, handoffs: await listRoutexHandoffs(env, auth.session.merchantId) });
  }

  const orderRoutexMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/routex\/dispatch$/);
  if (orderRoutexMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const orderId = decodeURIComponent(orderRoutexMatch[1]);
    const body = await readJson(request) || {};
    const order = await getOrderDetails(env, orderId, auth.session.merchantId);
    if (!order) return json({ error: 'Order not found.' }, 404);
    const merchant = merchantRecord(await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [auth.session.merchantId]));
    const payload = buildRoutexHandoffPayload({ merchant, order, kind: body.kind || 'delivery', routeDate: body.routeDate || '', note: body.note || '' });
    const id = uid('rtx');
    await dbRun(env, `INSERT INTO routex_handoffs (id, merchant_id, order_id, kind, status, route_date, request_json) VALUES (?, ?, ?, ?, 'running', ?, ?)`, [id, auth.session.merchantId, orderId, payload.kind, payload.routeDate, JSON.stringify(payload)]);
    try {
      const result = await executeRoutexHandoff(env, payload);
      await dbRun(env, `UPDATE routex_handoffs SET status = ?, external_ref = ?, response_json = ?, error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [result.status, result.externalRef, JSON.stringify(result.response || {}), result.ok ? '' : `HTTP ${result.httpStatus}`, id]);
      await appendOrderEvent(env, orderId, { kind: 'routex_handoff', summary: `Routex handoff ${result.status}`, status: order.status, paymentStatus: order.paymentStatus, fulfillmentStatus: order.fulfillments?.[0]?.status || '', detail: result.externalRef || payload.routeDate });
      return json({ ok: result.ok, handoff: routexHandoffRecord(await dbFirst(env, `SELECT * FROM routex_handoffs WHERE id = ? LIMIT 1`, [id])) }, result.ok ? 201 : 502);
    } catch (error) {
      await dbRun(env, `UPDATE routex_handoffs SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [error.message, id]);
      return json({ error: error.message, handoff: routexHandoffRecord(await dbFirst(env, `SELECT * FROM routex_handoffs WHERE id = ? LIMIT 1`, [id])) }, 502);
    }
  }

  const orderReturnCreateMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/returns$/);
  if (orderReturnCreateMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const orderId = decodeURIComponent(orderReturnCreateMatch[1]);
    const order = await getOrderDetails(env, orderId, auth.session.merchantId);
    if (!order) return json({ error: 'Order not found.' }, 404);
    const body = normalizeReturnRequestInput(await readJson(request) || {}, order);
    if (!body.items.length) return json({ error: 'At least one return line is required.' }, 400);
    const id = uid('ret');
    await dbRun(env, `
      INSERT INTO order_returns (
        id, merchant_id, order_id, customer_id, status, reason, customer_note, merchant_note, resolution_type,
        items_json, requested_cents, approved_cents, refund_reference, restock_items
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, auth.session.merchantId, orderId, order.customerId || null, 'requested', body.reason, body.customerNote, '', body.resolutionType, JSON.stringify(body.items), body.requestedCents, 0, '', body.restockItems ? 1 : 0]);
    await appendOrderEvent(env, orderId, {
      kind: 'return_requested',
      summary: `Return requested for ${order.orderNumber}`,
      status: order.status,
      paymentStatus: order.paymentStatus,
      detail: body.reason || body.customerNote || 'Return created from merchant command.'
    });
    const refreshedOrder = await getOrderDetails(env, orderId, auth.session.merchantId);
    const freshReturn = await getReturnDetails(env, id, auth.session.merchantId);
    const merchant = await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [auth.session.merchantId]);
    const customerRow = refreshedOrder.customerId ? await getCustomerById(env, refreshedOrder.customerId) : null;
    await queueCommerceNotifications(env, 'return_requested', {
      merchant: merchantRecord(merchant),
      order: refreshedOrder,
      returnRequest: freshReturn,
      customer: customerRow ? { id: customerRow.id, email: customerRow.email, phone: customerRow.phone, firstName: customerRow.first_name, lastName: customerRow.last_name } : null
    });
    return json({ ok: true, returnRequest: freshReturn, order: refreshedOrder }, 201);
  }


  if (request.method === 'GET' && url.pathname === '/api/warehouse/bins') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, bins: await listWarehouseBins(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/warehouse/bins') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeWarehouseBinInput(await readJson(request) || {});
    if (!payload.locationId || !payload.code) return json({ error: 'locationId and code are required.' }, 400);
    const id = uid('wbin');
    await dbRun(env, `INSERT INTO warehouse_bins (id, merchant_id, location_id, code, label, zone, aisle, shelf, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.locationId, payload.code, payload.label, payload.zone, payload.aisle, payload.shelf, payload.active ? 1 : 0]);
    return json({ ok: true, bin: warehouseBinRecord(await dbFirst(env, `SELECT * FROM warehouse_bins WHERE id = ? LIMIT 1`, [id])) }, 201);
  }


  const warehouseBinMatch = url.pathname.match(/^\/api\/warehouse\/bins\/([^/]+)$/);
  if (warehouseBinMatch && request.method === 'PATCH') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const binId = decodeURIComponent(warehouseBinMatch[1]);
    const existing = await dbFirst(env, `SELECT * FROM warehouse_bins WHERE id = ? AND merchant_id = ? LIMIT 1`, [binId, auth.session.merchantId]);
    if (!existing) return json({ error: 'Warehouse bin not found.' }, 404);
    const payload = normalizeWarehouseBinInput({ ...warehouseBinRecord(existing), ...(await readJson(request) || {}) });
    if (!payload.locationId || !payload.code) return json({ error: 'locationId and code are required.' }, 400);
    await dbRun(env, `UPDATE warehouse_bins SET location_id = ?, code = ?, label = ?, zone = ?, aisle = ?, shelf = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [payload.locationId, payload.code, payload.label, payload.zone, payload.aisle, payload.shelf, payload.active ? 1 : 0, binId, auth.session.merchantId]);
    await audit(env, auth.session.merchantId, 'warehouse.bin.updated', `Updated warehouse bin ${payload.code}`, 'warehouse_bin', binId, { locationId: payload.locationId }, auth.session);
    return json({ ok: true, bin: warehouseBinRecord(await dbFirst(env, `SELECT * FROM warehouse_bins WHERE id = ? LIMIT 1`, [binId])) });
  }

  if (request.method === 'GET' && url.pathname === '/api/warehouse/bin-inventory') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, inventory: await listWarehouseBinInventory(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/warehouse/bin-inventory') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeBinInventoryInput(await readJson(request) || {});
    if (!payload.binId || !payload.productId) return json({ error: 'binId and productId are required.' }, 400);
    const existing = await dbFirst(env, `SELECT * FROM warehouse_bin_inventory WHERE merchant_id = ? AND bin_id = ? AND product_id = ? AND variant_id = ? LIMIT 1`, [auth.session.merchantId, payload.binId, payload.productId, payload.variantId || '']);
    if (existing) {
      await dbRun(env, `UPDATE warehouse_bin_inventory SET quantity = ?, reserved_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [payload.quantity, payload.reservedQuantity, existing.id]);
      return json({ ok: true, inventory: warehouseBinInventoryRecord(await dbFirst(env, `SELECT * FROM warehouse_bin_inventory WHERE id = ? LIMIT 1`, [existing.id])) });
    }
    const id = uid('wbi');
    await dbRun(env, `INSERT INTO warehouse_bin_inventory (id, merchant_id, bin_id, product_id, variant_id, quantity, reserved_quantity) VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.binId, payload.productId, payload.variantId || '', payload.quantity, payload.reservedQuantity]);
    return json({ ok: true, inventory: warehouseBinInventoryRecord(await dbFirst(env, `SELECT * FROM warehouse_bin_inventory WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/warehouse/pick-lists') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, pickLists: await listWarehousePickLists(env, auth.session.merchantId) });
  }

  const orderPickListMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/warehouse\/pick-list$/);
  if (orderPickListMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const orderId = decodeURIComponent(orderPickListMatch[1]);
    const order = await getOrderDetails(env, orderId, auth.session.merchantId);
    if (!order) return json({ error: 'Order not found.' }, 404);
    const inventory = await listWarehouseBinInventory(env, auth.session.merchantId);
    const pick = buildPickListFromOrder({ order, bins: inventory });
    const id = uid('wpl');
    await dbRun(env, `INSERT INTO warehouse_pick_lists (id, merchant_id, order_id, work_order_id, status, lines_json) VALUES (?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, orderId, '', pick.status, JSON.stringify(pick.lines || [])]);
    return json({ ok: true, pickList: pickListRecord(await dbFirst(env, `SELECT * FROM warehouse_pick_lists WHERE id = ? LIMIT 1`, [id])) }, 201);
  }


  const warehousePickListMatch = url.pathname.match(/^\/api\/warehouse\/pick-lists\/([^/]+)$/);
  if (warehousePickListMatch && request.method === 'GET') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const pickListId = decodeURIComponent(warehousePickListMatch[1]);
    const row = await dbFirst(env, `SELECT * FROM warehouse_pick_lists WHERE id = ? AND merchant_id = ? LIMIT 1`, [pickListId, auth.session.merchantId]);
    if (!row) return json({ error: 'Pick list not found.' }, 404);
    return json({ ok: true, pickList: pickListRecord(row) });
  }

  const warehousePickListScanMatch = url.pathname.match(/^\/api\/warehouse\/pick-lists\/([^/]+)\/scan$/);
  if (warehousePickListScanMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const pickListId = decodeURIComponent(warehousePickListScanMatch[1]);
    const row = await dbFirst(env, `SELECT * FROM warehouse_pick_lists WHERE id = ? AND merchant_id = ? LIMIT 1`, [pickListId, auth.session.merchantId]);
    if (!row) return json({ error: 'Pick list not found.' }, 404);
    const scan = normalizePickScanInput(await readJson(request) || {});
    if (!scan.lineId || !scan.binId || !scan.quantity) return json({ error: 'lineId, binId, and quantity are required.' }, 400);
    let next;
    try {
      next = applyPickScanToLines(JSON.parse(row.lines_json || '[]'), scan);
    } catch (error) {
      return json({ error: error.message, code: error.code || 'WAREHOUSE_PICK_SCAN_INVALID' }, 409);
    }
    const line = next.lines.find((item) => String(item.id) === String(scan.lineId));
    const productId = line?.productId || '';
    const variantId = line?.variantId || '';
    const inv = await dbFirst(env, `SELECT * FROM warehouse_bin_inventory WHERE merchant_id = ? AND bin_id = ? AND product_id = ? AND variant_id = ? LIMIT 1`, [auth.session.merchantId, scan.binId, productId, variantId]);
    if (inv) {
      const nextQty = Math.max(0, Number(inv.quantity || 0) - scan.quantity);
      const nextReserved = Math.max(0, Number(inv.reserved_quantity || 0) - scan.quantity);
      await dbRun(env, `UPDATE warehouse_bin_inventory SET quantity = ?, reserved_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [nextQty, nextReserved, inv.id]);
    }
    await dbRun(env, `UPDATE warehouse_pick_lists SET status = ?, lines_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [next.status, JSON.stringify(next.lines || []), pickListId, auth.session.merchantId]);
    await audit(env, auth.session.merchantId, 'warehouse.pick_list.scanned', `Scanned ${scan.quantity} units on pick list ${pickListId}`, 'warehouse_pick_list', pickListId, { lineId: scan.lineId, binId: scan.binId, packed: scan.packed }, auth.session);
    return json({ ok: true, pickList: pickListRecord(await dbFirst(env, `SELECT * FROM warehouse_pick_lists WHERE id = ? LIMIT 1`, [pickListId])) });
  }

  const warehousePickListCompleteMatch = url.pathname.match(/^\/api\/warehouse\/pick-lists\/([^/]+)\/complete$/);
  if (warehousePickListCompleteMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const pickListId = decodeURIComponent(warehousePickListCompleteMatch[1]);
    const row = await dbFirst(env, `SELECT * FROM warehouse_pick_lists WHERE id = ? AND merchant_id = ? LIMIT 1`, [pickListId, auth.session.merchantId]);
    if (!row) return json({ error: 'Pick list not found.' }, 404);
    const lines = JSON.parse(row.lines_json || '[]');
    const incomplete = lines.find((item) => !['picked', 'packed'].includes(String(item.status || '')));
    if (incomplete) return json({ error: 'All pick-list lines must be picked before completion.' }, 409);
    await dbRun(env, `UPDATE warehouse_pick_lists SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [pickListId, auth.session.merchantId]);
    await audit(env, auth.session.merchantId, 'warehouse.pick_list.completed', `Completed pick list ${pickListId}`, 'warehouse_pick_list', pickListId, {}, auth.session);
    return json({ ok: true, pickList: pickListRecord(await dbFirst(env, `SELECT * FROM warehouse_pick_lists WHERE id = ? LIMIT 1`, [pickListId])) });
  }

  if (request.method === 'GET' && url.pathname === '/api/warehouse/work-orders') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, workOrders: await listWarehouseWorkOrders(env, auth.session.merchantId) });
  }

  const orderWarehouseWorkOrderMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/warehouse-work-order$/);
  if (orderWarehouseWorkOrderMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const orderId = decodeURIComponent(orderWarehouseWorkOrderMatch[1]);
    const order = await getOrderDetails(env, orderId, auth.session.merchantId);
    if (!order) return json({ error: 'Order not found.' }, 404);
    const body = await readJson(request) || {};
    const merchant = merchantRecord(await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [auth.session.merchantId]));
    const normalized = normalizeWarehouseWorkOrderInput(body, order);
    const workOrderId = uid('whwo');
    const payload = buildWarehouseWorkOrderPayload({
      merchant,
      order,
      workOrder: { id: workOrderId, locationId: normalized.locationId, priority: normalized.priority, dueAt: normalized.dueAt, instructions: normalized.instructions, requireCarrierLabel: normalized.requireCarrierLabel, items: normalized.items, status: 'submitted' },
      allocations: order.allocations || [],
      shippingLabels: order.shippingLabels || [],
      routexHandoffs: order.routexHandoffs || []
    });
    await dbRun(env, `INSERT INTO warehouse_work_orders (id, merchant_id, order_id, location_id, priority, status, due_at, request_json) VALUES (?, ?, ?, ?, ?, 'running', ?, ?)`, [workOrderId, auth.session.merchantId, orderId, normalized.locationId || '', normalized.priority, normalized.dueAt || '', JSON.stringify(payload)]);
    try {
      const result = await executeWarehouseWorkOrder(env, payload);
      await dbRun(env, `UPDATE warehouse_work_orders SET status = ?, external_ref = ?, http_status = ?, response_json = ?, error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [result.status, result.externalRef || '', result.httpStatus || 0, JSON.stringify(result.response || {}), result.ok ? '' : `HTTP ${result.httpStatus}`, workOrderId]);
      return json({ ok: result.ok, workOrder: (await listWarehouseWorkOrders(env, auth.session.merchantId)).find((item) => item.id === workOrderId) }, result.ok ? 201 : 502);
    } catch (error) {
      await dbRun(env, `UPDATE warehouse_work_orders SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [error.message, workOrderId]);
      return json({ error: error.message, code: error.code || 'WAREHOUSE_WORK_ORDER_FAILED', workOrder: (await listWarehouseWorkOrders(env, auth.session.merchantId)).find((item) => item.id === workOrderId) }, 502);
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/shipment-events') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, events: await listShipmentTrackingEvents(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/shipment-events/ups/webhook') {
    const raw = await request.text();
    const verified = await verifySignedJsonWebhook({ rawBody: raw, secret: env.SHIPMENT_WEBHOOK_SECRET || env.UPS_SHIPMENT_WEBHOOK_SECRET || '', signatureHeader: request.headers.get('x-skye-signature') || '' });
    if (!verified) return json({ error: 'Invalid shipment webhook signature.' }, 401);
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch { return json({ error: 'Malformed shipment webhook body.' }, 400); }
    const payload = normalizeShipmentTrackingEvent(body);
    const label = payload.labelId
      ? await dbFirst(env, `SELECT * FROM shipping_labels WHERE id = ? LIMIT 1`, [payload.labelId])
      : await dbFirst(env, `SELECT * FROM shipping_labels WHERE tracking_number = ? LIMIT 1`, [payload.trackingNumber]);
    if (!label) return json({ error: 'Shipping label not found.' }, 404);
    const fulfillment = payload.fulfillmentId
      ? await dbFirst(env, `SELECT * FROM fulfillments WHERE id = ? LIMIT 1`, [payload.fulfillmentId])
      : await dbFirst(env, `SELECT * FROM fulfillments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1`, [label.order_id]);
    const id = uid('shipevt');
    await dbRun(env, `INSERT INTO shipment_tracking_events (id, merchant_id, order_id, label_id, fulfillment_id, provider, tracking_number, status, event_type, event_time, location, detail, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, label.merchant_id, label.order_id, label.id, fulfillment?.id || '', payload.provider, payload.trackingNumber, payload.status, payload.eventType, payload.eventTime, payload.location, payload.detail, JSON.stringify(payload.raw || {})]);
    const mapped = nextFulfillmentStatusFromShipment(payload.status);
    await dbRun(env, `UPDATE shipping_labels SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [mapped.labelStatus || payload.status, label.id]);
    if (fulfillment?.id) await dbRun(env, `UPDATE fulfillments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [mapped.fulfillmentStatus || payload.status, fulfillment.id]);
    if (mapped.orderStatus) await dbRun(env, `UPDATE orders SET status = ? WHERE id = ?`, [mapped.orderStatus, label.order_id]);
    return json({ ok: true, event: shipmentTrackingEventRecord(await dbFirst(env, `SELECT * FROM shipment_tracking_events WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/routex/drivers') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, drivers: await listRouteDrivers(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/routex/drivers') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeRouteDriverInput(await readJson(request) || {});
    if (!payload.name) return json({ error: 'name is required.' }, 400);
    const id = uid('drv');
    await dbRun(env, `INSERT INTO route_drivers (id, merchant_id, name, phone, email, status) VALUES (?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.name, payload.phone, payload.email, payload.status]);
    return json({ ok: true, driver: routeDriverRecord(await dbFirst(env, `SELECT * FROM route_drivers WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/routex/vehicles') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, vehicles: await listRouteVehicles(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/routex/vehicles') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeRouteVehicleInput(await readJson(request) || {});
    if (!payload.label) return json({ error: 'label is required.' }, 400);
    const id = uid('veh');
    await dbRun(env, `INSERT INTO route_vehicles (id, merchant_id, driver_id, label, capacity, status) VALUES (?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.driverId, payload.label, payload.capacity, payload.status]);
    return json({ ok: true, vehicle: routeVehicleRecord(await dbFirst(env, `SELECT * FROM route_vehicles WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/routex/plans') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, plans: await listRoutePlans(env, auth.session.merchantId) });
  }

  const routePlanEventsMatch = url.pathname.match(/^\/api\/routex\/plans\/([^/]+)\/events$/);
  if (routePlanEventsMatch && request.method === 'GET') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const planId = decodeURIComponent(routePlanEventsMatch[1]);
    const existing = await dbFirst(env, `SELECT * FROM route_plans WHERE id = ? AND merchant_id = ? LIMIT 1`, [planId, auth.session.merchantId]);
    if (!existing) return json({ error: 'Route plan not found.' }, 404);
    return json({ ok: true, events: await listRoutePlanEvents(env, auth.session.merchantId, planId) });
  }

  const routePlanDispatchMatch = url.pathname.match(/^\/api\/routex\/plans\/([^/]+)\/dispatch$/);
  if (routePlanDispatchMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const planId = decodeURIComponent(routePlanDispatchMatch[1]);
    const existing = await dbFirst(env, `SELECT * FROM route_plans WHERE id = ? AND merchant_id = ? LIMIT 1`, [planId, auth.session.merchantId]);
    if (!existing) return json({ error: 'Route plan not found.' }, 404);
    const current = routePlanRecord(existing);
    if (current.status === 'completed') return json({ error: 'Completed route plans cannot be re-dispatched.' }, 409);
    const nextStops = (current.stops || []).map((stop, index) => ({ ...stop, id: stop.id || stop.stopId || `stop_${index + 1}`, status: stop.status || 'queued' }));
    await dbRun(env, `UPDATE route_plans SET status = 'dispatched', stops_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [JSON.stringify(nextStops), planId, auth.session.merchantId]);
    await audit(env, auth.session.merchantId, 'routex.plan.dispatched', `Dispatched route plan ${planId}`, 'route_plan', planId, { stopCount: nextStops.length }, auth.session);
    return json({ ok: true, plan: routePlanRecord(await dbFirst(env, `SELECT * FROM route_plans WHERE id = ? LIMIT 1`, [planId])) });
  }

  const routePlanStopEventMatch = url.pathname.match(/^\/api\/routex\/plans\/([^/]+)\/stops\/([^/]+)\/event$/);
  if (routePlanStopEventMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const planId = decodeURIComponent(routePlanStopEventMatch[1]);
    const stopId = decodeURIComponent(routePlanStopEventMatch[2]);
    const existing = await dbFirst(env, `SELECT * FROM route_plans WHERE id = ? AND merchant_id = ? LIMIT 1`, [planId, auth.session.merchantId]);
    if (!existing) return json({ error: 'Route plan not found.' }, 404);
    const eventInput = normalizeRouteStopEventInput(await readJson(request) || {});
    let applied;
    try {
      applied = applyRouteStopEventToStops(routePlanRecord(existing).stops || [], stopId, eventInput);
    } catch (error) {
      return json({ error: error.message, code: error.code || 'ROUTE_STOP_EVENT_INVALID' }, 409);
    }
    await dbRun(env, `UPDATE route_plans SET status = ?, stops_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [applied.status, JSON.stringify(applied.stops || []), planId, auth.session.merchantId]);
    const stop = applied.stop || {};
    const eventId = uid('rpev');
    const proof = { note: eventInput.note, proofUrl: eventInput.proofUrl, latitude: eventInput.latitude, longitude: eventInput.longitude, occurredAt: eventInput.occurredAt };
    await dbRun(env, `INSERT INTO route_plan_events (id, merchant_id, route_plan_id, stop_id, order_id, return_pickup_id, event_type, status, proof_json, actor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [eventId, auth.session.merchantId, planId, stopId, stop.orderId || '', stop.returnPickupId || '', eventInput.eventType, eventInput.status, JSON.stringify(proof), eventInput.actor || auth.session.email || '']);
    if (stop.orderId) {
      await appendOrderEvent(env, stop.orderId, {
        kind: 'routex_stop_event',
        summary: `Route stop ${eventInput.status}`,
        status: '',
        paymentStatus: '',
        detail: [stop.label || stop.title || stopId, eventInput.note].filter(Boolean).join(' · ')
      });
    }
    if (stop.returnPickupId) {
      const pickupStatus = eventInput.status === 'picked_up' ? 'completed' : (eventInput.status === 'failed' ? 'failed' : (eventInput.status === 'skipped' ? 'cancelled' : 'in_progress'));
      await dbRun(env, `UPDATE return_pickups SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [pickupStatus, stop.returnPickupId, auth.session.merchantId]);
    }
    await audit(env, auth.session.merchantId, 'routex.stop.event.recorded', `Recorded ${eventInput.status} on route stop ${stopId}`, 'route_plan', planId, { stopId, eventType: eventInput.eventType }, auth.session);
    return json({ ok: true, plan: routePlanRecord(await dbFirst(env, `SELECT * FROM route_plans WHERE id = ? LIMIT 1`, [planId])), event: routePlanEventRecord(await dbFirst(env, `SELECT * FROM route_plan_events WHERE id = ? LIMIT 1`, [eventId])) }, 201);
  }

  if (request.method === 'POST' && url.pathname === '/api/routex/plans') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeRoutePlanInput(await readJson(request) || {});
    const built = buildRoutePlan({ start: payload.start || {}, stops: payload.stops || [] });
    const stops = (built.stops || []).map((stop, index) => ({ ...stop, id: stop.id || stop.stopId || uid('stop'), status: stop.status || 'queued', sequence: stop.sequence || index + 1 }));
    const id = uid('rplan');
    await dbRun(env, `INSERT INTO route_plans (id, merchant_id, driver_id, vehicle_id, status, route_date, stops_json) VALUES (?, ?, ?, ?, 'planned', ?, ?)`, [id, auth.session.merchantId, payload.driverId, payload.vehicleId, payload.routeDate, JSON.stringify(stops)]);
    return json({ ok: true, plan: routePlanRecord(await dbFirst(env, `SELECT * FROM route_plans WHERE id = ? LIMIT 1`, [id])) }, 201);
  }


  const routeDriverMatch = url.pathname.match(/^\/api\/routex\/drivers\/([^/]+)$/);
  if (routeDriverMatch && request.method === 'PATCH') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const driverId = decodeURIComponent(routeDriverMatch[1]);
    const existing = await dbFirst(env, `SELECT * FROM route_drivers WHERE id = ? AND merchant_id = ? LIMIT 1`, [driverId, auth.session.merchantId]);
    if (!existing) return json({ error: 'Driver not found.' }, 404);
    const payload = normalizeRouteDriverInput({ ...routeDriverRecord(existing), ...(await readJson(request) || {}) });
    if (!payload.name) return json({ error: 'name is required.' }, 400);
    await dbRun(env, `UPDATE route_drivers SET name = ?, phone = ?, email = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [payload.name, payload.phone, payload.email, payload.status, driverId, auth.session.merchantId]);
    return json({ ok: true, driver: routeDriverRecord(await dbFirst(env, `SELECT * FROM route_drivers WHERE id = ? LIMIT 1`, [driverId])) });
  }

  const routeVehicleMatch = url.pathname.match(/^\/api\/routex\/vehicles\/([^/]+)$/);
  if (routeVehicleMatch && request.method === 'PATCH') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const vehicleId = decodeURIComponent(routeVehicleMatch[1]);
    const existing = await dbFirst(env, `SELECT * FROM route_vehicles WHERE id = ? AND merchant_id = ? LIMIT 1`, [vehicleId, auth.session.merchantId]);
    if (!existing) return json({ error: 'Vehicle not found.' }, 404);
    const payload = normalizeRouteVehicleInput({ ...routeVehicleRecord(existing), ...(await readJson(request) || {}) });
    if (!payload.label) return json({ error: 'label is required.' }, 400);
    await dbRun(env, `UPDATE route_vehicles SET driver_id = ?, label = ?, capacity = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [payload.driverId, payload.label, payload.capacity, payload.status, vehicleId, auth.session.merchantId]);
    return json({ ok: true, vehicle: routeVehicleRecord(await dbFirst(env, `SELECT * FROM route_vehicles WHERE id = ? LIMIT 1`, [vehicleId])) });
  }

  const routePlanMatch = url.pathname.match(/^\/api\/routex\/plans\/([^/]+)$/);
  if (routePlanMatch && request.method === 'PATCH') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const planId = decodeURIComponent(routePlanMatch[1]);
    const existing = await dbFirst(env, `SELECT * FROM route_plans WHERE id = ? AND merchant_id = ? LIMIT 1`, [planId, auth.session.merchantId]);
    if (!existing) return json({ error: 'Route plan not found.' }, 404);
    const payload = normalizeRoutePlanPatch(await readJson(request) || {}, existing);
    const built = buildRoutePlan({ start: {}, stops: payload.stops || [] });
    const stops = (built.stops || []).map((stop, index) => ({ ...stop, id: stop.id || stop.stopId || uid('stop'), status: stop.status || 'queued', sequence: stop.sequence || index + 1 }));
    await dbRun(env, `UPDATE route_plans SET driver_id = ?, vehicle_id = ?, status = ?, route_date = ?, stops_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [payload.driverId, payload.vehicleId, payload.status, payload.routeDate, JSON.stringify(stops), planId, auth.session.merchantId]);
    await audit(env, auth.session.merchantId, 'routex.plan.updated', `Updated route plan ${planId}`, 'route_plan', planId, { status: payload.status }, auth.session);
    return json({ ok: true, plan: routePlanRecord(await dbFirst(env, `SELECT * FROM route_plans WHERE id = ? LIMIT 1`, [planId])) });
  }

  if (request.method === 'GET' && url.pathname === '/api/routex/return-pickups') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, pickups: await listReturnPickups(env, auth.session.merchantId) });
  }

  const returnPickupMatch = url.pathname.match(/^\/api\/returns\/([^/]+)\/routex\/pickup$/);
  if (returnPickupMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const returnId = decodeURIComponent(returnPickupMatch[1]);
    const existing = await getReturnDetails(env, returnId, auth.session.merchantId);
    if (!existing) return json({ error: 'Return not found.' }, 404);
    const payload = normalizeReturnPickupInput({ ...(await readJson(request) || {}), returnId });
    const id = uid('rpick');
    await dbRun(env, `INSERT INTO return_pickups (id, merchant_id, return_id, driver_id, status, pickup_window_start, pickup_window_end, address_json) VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?)`, [id, auth.session.merchantId, returnId, payload.driverId, payload.pickupWindowStart, payload.pickupWindowEnd, JSON.stringify(payload.address || existing.shippingAddress || {})]);
    return json({ ok: true, pickup: returnPickupRecord(await dbFirst(env, `SELECT * FROM return_pickups WHERE id = ? LIMIT 1`, [id])) }, 201);
  }


  const routexReturnPickupMatch = url.pathname.match(/^\/api\/routex\/return-pickups\/([^/]+)$/);
  if (routexReturnPickupMatch && request.method === 'PATCH') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const pickupId = decodeURIComponent(routexReturnPickupMatch[1]);
    const existing = await dbFirst(env, `SELECT * FROM return_pickups WHERE id = ? AND merchant_id = ? LIMIT 1`, [pickupId, auth.session.merchantId]);
    if (!existing) return json({ error: 'Return pickup not found.' }, 404);
    const payload = normalizeReturnPickupPatch(await readJson(request) || {}, existing);
    await dbRun(env, `UPDATE return_pickups SET driver_id = ?, status = ?, pickup_window_start = ?, pickup_window_end = ?, address_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [payload.driverId, payload.status, payload.pickupWindowStart, payload.pickupWindowEnd, JSON.stringify(payload.address || {}), pickupId, auth.session.merchantId]);
    await audit(env, auth.session.merchantId, 'routex.return_pickup.updated', `Updated return pickup ${pickupId}`, 'return_pickup', pickupId, { status: payload.status }, auth.session);
    return json({ ok: true, pickup: returnPickupRecord(await dbFirst(env, `SELECT * FROM return_pickups WHERE id = ? LIMIT 1`, [pickupId])) });
  }

  if (request.method === 'GET' && url.pathname === '/api/pos/terminal-payments') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, payments: await listPosTerminalPayments(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/pos/terminal-payments') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    if (!body.cartId || !body.readerId) return json({ error: 'cartId and readerId are required.' }, 400);
    const cart = await getPosCart(env, auth.session.merchantId, String(body.cartId));
    if (!cart) return json({ error: 'POS cart not found.' }, 404);
    if (['paid', 'authorized'].includes(String(cart.status || '').toLowerCase()) && cart.orderId) return json({ error: 'POS cart is already linked to a completed order.', orderId: cart.orderId }, 409);
    const existingActive = await dbFirst(env, `SELECT * FROM pos_terminal_payments WHERE cart_id = ? AND merchant_id = ? AND status IN ('processing', 'authorized', 'captured', 'pending') ORDER BY created_at DESC LIMIT 1`, [cart.id, auth.session.merchantId]);
    if (existingActive) return json({ error: 'An active terminal payment already exists for this cart.', payment: terminalPaymentRecord(existingActive) }, 409);
    try {
      const result = await executeStripeTerminalPayment({ stripeSecretKey: env.STRIPE_SECRET_KEY || '', readerId: body.readerId, amountCents: cart.totalCents, currency: cart.currency || 'USD', orderRef: cart.id });
      if (result.status === 'failed') return json({ error: 'Stripe Terminal payment initiation failed.', result }, 502);
      const merchant = merchantRecord(await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [auth.session.merchantId]));
      const shell = await ensurePosTerminalOrderShell(env, merchant, cart, { customerName: body.customerName, customerEmail: body.customerEmail, providerReference: result.providerReference || '', note: 'POS terminal payment initiated from Merchant Command.' });
      const cartAfterShell = await getPosCart(env, auth.session.merchantId, cart.id);
      const id = uid('posterm');
      const checkoutToken = uid('termchk');
      await dbRun(env, `INSERT INTO payment_transactions (id, merchant_id, order_id, provider, provider_reference, checkout_token, status, amount_cents, currency, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [uid('pay'), auth.session.merchantId, shell.id, 'stripe_terminal', result.providerReference || '', checkoutToken, 'pending', cart.totalCents, cart.currency || 'USD', JSON.stringify(result)]);
      const tenders = buildPosTerminalTender({ amountCents: cart.totalCents, providerReference: result.providerReference || '', readerId: body.readerId });
      await dbRun(env, `UPDATE pos_carts SET status = 'pending_provider', tenders_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [JSON.stringify(tenders), cart.id, auth.session.merchantId]);
      await dbRun(env, `INSERT INTO pos_terminal_payments (id, merchant_id, cart_id, order_id, reader_id, provider_reference, status, amount_cents, currency, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, cart.id, shell.id, body.readerId, result.providerReference || '', 'processing', cart.totalCents, cart.currency || 'USD', JSON.stringify(result)]);
      await appendOrderEvent(env, shell.id, { kind: 'pos_terminal_started', summary: `Stripe Terminal payment initiated on ${body.readerId}`, status: shell.status, paymentStatus: 'pending_provider', detail: result.providerReference || body.readerId });
      await audit(env, auth.session.merchantId, 'pos.terminal.started', `Terminal payment initiated for cart ${cart.id}`, 'pos_terminal_payment', id, { cartId: cart.id, orderId: shell.id, readerId: body.readerId }, auth.session);
      return json({ ok: true, order: await getOrderDetails(env, shell.id, auth.session.merchantId), cart: await getPosCart(env, auth.session.merchantId, cart.id), payment: terminalPaymentRecord(await dbFirst(env, `SELECT * FROM pos_terminal_payments WHERE id = ? LIMIT 1`, [id])) }, 201);
    } catch (error) {
      return json({ error: error.message, code: error.code || 'POS_TERMINAL_FAILED' }, error.code === 'STRIPE_TERMINAL_SECRET_REQUIRED' ? 409 : 502);
    }
  }

  const posTerminalPaymentFinalizeMatch = url.pathname.match(/^\/api\/pos\/terminal-payments\/([^/]+)\/finalize$/);
  if (posTerminalPaymentFinalizeMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const paymentId = decodeURIComponent(posTerminalPaymentFinalizeMatch[1]);
    const paymentRow = await dbFirst(env, `SELECT * FROM pos_terminal_payments WHERE id = ? AND merchant_id = ? LIMIT 1`, [paymentId, auth.session.merchantId]);
    if (!paymentRow) return json({ error: 'POS terminal payment not found.' }, 404);
    const payment = terminalPaymentRecord(paymentRow);
    const cart = await getPosCart(env, auth.session.merchantId, payment.cartId);
    if (!cart) return json({ error: 'POS cart not found.' }, 404);
    const merchant = merchantRecord(await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [auth.session.merchantId]));
    const order = await ensurePosTerminalOrderShell(env, merchant, cart, { orderId: payment.orderId, providerReference: payment.providerReference || '', note: 'POS terminal payment shell ensured during finalize.' });
    const body = await readJson(request) || {};
    const requestedStatus = String(body.status || '').toLowerCase();
    const normalizedStatus = ['paid', 'authorized', 'failed', 'voided', 'canceled'].includes(requestedStatus) ? requestedStatus : 'paid';
    const payload = { ...(payment.payload || {}), finalization: body.result && typeof body.result === 'object' ? body.result : { status: normalizedStatus }, finalizedAt: new Date().toISOString() };
    const providerReference = String(body.providerReference || payment.providerReference || '').trim();
    const transaction = await dbFirst(env, `SELECT * FROM payment_transactions WHERE order_id = ? AND merchant_id = ? ORDER BY created_at DESC LIMIT 1`, [order.id, auth.session.merchantId]);
    if (normalizedStatus === 'paid' || normalizedStatus === 'authorized') {
      if (transaction) await dbRun(env, `UPDATE payment_transactions SET provider_reference = ?, status = ?, payload_json = ?, authorized_at = COALESCE(authorized_at, ?), captured_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [providerReference, normalizedStatus, JSON.stringify(payload), new Date().toISOString(), normalizedStatus === 'paid' ? new Date().toISOString() : null, transaction.id, auth.session.merchantId]);
      await dbRun(env, `UPDATE pos_terminal_payments SET order_id = ?, provider_reference = ?, status = ?, payload_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [order.id, providerReference, normalizedStatus === 'paid' ? 'captured' : 'authorized', JSON.stringify(payload), payment.id, auth.session.merchantId]);
      await dbRun(env, `UPDATE orders SET status = ?, payment_status = ?, payment_reference = ? WHERE id = ? AND merchant_id = ?`, [normalizedStatus === 'paid' ? 'fulfilled' : 'received', normalizedStatus, providerReference, order.id, auth.session.merchantId]);
      await ensurePosTerminalInventoryAllocated(env, auth.session.merchantId, order.id, cart);
      const tenders = buildPosTerminalTender({ amountCents: cart.totalCents, providerReference, readerId: payment.readerId });
      await dbRun(env, `UPDATE pos_carts SET status = ?, tenders_json = ?, order_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [normalizedStatus === 'paid' ? 'paid' : 'authorized', JSON.stringify(tenders), order.id, cart.id, auth.session.merchantId]);
      let printerJob = null;
      if (body.printReceipt !== false && (body.endpointUrl || env.POS_RECEIPT_PRINTER_URL) && (body.secret || env.POS_RECEIPT_PRINTER_SECRET)) {
        try {
          const receipt = { orderId: order.id, orderNumber: order.orderNumber, cartId: cart.id, providerReference, amountCents: cart.totalCents, currency: cart.currency || 'USD', printedAt: new Date().toISOString() };
          const result = await executeReceiptPrinterJob({ url: body.endpointUrl || env.POS_RECEIPT_PRINTER_URL, secret: body.secret || env.POS_RECEIPT_PRINTER_SECRET, receipt });
          const jobId = uid('prn');
          await dbRun(env, `INSERT INTO pos_receipt_print_jobs (id, merchant_id, order_id, cart_id, status, endpoint_url, result_json) VALUES (?, ?, ?, ?, ?, ?, ?)`, [jobId, auth.session.merchantId, order.id, cart.id, result.status, body.endpointUrl || env.POS_RECEIPT_PRINTER_URL, JSON.stringify(result)]);
          printerJob = (await listPosReceiptPrintJobs(env, auth.session.merchantId)).find((item) => item.id === jobId) || null;
        } catch (error) {
          printerJob = { status: 'failed', error: error.message };
        }
      }
      await appendOrderEvent(env, order.id, { kind: 'pos_terminal_finalized', summary: `Stripe Terminal ${normalizedStatus} for ${order.orderNumber}`, status: normalizedStatus === 'paid' ? 'fulfilled' : order.status, paymentStatus: normalizedStatus, detail: providerReference || payment.readerId });
      await audit(env, auth.session.merchantId, 'pos.terminal.finalized', `Terminal payment ${normalizedStatus} for ${order.orderNumber}`, 'pos_terminal_payment', payment.id, { orderId: order.id, cartId: cart.id, status: normalizedStatus }, auth.session);
      return json({ ok: true, order: await getOrderDetails(env, order.id, auth.session.merchantId), cart: await getPosCart(env, auth.session.merchantId, cart.id), payment: terminalPaymentRecord(await dbFirst(env, `SELECT * FROM pos_terminal_payments WHERE id = ? LIMIT 1`, [payment.id])), printerJob }, 200);
    }
    if (transaction) await dbRun(env, `UPDATE payment_transactions SET provider_reference = ?, status = ?, payload_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [providerReference, normalizedStatus === 'canceled' ? 'voided' : normalizedStatus, JSON.stringify(payload), transaction.id, auth.session.merchantId]);
    await dbRun(env, `UPDATE pos_terminal_payments SET order_id = ?, provider_reference = ?, status = ?, payload_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [order.id, providerReference, normalizedStatus === 'canceled' ? 'voided' : normalizedStatus, JSON.stringify(payload), payment.id, auth.session.merchantId]);
    await dbRun(env, `UPDATE orders SET status = 'canceled', payment_status = ?, payment_reference = ? WHERE id = ? AND merchant_id = ?`, [normalizedStatus === 'canceled' ? 'voided' : 'pending_provider_failure', providerReference, order.id, auth.session.merchantId]);
    await dbRun(env, `UPDATE pos_carts SET status = 'open', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [cart.id, auth.session.merchantId]);
    await appendOrderEvent(env, order.id, { kind: 'pos_terminal_failed', summary: `Stripe Terminal ${normalizedStatus} for ${order.orderNumber}`, status: 'canceled', paymentStatus: normalizedStatus === 'canceled' ? 'voided' : 'pending_provider_failure', detail: providerReference || payment.readerId });
    await audit(env, auth.session.merchantId, 'pos.terminal.failed', `Terminal payment ${normalizedStatus} for ${order.orderNumber}`, 'pos_terminal_payment', payment.id, { orderId: order.id, cartId: cart.id, status: normalizedStatus }, auth.session);
    return json({ ok: false, order: await getOrderDetails(env, order.id, auth.session.merchantId), cart: await getPosCart(env, auth.session.merchantId, cart.id), payment: terminalPaymentRecord(await dbFirst(env, `SELECT * FROM pos_terminal_payments WHERE id = ? LIMIT 1`, [payment.id])) }, 409);
  }

  if (request.method === 'GET' && url.pathname === '/api/pos/cash-drawer-events') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, events: await listPosCashDrawerEvents(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/pos/cash-drawer-events') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeCashDrawerEventInput(await readJson(request) || {});
    if (!payload.registerId || !payload.eventType) return json({ error: 'registerId and eventType are required.' }, 400);
    const id = uid('cash');
    await dbRun(env, `INSERT INTO pos_cash_drawer_events (id, merchant_id, register_id, shift_id, event_type, amount_cents, reason) VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.registerId, payload.shiftId, payload.eventType, payload.amountCents, payload.reason]);
    return json({ ok: true, event: cashDrawerEventRecord(await dbFirst(env, `SELECT * FROM pos_cash_drawer_events WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/pos/receipt-print-jobs') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, jobs: await listPosReceiptPrintJobs(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/pos/receipt-print-jobs') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    const endpointUrl = requireHttpsUrl(body.endpointUrl || env.POS_RECEIPT_PRINTER_URL || '', 'endpointUrl');
    const secret = body.secret || env.POS_RECEIPT_PRINTER_SECRET || '';
    if (!body.orderId && !body.cartId) return json({ error: 'orderId or cartId is required.' }, 400);
    const receipt = body.receipt || { orderId: body.orderId || '', cartId: body.cartId || '', printedAt: new Date().toISOString() };
    try {
      const result = await executeReceiptPrinterJob({ url: endpointUrl, secret, receipt });
      const id = uid('prn');
      await dbRun(env, `INSERT INTO pos_receipt_print_jobs (id, merchant_id, order_id, cart_id, status, endpoint_url, result_json) VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, body.orderId || '', body.cartId || '', result.status, endpointUrl, JSON.stringify(result)]);
      return json({ ok: result.ok, job: (await listPosReceiptPrintJobs(env, auth.session.merchantId)).find((item) => item.id === id) }, result.ok ? 201 : 502);
    } catch (error) {
      return json({ error: error.message, code: error.code || 'POS_PRINTER_FAILED' }, 502);
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/pos/reconciliations') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, reconciliations: await listPosReconciliations(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/pos/reconciliations') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    const businessDate = String(body.businessDate || new Date().toISOString().slice(0, 10));
    const shifts = await dbAll(env, `SELECT * FROM pos_shifts WHERE merchant_id = ?`, [auth.session.merchantId]);
    const carts = await dbAll(env, `SELECT * FROM pos_carts WHERE merchant_id = ?`, [auth.session.merchantId]);
    const drawerEvents = await dbAll(env, `SELECT * FROM pos_cash_drawer_events WHERE merchant_id = ?`, [auth.session.merchantId]);
    const report = buildEndOfDayReconciliation({ shifts, carts, drawerEvents });
    const id = uid('recon');
    await dbRun(env, `INSERT INTO pos_endofday_reconciliations (id, merchant_id, business_date, report_json, status) VALUES (?, ?, ?, ?, 'closed')`, [id, auth.session.merchantId, businessDate, JSON.stringify(report)]);
    return json({ ok: true, reconciliation: (await listPosReconciliations(env, auth.session.merchantId)).find((item) => item.id === id) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/pos/offline-sync') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, events: await listPosOfflineSyncEvents(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/pos/offline-sync') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    if (!body.deviceId || body.sequence === undefined || !body.eventType) return json({ error: 'deviceId, sequence, and eventType are required.' }, 400);
    const payloadJson = JSON.stringify(body.payload || {});
    const payloadHash = await sha256Hex(payloadJson);
    const existing = await dbFirst(env, `SELECT * FROM pos_offline_sync_events WHERE merchant_id = ? AND device_id = ? AND sequence = ? LIMIT 1`, [auth.session.merchantId, body.deviceId, Number(body.sequence)]);
    if (existing) {
      const status = existing.payload_hash === payloadHash ? 'accepted' : 'conflict';
      if (status === 'conflict') await dbRun(env, `UPDATE pos_offline_sync_events SET status = 'conflict' WHERE id = ?`, [existing.id]);
      return json({ ok: status === 'accepted', status, event: offlineSyncEventRecord(await dbFirst(env, `SELECT * FROM pos_offline_sync_events WHERE id = ? LIMIT 1`, [existing.id])) }, status === 'accepted' ? 200 : 409);
    }
    const id = uid('offsync');
    await dbRun(env, `INSERT INTO pos_offline_sync_events (id, merchant_id, device_id, sequence, event_type, payload_hash, payload_json, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'accepted')`, [id, auth.session.merchantId, body.deviceId, Number(body.sequence), body.eventType, payloadHash, payloadJson]);
    return json({ ok: true, event: offlineSyncEventRecord(await dbFirst(env, `SELECT * FROM pos_offline_sync_events WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/tax-filings') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, filings: await listTaxFilingJobs(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/tax-filings') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    const merchant = merchantRecord(await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [auth.session.merchantId]));
    const orders = await dbAll(env, `SELECT * FROM orders WHERE merchant_id = ?`, [auth.session.merchantId]);
    const nexusRules = await dbAll(env, `SELECT * FROM tax_nexus_rules WHERE merchant_id = ?`, [auth.session.merchantId]);
    const payload = buildTaxFilingPayload({ merchant, orders, nexusRules, period: { start: body.periodStart || '', end: body.periodEnd || '' } });
    let providerResult = {};
    try {
      if (body.targetUrl) providerResult = await executeSignedProviderPost({ url: body.targetUrl, secret: body.secret || env.TAX_FILING_SECRET || '', payload, eventType: 'tax.filing.submit' });
    } catch (error) {
      providerResult = { status: 'failed', error: error.message };
    }
    const id = uid('taxjob');
    await dbRun(env, `INSERT INTO tax_filing_jobs (id, merchant_id, period_start, period_end, status, payload_json, provider_result_json) VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.period.start, payload.period.end, providerResult.status || 'submitted', JSON.stringify(payload), JSON.stringify(providerResult)]);
    return json({ ok: true, filing: (await listTaxFilingJobs(env, auth.session.merchantId)).find((item) => item.id === id) }, 201);
  }

  const taxFilingMatch = url.pathname.match(/^\/api\/tax-filings\/([^/]+)$/);
  if (taxFilingMatch && request.method === 'PATCH') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const filingId = decodeURIComponent(taxFilingMatch[1]);
    const existing = await dbFirst(env, `SELECT * FROM tax_filing_jobs WHERE id = ? AND merchant_id = ? LIMIT 1`, [filingId, auth.session.merchantId]);
    if (!existing) return json({ error: 'Tax filing not found.' }, 404);
    const body = await readJson(request) || {};
    const allowed = new Set(['submitted', 'accepted', 'filed', 'failed', 'voided']);
    const status = allowed.has(String(body.status || '').toLowerCase()) ? String(body.status).toLowerCase() : String(existing.status || 'submitted');
    const providerResult = body.providerResult && typeof body.providerResult === 'object' ? body.providerResult : JSON.parse(existing.provider_result_json || '{}');
    await dbRun(env, `UPDATE tax_filing_jobs SET status = ?, provider_result_json = ? WHERE id = ? AND merchant_id = ?`, [status, JSON.stringify(providerResult), filingId, auth.session.merchantId]);
    await audit(env, auth.session.merchantId, 'tax.filing.updated', `Updated tax filing ${filingId}`, 'tax_filing', filingId, { status }, auth.session);
    return json({ ok: true, filing: (await listTaxFilingJobs(env, auth.session.merchantId)).find((item) => item.id === filingId) });
  }

  if (request.method === 'GET' && url.pathname === '/api/fraud-screenings') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, screenings: await listFraudScreeningJobs(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/fraud-screenings') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    const order = await getOrderDetails(env, String(body.orderId || ''), auth.session.merchantId);
    if (!order) return json({ error: 'Order not found.' }, 404);
    const payload = { orderId: order.id, orderNumber: order.orderNumber, customerEmail: order.customerEmail, totalCents: order.totalCents, shippingAddress: order.shippingAddress || {}, riskAssessments: order.riskAssessments || [] };
    let providerResult = {};
    try {
      if (body.targetUrl) providerResult = await executeSignedProviderPost({ url: body.targetUrl, secret: body.secret || env.FRAUD_SCREENING_SECRET || '', payload, eventType: 'fraud.screening.submit' });
    } catch (error) {
      providerResult = { status: 'failed', error: error.message };
    }
    const id = uid('fraud');
    await dbRun(env, `INSERT INTO fraud_screening_jobs (id, merchant_id, order_id, status, payload_json, provider_result_json) VALUES (?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, order.id, providerResult.status || 'submitted', JSON.stringify(payload), JSON.stringify(providerResult)]);
    return json({ ok: true, screening: (await listFraudScreeningJobs(env, auth.session.merchantId)).find((item) => item.id === id) }, 201);
  }

  const fraudScreeningMatch = url.pathname.match(/^\/api\/fraud-screenings\/([^/]+)$/);
  if (fraudScreeningMatch && request.method === 'PATCH') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const screeningId = decodeURIComponent(fraudScreeningMatch[1]);
    const existing = await dbFirst(env, `SELECT * FROM fraud_screening_jobs WHERE id = ? AND merchant_id = ? LIMIT 1`, [screeningId, auth.session.merchantId]);
    if (!existing) return json({ error: 'Fraud screening not found.' }, 404);
    const body = await readJson(request) || {};
    const allowed = new Set(['submitted', 'queued', 'cleared', 'review', 'blocked', 'failed']);
    const status = allowed.has(String(body.status || '').toLowerCase()) ? String(body.status).toLowerCase() : String(existing.status || 'submitted');
    const providerResult = body.providerResult && typeof body.providerResult === 'object' ? body.providerResult : JSON.parse(existing.provider_result_json || '{}');
    await dbRun(env, `UPDATE fraud_screening_jobs SET status = ?, provider_result_json = ? WHERE id = ? AND merchant_id = ?`, [status, JSON.stringify(providerResult), screeningId, auth.session.merchantId]);
    await audit(env, auth.session.merchantId, 'fraud.screening.updated', `Updated fraud screening ${screeningId}`, 'fraud_screening', screeningId, { status }, auth.session);
    return json({ ok: true, screening: (await listFraudScreeningJobs(env, auth.session.merchantId)).find((item) => item.id === screeningId) });
  }

  if (request.method === 'GET' && url.pathname === '/api/pci-controls') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, controls: await listPciControls(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/pci-controls') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizePciControlInput(await readJson(request) || {});
    if (!payload.controlKey || !payload.title) return json({ error: 'controlKey and title are required.' }, 400);
    const existing = await dbFirst(env, `SELECT * FROM pci_controls WHERE merchant_id = ? AND control_key = ? LIMIT 1`, [auth.session.merchantId, payload.controlKey]);
    if (existing) {
      await dbRun(env, `UPDATE pci_controls SET title = ?, status = ?, evidence_url = ?, owner = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [payload.title, payload.status, payload.evidenceUrl, payload.owner, existing.id]);
      return json({ ok: true, control: pciControlRecord(await dbFirst(env, `SELECT * FROM pci_controls WHERE id = ? LIMIT 1`, [existing.id])) });
    }
    const id = uid('pci');
    await dbRun(env, `INSERT INTO pci_controls (id, merchant_id, control_key, title, status, evidence_url, owner) VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.controlKey, payload.title, payload.status, payload.evidenceUrl, payload.owner]);
    return json({ ok: true, control: pciControlRecord(await dbFirst(env, `SELECT * FROM pci_controls WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/app-developers') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, developers: await listDeveloperAccounts(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/app-developers') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeDeveloperAccountInput(await readJson(request) || {});
    if (!payload.name || !payload.email) return json({ error: 'name and email are required.' }, 400);
    const id = uid('dev');
    await dbRun(env, `INSERT INTO app_developer_accounts (id, merchant_id, name, email, status, payout_share_bps) VALUES (?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.name, payload.email, payload.status, payload.payoutShareBps]);
    return json({ ok: true, developer: developerAccountRecord(await dbFirst(env, `SELECT * FROM app_developer_accounts WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  const developerAccountMatch = url.pathname.match(/^\/api\/app-developers\/([^/]+)$/);
  if (developerAccountMatch && request.method === 'PATCH') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const developerId = decodeURIComponent(developerAccountMatch[1]);
    const existing = await dbFirst(env, `SELECT * FROM app_developer_accounts WHERE id = ? AND merchant_id = ? LIMIT 1`, [developerId, auth.session.merchantId]);
    if (!existing) return json({ error: 'Developer account not found.' }, 404);
    const payload = normalizeDeveloperAccountPatch(await readJson(request) || {}, developerAccountRecord(existing));
    if (!payload.name || !payload.email) return json({ error: 'name and email are required.' }, 400);
    await dbRun(env, `UPDATE app_developer_accounts SET name = ?, email = ?, status = ?, payout_share_bps = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [payload.name, payload.email, payload.status, payload.payoutShareBps, developerId, auth.session.merchantId]);
    await audit(env, auth.session.merchantId, 'app.developer.updated', `Updated developer ${developerId}`, 'app_developer', developerId, { status: payload.status }, auth.session);
    return json({ ok: true, developer: developerAccountRecord(await dbFirst(env, `SELECT * FROM app_developer_accounts WHERE id = ? LIMIT 1`, [developerId])) });
  }

  if (request.method === 'GET' && url.pathname === '/api/app-reviews') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, reviews: await listAppReviewSubmissions(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/app-reviews') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    if (!body.appId || !body.developerId) return json({ error: 'appId and developerId are required.' }, 400);
    const id = uid('apprv');
    await dbRun(env, `INSERT INTO app_review_submissions (id, merchant_id, app_id, developer_id, status, checklist_json, reviewer_notes) VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, body.appId, body.developerId, body.status || 'submitted', JSON.stringify(body.checklist || {}), body.reviewerNotes || '']);
    return json({ ok: true, review: appReviewSubmissionRecord(await dbFirst(env, `SELECT * FROM app_review_submissions WHERE id = ? LIMIT 1`, [id])) }, 201);
  }


  const appReviewMatch = url.pathname.match(/^\/api\/app-reviews\/([^/]+)$/);
  if (appReviewMatch && request.method === 'PATCH') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const reviewId = decodeURIComponent(appReviewMatch[1]);
    const existing = await dbFirst(env, `SELECT * FROM app_review_submissions WHERE id = ? AND merchant_id = ? LIMIT 1`, [reviewId, auth.session.merchantId]);
    if (!existing) return json({ error: 'App review submission not found.' }, 404);
    const payload = normalizeAppReviewPatch(await readJson(request) || {}, existing);
    const reviewedAt = ['approved', 'changes_requested', 'rejected'].includes(payload.status) ? new Date().toISOString() : (existing.reviewed_at || '');
    await dbRun(env, `UPDATE app_review_submissions SET status = ?, checklist_json = ?, reviewer_notes = ?, reviewed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [payload.status, JSON.stringify(payload.checklist || {}), payload.reviewerNotes, reviewedAt, reviewId, auth.session.merchantId]);
    await audit(env, auth.session.merchantId, 'app.review.updated', `Updated app review ${reviewId}`, 'app_review', reviewId, { status: payload.status }, auth.session);
    return json({ ok: true, review: appReviewSubmissionRecord(await dbFirst(env, `SELECT * FROM app_review_submissions WHERE id = ? LIMIT 1`, [reviewId])) });
  }

  if (request.method === 'GET' && url.pathname === '/api/app-settlements') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, settlements: await listAppRevenueSettlements(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/app-settlements') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    const developer = await dbFirst(env, `SELECT * FROM app_developer_accounts WHERE id = ? AND merchant_id = ? LIMIT 1`, [String(body.developerId || ''), auth.session.merchantId]);
    if (!developer) return json({ error: 'Developer account not found.' }, 404);
    const invoices = await dbAll(env, `SELECT * FROM app_billing_invoices WHERE merchant_id = ?`, [auth.session.merchantId]);
    const settlement = buildAppSettlement({ developer, invoices, periodStart: body.periodStart || '', periodEnd: body.periodEnd || '', platformFeeBps: body.platformFeeBps || Math.max(0, 10000 - Number(developer.payout_share_bps || 7000)) });
    const id = uid('appset');
    await dbRun(env, `INSERT INTO app_revenue_settlements (id, merchant_id, developer_id, period_start, period_end, gross_cents, platform_fee_cents, developer_payout_cents, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, developer.id, settlement.periodStart, settlement.periodEnd, settlement.grossCents, settlement.platformFeeCents, settlement.developerPayoutCents, 'open']);
    return json({ ok: true, settlement: appSettlementRecord(await dbFirst(env, `SELECT * FROM app_revenue_settlements WHERE id = ? LIMIT 1`, [id])) }, 201);
  }


  const appSettlementMatch = url.pathname.match(/^\/api\/app-settlements\/([^/]+)$/);
  if (appSettlementMatch && request.method === 'PATCH') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const settlementId = decodeURIComponent(appSettlementMatch[1]);
    const existing = await dbFirst(env, `SELECT * FROM app_revenue_settlements WHERE id = ? AND merchant_id = ? LIMIT 1`, [settlementId, auth.session.merchantId]);
    if (!existing) return json({ error: 'App settlement not found.' }, 404);
    const payload = normalizeAppSettlementPatch(await readJson(request) || {}, existing);
    const paidAt = payload.status === 'paid' ? new Date().toISOString() : (payload.status === 'voided' ? '' : (existing.paid_at || ''));
    await dbRun(env, `UPDATE app_revenue_settlements SET status = ?, payout_reference = ?, paid_at = ? WHERE id = ? AND merchant_id = ?`, [payload.status, payload.payoutReference, paidAt, settlementId, auth.session.merchantId]);
    await audit(env, auth.session.merchantId, 'app.settlement.updated', `Updated app settlement ${settlementId}`, 'app_settlement', settlementId, { status: payload.status, payoutReference: payload.payoutReference }, auth.session);
    return json({ ok: true, settlement: appSettlementRecord(await dbFirst(env, `SELECT * FROM app_revenue_settlements WHERE id = ? LIMIT 1`, [settlementId])) });
  }

  const appOAuthInstallSessionMatch = url.pathname.match(/^\/api\/apps\/([^/]+)\/oauth\/install-session$/);
  if (appOAuthInstallSessionMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const appId = decodeURIComponent(appOAuthInstallSessionMatch[1]);
    const appRecord = await dbFirst(env, `SELECT * FROM commerce_apps WHERE id = ? AND merchant_id = ? LIMIT 1`, [appId, auth.session.merchantId]);
    if (!appRecord) return json({ error: 'App not found.' }, 404);
    const installation = await dbFirst(env, `SELECT * FROM app_installations WHERE merchant_id = ? AND app_id = ? ORDER BY installed_at DESC LIMIT 1`, [auth.session.merchantId, appId]);
    if (!installation) return json({ error: 'App installation not found.' }, 404);
    const state = uid('oauth');
    const redirectUri = `${buildAbsoluteOrigin(url)}/api/app-installations/oauth/callback`;
    const config = safeJsonParse(installation.config_json, {});
    const nextConfig = { ...config, oauth: { ...(config.oauth || {}), state, redirectUri, status: 'pending', startedAt: new Date().toISOString(), error: '', authorizationCodePreview: '' } };
    await dbRun(env, `UPDATE app_installations SET config_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [JSON.stringify(nextConfig), installation.id, auth.session.merchantId]);
    const refreshed = await dbFirst(env, `SELECT * FROM app_installations WHERE id = ? LIMIT 1`, [installation.id]);
    const oauth = buildOAuthInstallSession({ app: commerceAppRecord(appRecord), installation: appInstallationRecord(refreshed || installation), origin: buildAbsoluteOrigin(url), state });
    return json({ ok: true, oauth, installation: appInstallationRecord(refreshed || installation) });
  }

  if (request.method === 'GET' && url.pathname === '/api/app-installations/oauth/callback') {
    const installationId = String(url.searchParams.get('installation_id') || '').trim();
    const state = String(url.searchParams.get('state') || '').trim();
    const code = String(url.searchParams.get('code') || '').trim();
    const errorCode = String(url.searchParams.get('error') || '').trim();
    if (!installationId || !state) return text('Missing installation_id or state.', 400);
    const installation = await dbFirst(env, `SELECT * FROM app_installations WHERE id = ? LIMIT 1`, [installationId]);
    if (!installation) return text('App installation not found.', 404);
    const config = safeJsonParse(installation.config_json, {});
    const oauthConfig = config.oauth || {};
    if (!oauthConfig.state || oauthConfig.state !== state) return text('Invalid OAuth state.', 401);
    const authorizationCodePreview = code ? `${code.slice(0, 6)}…${code.slice(-4)}` : '';
    const status = errorCode ? 'failed' : (code ? 'authorized' : 'pending');
    const nextConfig = {
      ...config,
      oauth: {
        ...oauthConfig,
        status,
        completedAt: new Date().toISOString(),
        error: errorCode,
        authorizationCodePreview
      }
    };
    await dbRun(env, `UPDATE app_installations SET status = ?, config_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status === 'authorized' ? 'installed' : 'paused', JSON.stringify(nextConfig), installationId]);
    const redirect = `${buildAbsoluteOrigin(url)}/merchant/index.html?oauth_installation=${encodeURIComponent(installationId)}&oauth_status=${encodeURIComponent(status)}${authorizationCodePreview ? `&oauth_code=${encodeURIComponent(authorizationCodePreview)}` : ''}${errorCode ? `&oauth_error=${encodeURIComponent(errorCode)}` : ''}`;
    return new Response(null, { status: 302, headers: { location: redirect } });
  }

  if (request.method === 'GET' && url.pathname === '/api/returns') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, returns: await listMerchantReturns(env, auth.session.merchantId) });
  }

  const returnMatch = url.pathname.match(/^\/api\/returns\/([^/]+)$/);
  if (returnMatch) {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const id = decodeURIComponent(returnMatch[1]);
    const existing = await getReturnDetails(env, id, auth.session.merchantId);
    if (!existing) return json({ error: 'Return not found.' }, 404);
    if (request.method === 'GET') {
      return json({ ok: true, returnRequest: existing, order: await getOrderDetails(env, existing.orderId, auth.session.merchantId) });
    }
    if (request.method === 'PUT') {
      const body = normalizeReturnPatch(await readJson(request) || {}, existing);
      await dbRun(env, `
        UPDATE order_returns
        SET status = ?, approved_cents = ?, merchant_note = ?, refund_reference = ?, resolution_type = ?, restock_items = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND merchant_id = ?
      `, [body.status, body.approvedCents, body.merchantNote, body.refundReference, body.resolutionType, body.restockItems ? 1 : 0, id, auth.session.merchantId]);
      let updated = await getReturnDetails(env, id, auth.session.merchantId);
      const didRestock = await maybeRestockReturn(env, auth.session.merchantId, updated);
      if (didRestock) updated = await getReturnDetails(env, id, auth.session.merchantId);
      if (body.status === 'refunded') {
        await dbRun(env, `UPDATE orders SET payment_status = ? WHERE id = ? AND merchant_id = ?`, ['refunded', existing.orderId, auth.session.merchantId]);
      }
      const freshOrder = await getOrderDetails(env, existing.orderId, auth.session.merchantId);
      await appendOrderEvent(env, existing.orderId, {
        kind: `return_${body.status}`,
        summary: `Return ${body.status}`,
        status: freshOrder?.status || '',
        paymentStatus: body.status === 'refunded' ? 'refunded' : freshOrder?.paymentStatus || '',
        detail: [body.merchantNote, body.refundReference].filter(Boolean).join(' · ') || `Return moved to ${body.status}.`
      });
      const merchant = await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [auth.session.merchantId]);
      const customerRow = freshOrder?.customerId ? await getCustomerById(env, freshOrder.customerId) : null;
      await queueCommerceNotifications(env, 'return_updated', {
        merchant: merchantRecord(merchant),
        order: freshOrder,
        returnRequest: updated,
        customer: customerRow ? { id: customerRow.id, email: customerRow.email, phone: customerRow.phone, firstName: customerRow.first_name, lastName: customerRow.last_name } : null
      });
      return json({ ok: true, returnRequest: updated, order: await getOrderDetails(env, existing.orderId, auth.session.merchantId) });
    }
  }


  const returnRoutexMatch = url.pathname.match(/^\/api\/returns\/([^/]+)\/routex\/pickup$/);
  if (returnRoutexMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const returnId = decodeURIComponent(returnRoutexMatch[1]);
    const body = await readJson(request) || {};
    const returnRequest = await getReturnDetails(env, returnId, auth.session.merchantId);
    if (!returnRequest) return json({ error: 'Return not found.' }, 404);
    const order = await getOrderDetails(env, returnRequest.orderId, auth.session.merchantId);
    const merchant = merchantRecord(await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [auth.session.merchantId]));
    const payload = buildRoutexHandoffPayload({ merchant, order, returnRequest, kind: body.kind || 'return_pickup', routeDate: body.routeDate || '', note: body.note || '' });
    const id = uid('rtx');
    await dbRun(env, `INSERT INTO routex_handoffs (id, merchant_id, order_id, return_id, kind, status, route_date, request_json) VALUES (?, ?, ?, ?, ?, 'running', ?, ?)`, [id, auth.session.merchantId, order?.id || null, returnId, payload.kind, payload.routeDate, JSON.stringify(payload)]);
    try {
      const result = await executeRoutexHandoff(env, payload);
      await dbRun(env, `UPDATE routex_handoffs SET status = ?, external_ref = ?, response_json = ?, error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [result.status, result.externalRef, JSON.stringify(result.response || {}), result.ok ? '' : `HTTP ${result.httpStatus}`, id]);
      if (order?.id) await appendOrderEvent(env, order.id, { kind: 'routex_return_pickup', summary: `Routex return pickup ${result.status}`, status: order.status, paymentStatus: order.paymentStatus, detail: result.externalRef || payload.routeDate });
      return json({ ok: result.ok, handoff: routexHandoffRecord(await dbFirst(env, `SELECT * FROM routex_handoffs WHERE id = ? LIMIT 1`, [id])) }, result.ok ? 201 : 502);
    } catch (error) {
      await dbRun(env, `UPDATE routex_handoffs SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [error.message, id]);
      return json({ error: error.message, handoff: routexHandoffRecord(await dbFirst(env, `SELECT * FROM routex_handoffs WHERE id = ? LIMIT 1`, [id])) }, 502);
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/apps') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, apps: await listCommerceApps(env, auth.session.merchantId), installations: await listAppInstallations(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/apps') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeCommerceAppInput(await readJson(request) || {});
    if (!payload.name) return json({ error: 'name is required.' }, 400);
    const id = uid('app');
    await dbRun(env, `INSERT INTO commerce_apps (id, merchant_id, app_key, name, developer_name, app_url, webhook_url, requested_scopes_json, status, pricing_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.key, payload.name, payload.developerName, payload.appUrl, payload.webhookUrl, JSON.stringify(payload.requestedScopes), payload.status, JSON.stringify(payload.pricing || {})]);
    return json({ ok: true, app: commerceAppRecord(await dbFirst(env, `SELECT * FROM commerce_apps WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  const installAppMatch = url.pathname.match(/^\/api\/apps\/([^/]+)\/install$/);
  if (installAppMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const appId = decodeURIComponent(installAppMatch[1]);
    const app = await dbFirst(env, `SELECT * FROM commerce_apps WHERE id = ? AND merchant_id = ? LIMIT 1`, [appId, auth.session.merchantId]);
    if (!app) return json({ error: 'App not found.' }, 404);
    const payload = normalizeAppInstallationInput({ ...(await readJson(request) || {}), appId }, commerceAppRecord(app));
    const id = uid('ins');
    await dbRun(env, `INSERT INTO app_installations (id, merchant_id, app_id, granted_scopes_json, status, config_json) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(merchant_id, app_id) DO UPDATE SET granted_scopes_json = excluded.granted_scopes_json, status = excluded.status, config_json = excluded.config_json, updated_at = CURRENT_TIMESTAMP`, [id, auth.session.merchantId, appId, JSON.stringify(payload.grantedScopes), payload.status, JSON.stringify(payload.config || {})]);
    return json({ ok: true, installations: await listAppInstallations(env, auth.session.merchantId) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/app-installations') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, installations: await listAppInstallations(env, auth.session.merchantId) });
  }

  if (request.method === 'GET' && url.pathname === '/api/api-tokens') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, tokens: await listApiTokens(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/api-tokens') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeApiTokenInput(await readJson(request) || {});
    const rawToken = createRawApiToken();
    const tokenHash = await hashApiToken(env.API_TOKEN_HASH_SECRET || env.SESSION_SECRET, rawToken);
    const id = uid('tok');
    await dbRun(env, `INSERT INTO api_access_tokens (id, merchant_id, label, token_hash, secret_preview, scopes_json, status, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.label, tokenHash, `${rawToken.slice(0, 9)}…${rawToken.slice(-6)}`, JSON.stringify(payload.scopes), payload.status, payload.expiresAt || null]);
    return json({ ok: true, token: apiTokenRecord({ ...(await dbFirst(env, `SELECT * FROM api_access_tokens WHERE id = ? LIMIT 1`, [id])), rawToken }, true) }, 201);
  }

  const revokeTokenMatch = url.pathname.match(/^\/api\/api-tokens\/([^/]+)\/revoke$/);
  if (revokeTokenMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const id = decodeURIComponent(revokeTokenMatch[1]);
    await dbRun(env, `UPDATE api_access_tokens SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [id, auth.session.merchantId]);
    return json({ ok: true, tokens: await listApiTokens(env, auth.session.merchantId) });
  }

  if (request.method === 'GET' && url.pathname === '/api/headless/products') {
    const auth = await requireApiBearer(request, env, 'catalog:read');
    if (auth.error) return auth.error;
    return json({ ok: true, products: await listMerchantProducts(env, auth.api.merchantId) });
  }

  if (request.method === 'GET' && url.pathname === '/api/headless/orders') {
    const auth = await requireApiBearer(request, env, 'orders:read');
    if (auth.error) return auth.error;
    const orders = await dbAll(env, `SELECT * FROM orders WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 250`, [auth.api.merchantId]);
    return json({ ok: true, orders: orders.map(orderSummary) });
  }

  if (request.method === 'GET' && url.pathname === '/api/headless/customers') {
    const auth = await requireApiBearer(request, env, 'customers:read');
    if (auth.error) return auth.error;
    const rows = await dbAll(env, `SELECT id, email, first_name, last_name, phone, accepts_marketing, default_address_json, created_at, updated_at FROM customer_accounts WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 250`, [auth.api.merchantId]);
    return json({ ok: true, customers: rows.map((row) => ({ id: row.id, email: row.email, firstName: row.first_name, lastName: row.last_name, phone: row.phone, acceptsMarketing: Boolean(Number(row.accepts_marketing || 0)), defaultAddress: JSON.parse(row.default_address_json || '{}'), createdAt: row.created_at, updatedAt: row.updated_at })) });
  }

  if (request.method === 'GET' && url.pathname === '/api/headless/inventory') {
    const auth = await requireApiBearer(request, env, 'inventory:read');
    if (auth.error) return auth.error;
    return json({ ok: true, locations: await listMerchantInventoryLocations(env, auth.api.merchantId), levels: await listMerchantInventoryLevels(env, auth.api.merchantId) });
  }

  if (request.method === 'GET' && url.pathname === '/api/custom-domains') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, domains: await listCustomDomains(env, auth.session.merchantId), certificateJobs: await listDomainCertificateJobs(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/custom-domains') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeCustomDomainInput(await readJson(request) || {});
    if (!payload.hostname) return json({ error: 'hostname is required.' }, 400);
    const token = uid('dns').replace(/^dns_/, '');
    const verify = buildDomainVerification(payload.hostname, token, env.PUBLIC_STORE_CNAME_TARGET || env.PUBLIC_BASE_URL || 'commerce.skyesoverlondon.workers.dev');
    const id = uid('dom');
    await dbRun(env, `INSERT INTO custom_domains (id, merchant_id, hostname, mode, status, verification_token, verification_record_name, verification_record_value, tls_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.hostname, payload.mode, payload.status, token, verify.name, verify.value, payload.tlsMode]);
    return json({ ok: true, domain: customDomainRecord(await dbFirst(env, `SELECT * FROM custom_domains WHERE id = ? LIMIT 1`, [id])), verification: verify }, 201);
  }

  const verifyDomainMatch = url.pathname.match(/^\/api\/custom-domains\/([^/]+)\/verify$/);
  if (verifyDomainMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const id = decodeURIComponent(verifyDomainMatch[1]);
    const domain = await dbFirst(env, `SELECT * FROM custom_domains WHERE id = ? AND merchant_id = ? LIMIT 1`, [id, auth.session.merchantId]);
    if (!domain) return json({ error: 'Domain not found.' }, 404);
    let dnsCheck;
    try {
      dnsCheck = await verifyDnsTxtRecord({ recordName: domain.verification_record_name, expectedValue: domain.verification_record_value }, env);
    } catch (error) {
      return json({ error: error.message, code: 'DNS_TXT_LOOKUP_FAILED' }, 502);
    }
    const verified = dnsCheck.verified === true;
    await dbRun(env, `UPDATE custom_domains SET status = ?, last_checked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [verified ? 'verified' : 'pending', id, auth.session.merchantId]);
    return json({ ok: verified, domain: customDomainRecord(await dbFirst(env, `SELECT * FROM custom_domains WHERE id = ? LIMIT 1`, [id])), dnsCheck, expected: { name: domain.verification_record_name, value: domain.verification_record_value } }, verified ? 200 : 409);
  }

  const provisionDomainCertMatch = url.pathname.match(/^\/api\/custom-domains\/([^/]+)\/certificate\/provision$/);
  if (provisionDomainCertMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const id = decodeURIComponent(provisionDomainCertMatch[1]);
    const domain = await dbFirst(env, `SELECT * FROM custom_domains WHERE id = ? AND merchant_id = ? LIMIT 1`, [id, auth.session.merchantId]);
    if (!domain) return json({ error: 'Domain not found.' }, 404);
    const spec = buildCloudflareCustomHostnameRequest({ ...customDomainRecord(domain), merchantId: auth.session.merchantId }, { zoneId: env.CLOUDFLARE_ZONE_ID || '${CLOUDFLARE_ZONE_ID}' });
    try {
      const result = await executeCloudflareCertificateRequest(spec, env);
      const jobId = uid('cert');
      await dbRun(env, `INSERT INTO domain_certificate_jobs (id, merchant_id, domain_id, provider, external_hostname_id, status, validation_records_json, result_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [jobId, auth.session.merchantId, id, 'cloudflare', result.externalHostnameId || '', result.status || 'pending', JSON.stringify(result.validationRecords || []), JSON.stringify(result)]);
      return json({ ok: result.status === 'executed', job: domainCertificateJobRecord(await dbFirst(env, `SELECT * FROM domain_certificate_jobs WHERE id = ? LIMIT 1`, [jobId])), result }, 201);
    } catch (error) {
      return json({ error: error.message, code: error.code || 'CERTIFICATE_PROVISION_FAILED', missing: error.missing || [], request: spec }, error.code === 'CLOUDFLARE_SECRETS_MISSING' ? 409 : 502);
    }
  }

  const refreshDomainCertMatch = url.pathname.match(/^\/api\/custom-domains\/([^/]+)\/certificate\/refresh$/);
  if (refreshDomainCertMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const domainId = decodeURIComponent(refreshDomainCertMatch[1]);
    const job = await dbFirst(env, `SELECT * FROM domain_certificate_jobs WHERE domain_id = ? AND merchant_id = ? ORDER BY created_at DESC LIMIT 1`, [domainId, auth.session.merchantId]);
    if (!job || !job.external_hostname_id) return json({ error: 'Certificate job not found.' }, 404);
    const spec = buildCloudflareCustomHostnameStatusRequest(job.external_hostname_id, { zoneId: env.CLOUDFLARE_ZONE_ID || '${CLOUDFLARE_ZONE_ID}' });
    try {
      const result = await executeCloudflareCertificateRequest(spec, env);
      await dbRun(env, `UPDATE domain_certificate_jobs SET status = ?, validation_records_json = ?, result_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [result.status || 'pending', JSON.stringify(result.validationRecords || []), JSON.stringify(result), job.id, auth.session.merchantId]);
      return json({ ok: true, job: domainCertificateJobRecord(await dbFirst(env, `SELECT * FROM domain_certificate_jobs WHERE id = ? LIMIT 1`, [job.id])), result });
    } catch (error) {
      return json({ error: error.message, code: error.code || 'CERTIFICATE_REFRESH_FAILED', missing: error.missing || [] }, error.code === 'CLOUDFLARE_SECRETS_MISSING' ? 409 : 502);
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/redirect-rules') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, redirects: await listRedirectRules(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/redirect-rules') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeRedirectRuleInput(await readJson(request) || {});
    const id = uid('red');
    await dbRun(env, `INSERT INTO redirect_rules (id, merchant_id, from_path, to_path, status_code, active) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(merchant_id, from_path) DO UPDATE SET to_path = excluded.to_path, status_code = excluded.status_code, active = excluded.active, updated_at = CURRENT_TIMESTAMP`, [id, auth.session.merchantId, payload.fromPath, payload.toPath, payload.statusCode, payload.active ? 1 : 0]);
    return json({ ok: true, redirects: await listRedirectRules(env, auth.session.merchantId) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/seo-entries') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, seoEntries: await listSeoEntries(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/seo-entries') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeSeoEntryInput(await readJson(request) || {});
    const id = uid('seo');
    await dbRun(env, `INSERT INTO seo_entries (id, merchant_id, resource_type, resource_id, path, title, description, image_url, canonical_url, robots, schema_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(merchant_id, path) DO UPDATE SET title = excluded.title, description = excluded.description, image_url = excluded.image_url, canonical_url = excluded.canonical_url, robots = excluded.robots, schema_json = excluded.schema_json, updated_at = CURRENT_TIMESTAMP`, [id, auth.session.merchantId, payload.resourceType, payload.resourceId, payload.path, payload.title, payload.description, payload.imageUrl, payload.canonicalUrl, payload.robots, JSON.stringify(payload.schema || {})]);
    return json({ ok: true, seoEntries: await listSeoEntries(env, auth.session.merchantId) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/sitemap.xml') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const merchant = merchantRecord(await dbFirst(env, `SELECT * FROM merchants WHERE id = ? LIMIT 1`, [auth.session.merchantId]));
    const entries = buildSitemapEntries({ origin: buildAbsoluteOrigin(url), merchant, products: await listMerchantProducts(env, auth.session.merchantId), pages: await listMerchantPages(env, auth.session.merchantId), collections: await listMerchantCollections(env, auth.session.merchantId), seoEntries: await listSeoEntries(env, auth.session.merchantId) });
    return text(renderSitemapXml(entries), 200, { 'content-type': 'application/xml; charset=utf-8' });
  }

  if (request.method === 'GET' && url.pathname === '/api/payment-disputes') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, disputes: await listPaymentDisputes(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/payment-disputes') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizePaymentDisputeInput(await readJson(request) || {});
    const id = uid('dsp');
    await dbRun(env, `INSERT INTO payment_disputes (id, merchant_id, order_id, provider, provider_dispute_id, amount_cents, currency, reason, status, due_at, evidence_due_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.orderId || null, payload.provider, payload.providerDisputeId, payload.amountCents, payload.currency, payload.reason, payload.status, payload.dueAt || '', payload.evidenceDueBy || '']);
    return json({ ok: true, dispute: paymentDisputeRecord(await dbFirst(env, `SELECT * FROM payment_disputes WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  const disputeEvidenceMatch = url.pathname.match(/^\/api\/payment-disputes\/([^/]+)\/evidence$/);
  if (disputeEvidenceMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const disputeId = decodeURIComponent(disputeEvidenceMatch[1]);
    const disputeRow = await dbFirst(env, `SELECT * FROM payment_disputes WHERE id = ? AND merchant_id = ? LIMIT 1`, [disputeId, auth.session.merchantId]);
    if (!disputeRow) return json({ error: 'Dispute not found.' }, 404);
    const dispute = paymentDisputeRecord(disputeRow);
    const manual = normalizeDisputeEvidenceInput(await readJson(request) || {});
    const order = dispute.orderId ? await getOrderDetails(env, dispute.orderId, auth.session.merchantId) : null;
    const riskAssessments = order ? await dbAll(env, `SELECT * FROM risk_assessments WHERE order_id = ? AND merchant_id = ? ORDER BY created_at DESC`, [order.id, auth.session.merchantId]) : [];
    const packet = buildDisputeEvidencePacket(dispute, { order, payments: order?.payments || [], fulfillments: order?.fulfillments || [], riskAssessments: riskAssessments.map(riskAssessmentRecord) }, manual);
    const id = uid('evd');
    await dbRun(env, `INSERT INTO dispute_evidence (id, merchant_id, dispute_id, evidence_json, evidence_score, status) VALUES (?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, dispute.id, JSON.stringify(packet), packet.evidenceScore, packet.status]);
    return json({ ok: true, evidence: disputeEvidenceRecord(await dbFirst(env, `SELECT * FROM dispute_evidence WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  const disputeSubmitMatch = url.pathname.match(/^\/api\/payment-disputes\/([^/]+)\/evidence\/([^/]+)\/submit$/);
  if (disputeSubmitMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const disputeId = decodeURIComponent(disputeSubmitMatch[1]);
    const evidenceId = decodeURIComponent(disputeSubmitMatch[2]);
    const disputeRow = await dbFirst(env, `SELECT * FROM payment_disputes WHERE id = ? AND merchant_id = ? LIMIT 1`, [disputeId, auth.session.merchantId]);
    const evidenceRow = await dbFirst(env, `SELECT * FROM dispute_evidence WHERE id = ? AND dispute_id = ? AND merchant_id = ? LIMIT 1`, [evidenceId, disputeId, auth.session.merchantId]);
    if (!disputeRow || !evidenceRow) return json({ error: 'Dispute evidence not found.' }, 404);
    const dispute = paymentDisputeRecord(disputeRow);
    const evidence = disputeEvidenceRecord(evidenceRow);
    const connection = await resolveProviderConnection(env, auth.session.merchantId, dispute.provider, '');
    if (!connection) return json({ error: `No active ${dispute.provider} provider connection found for this merchant.` }, 409);
    try {
      const result = await executeProviderDisputeEvidence(connection, { dispute, evidence: evidence.evidence }, env);
      if (result.status !== 'executed') return json({ error: `${dispute.provider} dispute evidence submission failed.`, result }, 502);
      await dbRun(env, `UPDATE dispute_evidence SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP, provider_submission_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [JSON.stringify(result), evidence.id, auth.session.merchantId]);
      await dbRun(env, `UPDATE payment_disputes SET status = 'submitted', provider_submission_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [JSON.stringify(result), dispute.id, auth.session.merchantId]);
      return json({ ok: true, result, evidence: disputeEvidenceRecord(await dbFirst(env, `SELECT * FROM dispute_evidence WHERE id = ? LIMIT 1`, [evidence.id])) });
    } catch (error) {
      return json({ error: error.message, code: error.code || 'DISPUTE_SUBMISSION_FAILED', missing: error.missing || [] }, error.code === 'PROVIDER_SECRETS_MISSING' ? 409 : 502);
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/app-billing/plans') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, plans: await listAppBillingPlans(env, auth.session.merchantId) });
  }

  if (request.method === 'POST' && url.pathname === '/api/app-billing/plans') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const payload = normalizeAppBillingPlanInput(await readJson(request) || {});
    const app = await dbFirst(env, `SELECT * FROM commerce_apps WHERE id = ? AND merchant_id = ? LIMIT 1`, [payload.appId, auth.session.merchantId]);
    if (!app) return json({ error: 'App not found.' }, 404);
    const id = uid('abp');
    await dbRun(env, `INSERT INTO app_billing_plans (id, merchant_id, app_id, code, name, billing_type, amount_cents, usage_unit, usage_cents, interval_unit, trial_days, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, payload.appId, payload.code, payload.name, payload.billingType, payload.amountCents, payload.usageUnit, payload.usageCents, payload.intervalUnit, payload.trialDays, payload.active ? 1 : 0]);
    return json({ ok: true, plan: appBillingPlanRecord(await dbFirst(env, `SELECT * FROM app_billing_plans WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/app-billing/subscriptions') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, subscriptions: await listAppBillingSubscriptions(env, auth.session.merchantId), usageEvents: await listAppUsageEvents(env, auth.session.merchantId), invoices: await listAppBillingInvoices(env, auth.session.merchantId) });
  }

  const appBillingSubscribeMatch = url.pathname.match(/^\/api\/app-installations\/([^/]+)\/billing\/subscriptions$/);
  if (appBillingSubscribeMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const installationId = decodeURIComponent(appBillingSubscribeMatch[1]);
    const install = await dbFirst(env, `SELECT * FROM app_installations WHERE id = ? AND merchant_id = ? LIMIT 1`, [installationId, auth.session.merchantId]);
    if (!install) return json({ error: 'App installation not found.' }, 404);
    const body = await readJson(request) || {};
    const planRow = await dbFirst(env, `SELECT * FROM app_billing_plans WHERE id = ? AND merchant_id = ? LIMIT 1`, [body.planId, auth.session.merchantId]);
    if (!planRow) return json({ error: 'App billing plan not found.' }, 404);
    const plan = appBillingPlanRecord(planRow);
    const payload = normalizeAppBillingSubscriptionInput({ ...body, installationId, planId: plan.id }, plan);
    const id = uid('abs');
    await dbRun(env, `INSERT INTO app_billing_subscriptions (id, merchant_id, installation_id, plan_id, status, current_period_start, current_period_end, external_provider, external_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(merchant_id, installation_id) DO UPDATE SET plan_id = excluded.plan_id, status = excluded.status, current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end, external_provider = excluded.external_provider, external_ref = excluded.external_ref, updated_at = CURRENT_TIMESTAMP`, [id, auth.session.merchantId, installationId, plan.id, payload.status, payload.currentPeriodStart, payload.currentPeriodEnd, payload.externalProvider, payload.externalRef]);
    return json({ ok: true, subscriptions: await listAppBillingSubscriptions(env, auth.session.merchantId) }, 201);
  }

  const appUsageMatch = url.pathname.match(/^\/api\/app-billing\/subscriptions\/([^/]+)\/usage$/);
  if (appUsageMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const subscriptionId = decodeURIComponent(appUsageMatch[1]);
    const subscription = await dbFirst(env, `SELECT * FROM app_billing_subscriptions WHERE id = ? AND merchant_id = ? LIMIT 1`, [subscriptionId, auth.session.merchantId]);
    if (!subscription) return json({ error: 'App billing subscription not found.' }, 404);
    const plan = appBillingPlanRecord(await dbFirst(env, `SELECT * FROM app_billing_plans WHERE id = ? AND merchant_id = ? LIMIT 1`, [subscription.plan_id, auth.session.merchantId]));
    const payload = normalizeAppUsageEventInput({ ...(await readJson(request) || {}), subscriptionId }, plan);
    const id = uid('use');
    await dbRun(env, `INSERT INTO app_usage_events (id, merchant_id, subscription_id, metric_key, quantity, unit_cents, total_cents, idempotency_key, meta_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, subscription.id, payload.metricKey, payload.quantity, payload.unitCents, payload.totalCents, payload.idempotencyKey || uid('idem'), JSON.stringify(payload.meta || {})]);
    return json({ ok: true, usageEvent: appUsageEventRecord(await dbFirst(env, `SELECT * FROM app_usage_events WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  const appInvoiceMatch = url.pathname.match(/^\/api\/app-billing\/subscriptions\/([^/]+)\/invoices$/);
  if (appInvoiceMatch && request.method === 'POST') {
    const auth = await requireMerchantSession(request, env);
    if (auth.error) return auth.error;
    const subscriptionId = decodeURIComponent(appInvoiceMatch[1]);
    const subscriptionRow = await dbFirst(env, `SELECT * FROM app_billing_subscriptions WHERE id = ? AND merchant_id = ? LIMIT 1`, [subscriptionId, auth.session.merchantId]);
    if (!subscriptionRow) return json({ error: 'App billing subscription not found.' }, 404);
    const subscription = appBillingSubscriptionRecord(subscriptionRow);
    const plan = appBillingPlanRecord(await dbFirst(env, `SELECT * FROM app_billing_plans WHERE id = ? AND merchant_id = ? LIMIT 1`, [subscription.planId, auth.session.merchantId]));
    const usageEvents = (await dbAll(env, `SELECT * FROM app_usage_events WHERE subscription_id = ? AND merchant_id = ? ORDER BY created_at ASC`, [subscription.id, auth.session.merchantId])).map(appUsageEventRecord);
    const invoice = buildAppBillingInvoice({ subscription, plan, usageEvents });
    const id = uid('abi');
    await dbRun(env, `INSERT INTO app_billing_invoices (id, merchant_id, subscription_id, status, currency, base_cents, usage_cents, total_cents, line_items_json) VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?)`, [id, auth.session.merchantId, subscription.id, invoice.currency, invoice.baseCents, invoice.usageCents, invoice.totalCents, JSON.stringify(invoice.lineItems)]);
    return json({ ok: true, invoice: appBillingInvoiceRecord(await dbFirst(env, `SELECT * FROM app_billing_invoices WHERE id = ? LIMIT 1`, [id])) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/ae/merchants') {
    const auth = await requireAeSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, merchants: await listMerchants(env) });
  }

  if (request.method === 'GET' && url.pathname === '/api/ae/roster') {
    const auth = await requireAeSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, agents: await listAeAgents(env) });
  }

  if (request.method === 'POST' && url.pathname === '/api/ae/roster') {
    const auth = await requireAeSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    if (!body.displayName) return json({ error: 'displayName is required.' }, 400);
    const id = uid('ae');
    await dbRun(env, `INSERT INTO ae_agents (id, display_name, email, territory, notes, active) VALUES (?, ?, ?, ?, ?, 1)`, [id, body.displayName, body.email || '', body.territory || '', body.notes || '']);
    return json({ ok: true, agent: await dbFirst(env, `SELECT * FROM ae_agents WHERE id = ?`, [id]) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/ae/bookings') {
    const auth = await requireAeSession(request, env);
    if (auth.error) return auth.error;
    return json({ ok: true, bookings: await listAeBookings(env, url.searchParams.get('agentId') || '') });
  }

  if (request.method === 'POST' && url.pathname === '/api/ae/bookings') {
    const auth = await requireAeSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    if (!body.agentId || !body.merchantId || !body.bookingDate) return json({ error: 'agentId, merchantId, and bookingDate are required.' }, 400);
    const id = uid('bk');
    await dbRun(env, `INSERT INTO ae_bookings (id, merchant_id, agent_id, booking_date, location, contact_name, contact_phone, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id,
      body.merchantId,
      body.agentId,
      body.bookingDate,
      body.location || '',
      body.contactName || '',
      body.contactPhone || '',
      body.notes || '',
      body.status || 'scheduled'
    ]);
    return json({ ok: true, booking: await dbFirst(env, `SELECT * FROM ae_bookings WHERE id = ?`, [id]) }, 201);
  }

  if (request.method === 'POST' && url.pathname === '/api/ae/route-packets/generate') {
    const auth = await requireAeSession(request, env);
    if (auth.error) return auth.error;
    const body = await readJson(request) || {};
    if (!body.agentId || !body.routeDate) return json({ error: 'agentId and routeDate are required.' }, 400);
    const agent = await dbFirst(env, `SELECT * FROM ae_agents WHERE id = ? LIMIT 1`, [body.agentId]);
    if (!agent) return json({ error: 'Agent not found.' }, 404);
    const bookings = await dbAll(env, `SELECT * FROM ae_bookings WHERE agent_id = ? AND booking_date LIKE ? ORDER BY booking_date ASC`, [body.agentId, `${body.routeDate}%`]);
    const merchants = await listMerchants(env);
    const packet = buildRoutePacket({ agent, bookings, merchants, routeDate: body.routeDate });
    const id = uid('pkt');
    await dbRun(env, `INSERT INTO ae_route_packets (id, agent_id, route_date, packet_json) VALUES (?, ?, ?, ?)`, [id, body.agentId, body.routeDate, JSON.stringify(packet)]);
    return json({ ok: true, routePacketId: id, packet }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/ae/route-packets') {
    const auth = await requireAeSession(request, env);
    if (auth.error) return auth.error;
    const rows = await dbAll(env, `SELECT * FROM ae_route_packets ORDER BY created_at DESC`);
    return json({ ok: true, packets: rows.map((row) => ({ id: row.id, agentId: row.agent_id, routeDate: row.route_date, packet: JSON.parse(row.packet_json || '{}'), createdAt: row.created_at })) });
  }

  return json({ error: `No route for ${request.method} ${url.pathname}` }, 404);
}

export default {
  async scheduled(event, env, ctx) {
    if (!env.DB || !env.SESSION_SECRET) return;
    const task = processSystemQueues(env).catch((error) => console.error('scheduled_queue_error', error));
    if (ctx?.waitUntil) ctx.waitUntil(task);
    else await task;
  },

  async fetch(request, env) {
    if (!env.DB) return json({ error: 'DB binding is not configured.' }, 500);
    if (!env.SESSION_SECRET) return json({ error: 'SESSION_SECRET is not configured.' }, 500);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return optionsResponse(request, env);
    }

    if (url.pathname.startsWith('/api/')) {
      try {
        const sizeError = await enforceApiBodyLimit(request, env);
        if (sizeError) return applyApiResponseHeaders(sizeError, request, env);

        const rateLimitError = await enforceApiRateLimit(request, env, url);
        if (rateLimitError) return applyApiResponseHeaders(rateLimitError, request, env);

        const csrfError = await enforceCsrf(request, env, url);
        if (csrfError) return applyApiResponseHeaders(csrfError, request, env);

        const idempotencyKey = normalizeIdempotencyKey(request.headers.get('idempotency-key') || '');
        if (idempotencyKey && isMutatingMethod(request.method)) {
          const scope = await idempotencyScopeForRequest(request, env);
          const bodyHash = await requestBodyHash(request);
          const existing = await findIdempotencyRecord(env, { scope, key: idempotencyKey, method: request.method, path: url.pathname, bodyHash });
          if (existing?.conflict) return applyApiResponseHeaders(existing.response, request, env);
          if (existing) return applyApiResponseHeaders(responseFromIdempotencyRecord(existing), request, env);
          const response = await handleApi(request, env, url);
          applyApiResponseHeaders(response, request, env);
          if (response.status < 500) await storeIdempotencyRecord(env, { scope, key: idempotencyKey, method: request.method, path: url.pathname, bodyHash, response });
          return response;
        }

        const response = await handleApi(request, env, url);
        return applyApiResponseHeaders(response, request, env);
      } catch (error) {
        console.error('api_error', error);
        return applyApiResponseHeaders(json({ error: error?.message || 'Unexpected server error.' }, 500), request, env);
      }
    }

    const storefrontProductMatch = url.pathname.match(/^\/s\/([^/]+)\/products\/([^/]+)\/?$/);
    if (storefrontProductMatch && env.ASSETS) {
      const slug = decodeURIComponent(storefrontProductMatch[1]);
      const product = decodeURIComponent(storefrontProductMatch[2]);
      const target = new URL(`${url.origin}/store/index.html`);
      target.searchParams.set('slug', slug);
      target.searchParams.set('product', product);
      return env.ASSETS.fetch(new Request(target.toString(), request));
    }

    const storefrontCollectionMatch = url.pathname.match(/^\/s\/([^/]+)\/collections\/([^/]+)\/?$/);
    if (storefrontCollectionMatch && env.ASSETS) {
      const slug = decodeURIComponent(storefrontCollectionMatch[1]);
      const collection = decodeURIComponent(storefrontCollectionMatch[2]);
      const target = new URL(`${url.origin}/store/index.html`);
      target.searchParams.set('slug', slug);
      target.searchParams.set('collection', collection);
      return env.ASSETS.fetch(new Request(target.toString(), request));
    }

    const storefrontMatch = url.pathname.match(/^\/s\/([^/]+)\/?$/);
    if (storefrontMatch && env.ASSETS) {
      const slug = decodeURIComponent(storefrontMatch[1]);
      const target = new URL(`${url.origin}/store/index.html`);
      target.searchParams.set('slug', slug);
      return env.ASSETS.fetch(new Request(target.toString(), request));
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return text('Static assets binding is not configured.', 500);
  }
};
