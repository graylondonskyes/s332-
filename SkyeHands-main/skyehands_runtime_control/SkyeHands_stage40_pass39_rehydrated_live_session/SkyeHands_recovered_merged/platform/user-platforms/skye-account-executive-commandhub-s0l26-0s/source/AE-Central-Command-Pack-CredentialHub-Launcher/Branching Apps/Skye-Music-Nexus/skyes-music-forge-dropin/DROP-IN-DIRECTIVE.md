# Skyes Music Forge — Single Folder Drop-In

This package is meant to be copied into any repo as one folder.

## The simple version
1. Copy the entire `skyes-music-forge-dropin` folder into your repo.
2. Keep the internal paths unchanged.
3. Serve `index.html` from that folder.
4. Point the runtime to your own endpoint if you do not want to use the included Netlify function.

## Zero-rewrite integration rule
Do not break this into adapters, examples, or extra packages.
Drop the folder in as-is, then wire around it.

## Fastest mounting options
- Static/public repo: put the folder anywhere you serve static files and open `/skyes-music-forge-dropin/index.html`.
- Theia/custom launcher: open this file in a webview, iframe, browser pane, or launcher panel.
- Existing app shell: link or iframe the folder instead of rewriting the tool.

## Optional runtime override
If your repo uses a different backend route, set one of these before loading the page:

```html
<script>
window.SOL_MUSIC_FORGE_API = '/api/music-forge';
</script>
```

Or launch it with:

```text
index.html?runtime=/api/music-forge
```

## Optional host hooks
The page works on its own.
If your wrapper wants tighter control, expose `window.SkyesMusicForgeHost` with any of these optional functions:

```js
window.SkyesMusicForgeHost = {
  async pickFiles(){
    // return an array of File objects
  },
  async saveFile({ filename, blob, mimeType }){
    // save/export however your repo wants
    // return false to force normal browser download
  },
  async extractAudioFromVideo({ file, preferredMimeType }){
    // return a Blob or { blob }
    // use ffmpeg or your own runtime if you want
  }
};
```

## What is already wired
- Record vocals in-app
- Import audio and video files
- Extract audio from video
- Transcribe selected clips
- Get AI coaching / hook / mix help
- Build beat blueprints from vocals and notes
- Render beat clips into the session
- Edit clips on the visual timeline
- Export mixes and text output

## What to edit if you want your own backend lane
`index.html` already supports a custom runtime endpoint.
The included default is:

```text
/.netlify/functions/openai-audio-studio
```

## What not to do
- Do not split this into a multi-package system.
- Do not rewrite the UI just to mount it.
- Do not change asset paths unless you also update the HTML.

The intended usage is simple: copy the folder in, mount the page, optionally override the runtime, done.
