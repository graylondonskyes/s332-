window.SkyesMusicForgeHost = {
  async pickFiles(){
    return [];
  },
  async saveFile({ filename, blob }){
    // Example: let your wrapper save the blob natively.
    // Return false to fall back to normal browser download.
    return false;
  },
  async extractAudioFromVideo({ file }){
    // Example: use your wrapper runtime or ffmpeg lane.
    // Return a Blob or { blob } when ready.
    return false;
  }
};
