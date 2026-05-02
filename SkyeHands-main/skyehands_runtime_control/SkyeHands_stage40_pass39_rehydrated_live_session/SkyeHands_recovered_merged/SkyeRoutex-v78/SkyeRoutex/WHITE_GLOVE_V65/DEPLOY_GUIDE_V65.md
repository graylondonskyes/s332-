# V65 DEPLOY GUIDE

## New function endpoints
- `/.netlify/functions/phc-auth-mfa-enroll`
- `/.netlify/functions/phc-auth-mfa-verify`
- `/.netlify/functions/phc-device-register`
- `/.netlify/functions/phc-lock-acquire`
- `/.netlify/functions/phc-lock-release`
- `/.netlify/functions/phc-event-feed`

## Existing required functions still used by V65
- `/.netlify/functions/phc-auth-login`
- `/.netlify/functions/phc-sync-state`
- `/.netlify/functions/phc-sync-frame`
- `/.netlify/functions/phc-pos-ingest`
- `/.netlify/functions/phc-webhook-square`
- `/.netlify/functions/phc-job-drain`
- `/.netlify/functions/phc-health`

## Suggested env vars
- `PHC_SESSION_SECRET`
- `PHC_DATA_DIR`

## Smoke after deploy
1. log in from the cloud mesh modal
2. enroll MFA and save recovery codes
3. verify the current TOTP code
4. register the current device as trusted
5. acquire a route lock
6. refresh the event feed and confirm lock/session/device rows
7. release the lock
