#!/usr/bin/env bash
set -euo pipefail
DOMAIN="${DOMAIN:-testnode.example.com}"
EMAIL="${EMAIL:-operator@example.com}"
ACME_CLIENT="${ACME_CLIENT:-certbot}"
CHALLENGE="${CHALLENGE:-dns-01}"
echo "Prepare public issuance for $DOMAIN via $ACME_CLIENT using $CHALLENGE."
echo "CSR: leaf.csr"
echo "HTTP-01 token file: .well-known/acme-challenge/2ee7a8cb67207c50bf62f4e2e46ecaca"
echo "DNS-01 record file: dns-01-record.txt"
