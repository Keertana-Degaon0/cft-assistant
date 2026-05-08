import { matchProjects } from "../../shared/projectLibrary";

const CATEGORY_KEYWORDS = [
  {
    category: "Museum & Exhibit",
    keywords: ["museum", "exhibit", "heritage", "gallery", "culture", "history", "installation"],
  },
  {
    category: "Experiential Zone",
    keywords: ["mall", "zone", "walkthrough", "interactive", "kiosk", "touch", "experience"],
  },
  {
    category: "Corporate Event",
    keywords: ["conference", "summit", "corporate", "attendees", "stage", "event", "launch"],
  },
  {
    category: "Brand Activation",
    keywords: ["brand", "activation", "campaign", "retail", "consumer", "engagement", "booth"],
  },
  {
    category: "Tech & Innovation",
    keywords: ["ai", "ar", "vr", "hologram", "projection", "innovation", "tech", "rfid"],
  },
];

function toTitleCase(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function detectCategory(query, selectedCategory) {
  if (selectedCategory && selectedCategory !== "All") {
    return selectedCategory;
  }

  const lowerQuery = String(query || "").toLowerCase();

  for (const item of CATEGORY_KEYWORDS) {
    if (item.keywords.some((keyword) => lowerQuery.includes(keyword))) {
      return item.category;
    }
  }

  return "Tech & Innovation";
}

function computeScores(query, category, relatedProjects) {
  const lowerQuery = String(query || "").toLowerCase();
  let feasibility = 72;
  let tech = 74;
  let creative = 78;
  let impact = 76;

  if (relatedProjects.length >= 3) {
    feasibility += 8;
    tech += 5;
  } else if (relatedProjects.length === 0) {
    feasibility -= 6;
  }

  if (/\b(ar|vr|ai|rfid|projection|hologram|interactive)\b/.test(lowerQuery)) {
    creative += 8;
    impact += 6;
  }

  if (/\b(5000|large|nationwide|multi city|multi-city|live)\b/.test(lowerQuery)) {
    feasibility -= 4;
    impact += 7;
  }

  if (/\b(budget|cheap|low cost|quick|tomorrow|urgent)\b/.test(lowerQuery)) {
    feasibility -= 5;
    tech -= 4;
  }

  if (category === "Museum & Exhibit") {
    creative += 5;
  }

  if (category === "Corporate Event") {
    feasibility += 4;
  }

  feasibility = Math.max(45, Math.min(95, feasibility));
  tech = Math.max(45, Math.min(95, tech));
  creative = Math.max(50, Math.min(98, creative));
  impact = Math.max(50, Math.min(96, impact));

  return { feasibility, tech, creative, impact };
}

function buildBadge(score) {
  if (score >= 80) {
    return "HIGH";
  }
  if (score >= 62) {
    return "MEDIUM";
  }
  return "LOW";
}

export function buildLocalAnalysis({ query, category }) {
  const resolvedCategory = detectCategory(query, category);
  const relatedProjects = matchProjects(query, 3);
  const scores = computeScores(query, resolvedCategory, relatedProjects);
  const badge = buildBadge(scores.feasibility);
  const title = toTitleCase(query) || "Feasibility Preview";
  const exampleProjects = relatedProjects.map((project) => project.title).join(", ");
  const precedentLine = exampleProjects
    ? `Relevant company precedents include ${exampleProjects}, which suggests this direction fits Craftech 360's working style.`
    : "This idea still aligns with the kind of immersive, technology-led experiences Craftech 360 typically delivers.";

  return {
    heading: title,
    category: resolvedCategory,
    feasibility_score: scores.feasibility,
    tech_score: scores.tech,
    creative_score: scores.creative,
    impact_score: scores.impact,
    badge,
    feasibility: [
      `This idea appears ${badge === "HIGH" ? "strongly" : badge === "MEDIUM" ? "reasonably" : "selectively"} feasible for Craftech 360 when approached as a scoped experiential build. The concept fits the company's profile across immersive environments, audience engagement, and technology-backed storytelling.`,
      `${precedentLine} The main feasibility drivers are production complexity, venue readiness, hardware reliability, and how clearly the audience journey is defined from entry to interaction to exit.`,
      "The strongest path is to start with a lean pilot version that proves the hero interaction first, then expand into richer layers such as content personalization, analytics, or multi-sensory enhancements once the base flow is stable.",
    ].join("\n\n"),
    how_it_works: [
      `The delivery approach would begin with concept definition, interaction mapping, and experience zoning for the ${resolvedCategory.toLowerCase()} format. That stage should lock the user journey, screen flow, hardware needs, and operator requirements.`,
      "From there, the team can move into visual design, software prototyping, and hardware integration. Depending on the idea, that may include touchscreens, AR/VR layers, AI modules, display systems, RFID, projection, or camera-based interactions.",
      "Before launch, the experience should go through a rehearsal phase with content calibration, fail-safe planning, and on-ground operational checks so the live interaction remains smooth even under crowd pressure.",
    ].join("\n\n"),
    challenges: [
      "Hardware and venue constraints may affect placement, power, lighting, and network stability.",
      "Audience flow needs careful planning so the interaction remains intuitive and does not create congestion.",
      "Content, software, and production timelines must stay aligned to avoid last-minute integration risk.",
    ].join("\n"),
    ideas: [
      "Add a measurable hero moment such as scan-to-personalize, photo capture, or live audience reveal.",
      "Design a fallback mode so the experience still runs cleanly if internet or one hardware layer drops.",
      "Extend the concept with post-event content, lead capture, or shareable media to increase ROI beyond the venue.",
    ].join("\n"),
  };
}
