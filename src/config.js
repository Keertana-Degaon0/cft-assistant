export const CONFIG = Object.freeze({
  appName: "Craftech 360 AI Feasibility Tool",
  version: "1.0.0",
  api: Object.freeze({
    endpoint: "/api/analyze",
  }),
  company: {
    name: "Craftech 360",
    tagline: "Crafting Immersive Experiences",
    description:
      "Craftech 360 specializes in crafting immersive experiences that connect brands with their audiences through innovative technology and creative design.",
    stats: Object.freeze({
      events: "800+",
      cities: 17,
      countries: 5,
      reach: "25M+",
    }),
    locations: ["Bengaluru", "Mumbai"],
    expertise: [
      "Museum and heritage exhibits with interactive digital and AR/VR storytelling",
      "Experiential zones for retail, mall, and theme environments",
      "Corporate events and conferences at large scale, including 5000+ attendees",
      "Brand activations focused on immersive brand storytelling",
      "Technology integration across AR, VR, holographics, AI, projection mapping, and interactive installations",
      "Creative design through spatial design, narratives, and multi-sensory environments",
    ],
  },
  categories: [
    "All",
    "Museum & Exhibit",
    "Experiential Zone",
    "Corporate Event",
    "Brand Activation",
    "Tech & Innovation",
  ],
  examples: [
    "Interactive AR museum for cultural heritage",
    "Holographic stage for a product launch",
    "Gamified experiential zone for a mall",
  ],
  loadingPhases: [
    "Checking feasibility...",
    "Analysing technology stack...",
    "Generating creative ideas...",
    "Evaluating challenges...",
    "Finalising your report...",
  ],
  scoreBars: [
    { key: "feasibility_score", label: "Feasibility Score", color: "#00d4aa" },
    { key: "tech_score", label: "Technology Readiness", color: "#a259ff" },
    { key: "creative_score", label: "Creative Potential", color: "#ff6b2b" },
    { key: "impact_score", label: "Audience Impact", color: "#00b8ff" },
  ],
  badgeClass: {
    HIGH: "feasibility-badge--high",
    MEDIUM: "feasibility-badge--medium",
    LOW: "feasibility-badge--low",
  },
  maxHistory: 6,
});
