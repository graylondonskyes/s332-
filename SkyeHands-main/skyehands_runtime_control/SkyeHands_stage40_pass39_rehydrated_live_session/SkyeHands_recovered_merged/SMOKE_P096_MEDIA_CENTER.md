# P096 Smoke Proof — Media Center Behavioral

Generated: 2026-04-27T17:43:22.588Z
Result: **PASS** | 22/22 assertions (upload ok, file path verified, search result shape, publish workflow)

## Assertions
- ✅ upload returns 201
- ✅ asset has id
- ✅ asset type=image
- ✅ file actually written
- ✅ list returns 200
- ✅ list includes uploaded asset
- ✅ get asset returns 200
- ✅ get asset returns correct title
- ✅ update asset returns 200
- ✅ description updated
- ✅ search returns 200
- ✅ search finds uploaded asset
- ✅ search results have score
- ✅ publish returns 200
- ✅ asset published
- ✅ publishedAt set
- ✅ stats returns 200
- ✅ stats totalAssets >= 1
- ✅ stats byType has image
- ✅ stats recentUploads array
- ✅ delete returns 200
- ✅ asset archived not deleted

## Coverage
- ✅ Upload with real file write
- ✅ Asset list/get
- ✅ Metadata update
- ✅ Full-text search with scoring
- ✅ Publish workflow
- ✅ Stats aggregation
- ✅ Soft-delete (archived)