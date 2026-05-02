# Skye Media Center v1

Artist-first media center with:
- artist pages
- music uploads and streaming
- photo drops
- video embed promotion lane
- pre-release dates
- IndexedDB local storage
- Neon-backed metadata sync via `/.netlify/functions/media-center`

Current boundary: audio and image uploads are direct in-browser and can be synced as data URLs for practical demo-scale use; video is embed-first to avoid unstable large-binary upload behavior inside the current pack.
