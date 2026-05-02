#!/usr/bin/env bash
set -euo pipefail
DOMAIN="${DOMAIN:-testpoly.example.com}"
EMAIL="${EMAIL:-operator@example.com}"
ACME_CLIENT="${ACME_CLIENT:-certbot}"
CHALLENGE="${CHALLENGE:-dns-01}"
echo "Prepare public issuance for $DOMAIN via $ACME_CLIENT using $CHALLENGE."
echo "CSR: leaf.csr"
echo "HTTP-01 token file: .well-known/acme-challenge/fa25ad65acbc6ef8dd126aa817ddc2ec"
echo "DNS-01 record file: dns-01-record.txt"
