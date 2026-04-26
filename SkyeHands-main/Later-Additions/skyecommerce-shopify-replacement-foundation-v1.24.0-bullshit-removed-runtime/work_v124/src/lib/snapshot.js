import { slugify } from './utils.js';

export function defaultTheme(merchant = {}) {
  const accent = merchant.accentColor || '#7c3aed';
  return {
    accent,
    surface: merchant.surfaceColor || '#111827',
    background: merchant.backgroundColor || '#050816',
    text: merchant.textColor || '#f8fafc',
    heroTitle: merchant.heroTitle || merchant.brandName || 'Your store',
    heroTagline: merchant.heroTagline || 'Owned storefronts, real control, no rented mall dependency.',
    featuredCollectionTitle: merchant.featuredCollectionTitle || 'Featured products',
    checkoutNote: merchant.checkoutNote || 'Order requests land inside your own platform stack.'
  };
}

export function buildStorefrontSnapshot(merchant, products = [], shippingProfiles = [], taxProfiles = [], discountCodes = [], collections = [], pages = [], navigation = []) {
  const theme = defaultTheme(merchant);
  const normalizedProducts = products
    .filter((item) => item.status !== 'archived')
    .map((item) => ({
      id: item.id,
      slug: item.slug || slugify(item.title),
      title: item.title,
      descriptionHtml: item.descriptionHtml || '',
      shortDescription: item.shortDescription || '',
      priceCents: Number(item.priceCents || 0),
      compareAtCents: Number(item.compareAtCents || 0),
      sku: item.sku || '',
      inventoryOnHand: Number(item.inventoryOnHand || 0),
      heroImageUrl: item.heroImageUrl || '',
      media: (Array.isArray(item.media) ? item.media : []).map((media) => ({
        id: media.id,
        url: media.url,
        alt: media.alt || item.title,
        source: media.source || '',
        position: Number(media.position || 0)
      })),
      trackInventory: Boolean(Number(item.trackInventory || 0)),
      available: !item.trackInventory || Number(item.inventoryOnHand || 0) > 0,
      hasVariants: Boolean(item.hasVariants || (Array.isArray(item.variants) && item.variants.length)),
      defaultVariantId: item.defaultVariantId || '',
      priceRange: item.priceRange || { minCents: Number(item.priceCents || 0), maxCents: Number(item.priceCents || 0) },
      variants: (Array.isArray(item.variants) ? item.variants : []).filter((variant) => variant.status !== 'archived').map((variant) => ({
        id: variant.id,
        title: variant.title || '',
        sku: variant.sku || '',
        option1: variant.option1 || '',
        option2: variant.option2 || '',
        option3: variant.option3 || '',
        priceCents: Number(variant.priceCents || 0),
        compareAtCents: Number(variant.compareAtCents || 0),
        inventoryOnHand: Number(variant.inventoryOnHand || 0),
        trackInventory: Boolean(variant.trackInventory),
        available: !variant.trackInventory || Number(variant.inventoryOnHand || 0) > 0
      }))
    }));
  const liveDiscounts = (Array.isArray(discountCodes) ? discountCodes : [])
    .filter((item) => item.active)
    .map((item) => ({
      code: item.code,
      title: item.title || item.code,
      type: item.type,
      amountCents: Number(item.amountCents || 0),
      amountBps: Number(item.amountBps || 0),
      minimumSubtotalCents: Number(item.minimumSubtotalCents || 0)
    }));
  const liveCollections = (Array.isArray(collections) ? collections : [])
    .filter((item) => item.visible !== false)
    .map((item) => ({
      id: item.id,
      slug: item.slug || slugify(item.title),
      title: item.title,
      description: item.description || '',
      sortMode: item.sortMode || 'manual',
      productIds: Array.isArray(item.productIds) ? item.productIds : [],
      productCount: Array.isArray(item.productIds) ? item.productIds.length : 0
    }));
  const livePages = (Array.isArray(pages) ? pages : [])
    .filter((item) => item.visible !== false)
    .map((item) => ({
      id: item.id,
      slug: item.slug || slugify(item.title),
      title: item.title,
      bodyHtml: item.bodyHtml || ''
    }));
  const liveNavigation = (Array.isArray(navigation) ? navigation : [])
    .filter((item) => item.visible !== false)
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
    .map((item) => ({
      id: item.id,
      label: item.label,
      type: item.type || 'page',
      href: item.href || '',
      targetRef: item.targetRef || '',
      position: Number(item.position || 0)
    }));
  return {
    merchant: {
      id: merchant.id,
      slug: merchant.slug,
      brandName: merchant.brandName,
      supportEmail: merchant.email,
      currency: merchant.currency || 'USD'
    },
    theme,
    shippingProfiles,
    taxProfiles,
    discountCodes: liveDiscounts,
    collections: liveCollections,
    pages: livePages,
    navigation: liveNavigation,
    publishedAt: new Date().toISOString(),
    productCount: normalizedProducts.length,
    products: normalizedProducts,
    seo: {
      title: `${merchant.brandName} · Powered by Skyes Over London`,
      description: theme.heroTagline
    }
  };
}
