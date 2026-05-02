# DEPLOY GUIDE V67

## What V67 adds
- `housecircle.integral.v67.js`
- `housecircle.integral.tours.v67.js`
- `phc-walkthrough.js`
- `housecircle-walkthrough.js`
- static walkthrough artifacts under `operator/`
- current-build walkthrough artifacts at the repo root

## Live discoverability
When the platform is live, the walkthrough is discoverable from:
- shell/nav walkthrough button
- walkthrough card in platform views
- static operator report path
- cloud walkthrough endpoint

## Function endpoints
- `/.netlify/functions/phc-walkthrough`
- `/.netlify/functions/phc-health`

## Recommended live check
1. sign in through the shipped operator flow
2. open the Walkthrough button from the live shell
3. export HTML and JSON from the walkthrough center
4. hit `phc-health` and confirm walkthrough metadata appears
