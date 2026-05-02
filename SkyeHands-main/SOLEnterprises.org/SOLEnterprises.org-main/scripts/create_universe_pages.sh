#!/usr/bin/env bash
set -euo pipefail

# =========================================================
# SOLEnterprises — Universe Pages Creator (MINIMAL TEMPLATE)
#
# Uses: pages/_template-minimal.html
# Creates ONLY the pages explicitly listed.
# Does NOT overwrite existing files.
# =========================================================

TEMPLATE="pages/_template-minimal.html"
PAGES_DIR="pages"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "ERROR: Missing $TEMPLATE"
  echo "Fix: create pages/_template-minimal.html first."
  exit 1
fi

mkdir -p "$PAGES_DIR"

create_page () {
  local file="$1"
  local title="$2"
  local desc="$3"

  local path="$PAGES_DIR/$file"

  if [[ -f "$path" ]]; then
    echo "SKIP (exists): $path"
    return 0
  fi

  cp "$TEMPLATE" "$path"

  # Replace placeholders in the minimal template
  perl -0777 -i -pe "s/PAGE_TITLE/$title/g; s/PAGE_DESCRIPTION/$desc/g" "$path"

  echo "CREATE: $path"
}

# =========================
# 1) HOME — SOLE PORTAL
# =========================
create_page \
  "sole-portal.html" \
  "Home — The SOLE Portal" \
  "Your master homepage that routes to the 4 Realms + featured products and services."

# =========================
# 2) REALMS
# =========================
create_page \
  "realms.html" \
  "The Four Realms" \
  "Explore the Four Realms of SOLEnterprises."

create_page \
  "realm-earthside-services.html" \
  "Realm I — Earthside Services" \
  "Operational, business, and execution-focused services."

create_page \
  "realm-sanctuaries.html" \
  "Realm II — Sanctuaries" \
  "Sanctuary-based experiences, wellness, and restoration."

create_page \
  "realm-intelligence-ai.html" \
  "Realm III — Intelligence & AI" \
  "Artificial intelligence, automation, and intelligence systems."

create_page \
  "realm-storyworlds.html" \
  "Realm IV — Storyworlds" \
  "Worldbuilding, narrative universes, and creative IP."

# =========================
# 3) STORE
# =========================
create_page \
  "store-hub.html" \
  "Store Hub" \
  "Browse all SOLEnterprises products and digital offerings."

create_page \
  "store-ai-products.html" \
  "AI Products" \
  "AI-powered tools and digital products."

create_page \
  "store-books-interactive-reading.html" \
  "Books & Interactive Reading" \
  "Books and interactive narrative experiences."

create_page \
  "store-tcg-essence-crown.html" \
  "TCG (Essence Crown)" \
  "Essence Crown trading card game products and lore."

create_page \
  "store-digital-resources.html" \
  "Digital Resources" \
  "Downloadable kits, libraries, and SkyeCares resources."

# =========================
# 4) LEADERSHIP
# =========================
create_page \
  "leadership-hub.html" \
  "Leadership Hub" \
  "Leadership structure and guiding vision of SOLEnterprises."

create_page \
  "gray-london-skyes.html" \
  "Gray London Skyes — Founder & CEO" \
  "Founder and CEO profile."

create_page \
  "the-four-currents.html" \
  "The Four Currents" \
  "Hahalakiel, Gray, Kaiwass, and Halucard."

# =========================
# 5) CONTACT
# =========================
create_page \
  "contact-hub.html" \
  "Contact Hub" \
  "Contact SOLEnterprises and route your inquiry."

create_page \
  "contact-routing.html" \
  "General Inquiries & Division Routing" \
  "Route inquiries to the appropriate division."

echo ""
echo "DONE."
echo "Pages created using _template-minimal.html"
