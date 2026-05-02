/**
 * SOLE CLIENT REGISTRY
 * =====================
 * Single source of truth for all client sites.
 * Both the header menu and portfolio page auto-populate from this data.
 * 
 * TO ADD A NEW CLIENT:
 * 1. Create their folder in /clients/client-name/
 * 2. Add their index.html
 * 3. Add an entry to the SOLE_CLIENTS array below
 * 4. Both menu and portfolio will auto-update!
 */

const SOLE_CLIENTS = [
  {
    id: "sap-logistics",
    name: "SAP Logistics",
    emoji: "🚚",
    description: "Houston's elite medical courier and freight operation with cinematic, neon styling.",
    industry: "Logistics",
    status: "Live",
    path: "/clients/sap-logistics/",
    featured: true
  },
  {
    id: "kee-care",
    name: "Kee Care Solutions",
    emoji: "💜",
    description: "Lilac-themed healthcare and logistics experience with sanctuary-grade presentation.",
    industry: "Healthcare",
    status: "Live",
    path: "/clients/kee-care/",
    featured: true
  },
  {
    id: "capone-media",
    name: "Capone Media",
    emoji: "🎬",
    description: "Premier media production company with cinematic gold and black aesthetic.",
    industry: "Media",
    status: "Live",
    path: "/clients/capone-media/",
    featured: true
  },
  {
    id: "phase-ii",
    name: "Phaze II Barber Shop",
    emoji: "🪒",
    description: "Premium barbershop experience with cinematic upgrades and elite styling.",
    industry: "Grooming",
    status: "Live",
    path: "/clients/Phase-II/",
    featured: true
  },
  {
    id: "synsaai",
    name: "Synsaai",
    emoji: "💎",
    description: "Tech innovation company with cosmic, futuristic design and premium aesthetics.",
    industry: "Technology",
    status: "Live",
    path: "/clients/synsaai/",
    featured: true
  },
  {
    id: "henny-god",
    name: "Henny God",
    emoji: "🥃",
    description: "Luxury spirits brand with golden opulence and regal sophistication.",
    industry: "Spirits",
    status: "Live",
    path: "/clients/henny-god/",
    featured: true
  },
  {
    id: "ambi",
    name: "Ambi",
    emoji: "🌓",
    description: "Duality-themed brand balancing light and dark with elegant design.",
    industry: "Lifestyle",
    status: "Live",
    path: "/clients/ambi/",
    featured: true
  },
  {
    id: "deus",
    name: "Deus",
    emoji: "⚡",
    description: "Divine premium brand with lightning-powered luxury aesthetics.",
    industry: "Premium",
    status: "Live",
    path: "/clients/deus/",
    featured: true
  },
  {
    id: "beatcreep-bryan-pino",
    name: "BeatCreep Bryan Pino",
    emoji: "🎵",
    description: "Music producer and audio engineer with dynamic, rhythm-focused design.",
    industry: "Music",
    status: "Live",
    path: "/clients/beatcreep-bryan-pino/",
    featured: true
  },
  {
    id: "lolas-tacos",
    name: "Lola's Tacos",
    emoji: "🌮",
    description: "Vibrant Mexican restaurant with warm, festive atmosphere and authentic flavor.",
    industry: "Food & Beverage",
    status: "Live",
    path: "/clients/lolas-tacos/",
    featured: true
  }
];

// Make available globally
if (typeof window !== 'undefined') {
  window.SOLE_CLIENTS = SOLE_CLIENTS;
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SOLE_CLIENTS };
}
