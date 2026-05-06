const RAW_PROJECTS = [
  { name: "picoclaw_dashboard", description: null, language: "JavaScript" },
  { name: "cheeko_docs", description: null, language: "JavaScript" },
  { name: "bgremoval", description: null, language: "Python" },
  { name: "pwc-oil-sketch-photobooth", description: null, language: "JavaScript" },
  { name: "cheeko-rfid-v2", description: null, language: "C" },
  { name: "cheeko18_backend_experiment", description: null, language: "Python" },
  { name: "phonepe-packaging-photobooth", description: null, language: "JavaScript" },
  {
    name: "phonePe_Photobooth_2025",
    description: "Marathon themed AI Faceswap Photobooth in React and Runpod.",
    language: "JavaScript",
  },
  { name: "sling-shot-docker-v1", description: null, language: "SCSS" },
  { name: "microsite-toyota-2", description: null, language: "TypeScript" },
  { name: "toyota-microsite", description: null, language: "TypeScript" },
  { name: "microsite-toyota", description: null, language: null },
  { name: "techsparks_infobooth", description: null, language: "TypeScript" },
  { name: "Techsparks-AI-Prompt-Challenge-Dashboard", description: null, language: "TypeScript" },
  { name: "flipbook-Mahkumbh", description: null, language: "JavaScript" },
  { name: "Dell-Techforum-Updated-Agenda", description: null, language: "TypeScript" },
  { name: "Accenture-AI-Photobooth", description: null, language: "Dart" },
  { name: "infosys-photobooth", description: null, language: null },
  { name: "dell-dtforum-aiphotobooth", description: null, language: "Dart" },
  { name: "Cheeko-Landing-Page", description: null, language: "TypeScript" },
  { name: "cheeko-server-4", description: null, language: "Python" },
  { name: "Cheeko-Admin-Dashboard", description: null, language: "TypeScript" },
  { name: "Cheeko-Web-App", description: null, language: "TypeScript" },
  { name: "Thought-Bubble-Camera-App", description: null, language: "Python" },
  { name: "photobooth-api", description: null, language: "Python" },
  { name: "Common_Photobooth_Flutter", description: null, language: "Dart" },
  { name: "opus_reord_decode_python-_cient_server", description: null, language: "Python" },
  { name: "SOEM-Interface", description: null, language: "C" },
  { name: "sample-deployment", description: null, language: "Python" },
  { name: "EventBooth-Server", description: null, language: "JavaScript" },
  { name: "EventBooth-Client", description: null, language: "JavaScript" },
  { name: "cft_avm_firmware", description: null, language: "C" },
  { name: "Air-India-Flutter", description: null, language: "Dart" },
  { name: "cheeko-toy-config", description: null, language: "TypeScript" },
  { name: "Heineken_Photobooth_UI", description: null, language: "JavaScript" },
  { name: "Event_Booth_End_App", description: null, language: "JavaScript" },
  { name: "events360_tickets_server", description: null, language: "JavaScript" },
  { name: "events360_admin_panel", description: null, language: "Dart" },
  { name: "emersonni_2025_digital_library", description: null, language: "JavaScript" },
  { name: "json-update", description: null, language: "EJS" },
  { name: "ai-toy-server", description: null, language: "Python" },
  { name: "prompt-ai-photobooth", description: null, language: "HTML" },
  { name: "Comfy-model-downloader", description: null, language: "Python" },
  { name: "events360_app", description: null, language: "Dart" },
  {
    name: "wordcloud_output_ledscreen",
    description:
      "This is a React project created for displaying the real time output of word cloud event in LED Screen",
    language: "JavaScript",
  },
  { name: "cft_inventory_app", description: null, language: "Dart" },
  { name: "comfyScripts", description: null, language: "Shell" },
  { name: "Aspha_AI_bot_Frontend", description: null, language: "JavaScript" },
  { name: "scanny-new", description: null, language: "EJS" },
  { name: "ai-videobooth-backend", description: null, language: "Python" },
  { name: "downloadModels", description: null, language: "Shell" },
  { name: "comfyui-s3", description: null, language: "Python" },
  { name: "rembg_backgroundRemoval", description: null, language: "Python" },
  { name: "touch-kiosk", description: null, language: "JavaScript" },
  { name: "video-recording-app", description: null, language: "TypeScript" },
  { name: "nebula", description: null, language: "JavaScript" },
  { name: "AI_Bot_Frontend", description: null, language: "JavaScript" },
  { name: "image-app", description: null, language: "EJS" },
  { name: "AI-Bot-Server", description: null, language: "Python" },
  { name: "aiart_pinokio", description: null, language: "JavaScript" },
  { name: "rplidar", description: null, language: null },
  { name: "newAi7", description: null, language: "Python" },
  { name: "dump", description: null, language: null },
  { name: "photobooth-api-swap", description: null, language: "Python" },
  { name: "fastlane", description: null, language: null },
  { name: "AVM-firmware", description: null, language: "C" },
  { name: "newFF", description: null, language: "JavaScript" },
  { name: "asset-management-tab", description: null, language: "HTML" },
  { name: "saas-ai-photobooth-front-end", description: null, language: "JavaScript" },
  { name: "sampleqr", description: null, language: "JavaScript" },
  { name: "boilerplate-nodejs", description: null, language: "CSS" },
  { name: "cft-hq", description: null, language: "JavaScript" },
  { name: "react-boilerplate", description: null, language: "JavaScript" },
  { name: "node-b", description: null, language: "JavaScript" },
  { name: "images-for-ai-awardee", description: null, language: null },
  { name: "cycleVM", description: null, language: "EJS" },
  { name: "gartener-touchwall", description: null, language: "JavaScript" },
  { name: "qr-vijayawada", description: null, language: "EJS" },
  { name: "qrautogourment", description: null, language: "JavaScript" },
  { name: "qr-form", description: null, language: null },
  { name: "microsite", description: null, language: "HTML" },
  { name: "workingscanny", description: null, language: null },
  { name: "zoho_ui", description: null, language: "EJS" },
  { name: "Face-detection", description: null, language: "JavaScript" },
  { name: "scanny", description: null, language: "EJS" },
];

function toWords(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseWord(word) {
  if (!word) return "";
  if (word.toUpperCase() === word && word.length <= 5) return word;
  if (/^\d+$/.test(word)) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function prettifyName(name) {
  return toWords(name)
    .split(" ")
    .map(titleCaseWord)
    .join(" ");
}

function inferTags(project) {
  const haystack = `${project.name} ${project.description || ""}`.toLowerCase();
  const tags = [];

  const rules = [
    ["photobooth", "photobooth"],
    ["booth", "event booth"],
    ["microsite", "microsite"],
    ["dashboard", "dashboard"],
    ["admin", "admin"],
    ["inventory", "inventory"],
    ["rfid", "rfid"],
    ["face", "face detection"],
    ["bgremoval", "background removal"],
    ["background", "background removal"],
    ["wordcloud", "word cloud"],
    ["led", "led screen"],
    ["kiosk", "touch kiosk"],
    ["camera", "camera"],
    ["video", "video"],
    ["toy", "connected toy"],
    ["ai", "ai"],
    ["docs", "documentation"],
    ["server", "backend"],
    ["backend", "backend"],
    ["app", "app"],
    ["flutter", "flutter"],
    ["firmware", "firmware"],
    ["website", "website"],
    ["landing", "landing page"],
    ["touchwall", "interactive wall"],
    ["flipbook", "flipbook"],
    ["qr", "qr"],
    ["agenda", "agenda"],
    ["library", "digital library"],
  ];

  rules.forEach(([needle, tag]) => {
    if (haystack.includes(needle) && !tags.includes(tag)) {
      tags.push(tag);
    }
  });

  if (project.language && !tags.includes(project.language.toLowerCase())) {
    tags.push(project.language.toLowerCase());
  }

  return tags;
}

function inferSummary(project) {
  if (project.description) {
    return project.description;
  }

  const title = prettifyName(project.name);
  const tags = inferTags(project);

  if (tags.includes("photobooth")) {
    return `${title} appears to be a photobooth-focused project for branded experiences, activations, or interactive event engagement.`;
  }

  if (tags.includes("microsite")) {
    return `${title} appears to be a campaign microsite or landing experience for a brand, product, or event.`;
  }

  if (tags.includes("dashboard") || tags.includes("admin")) {
    return `${title} appears to be a dashboard-style project for monitoring, control, reporting, or internal operations.`;
  }

  if (tags.includes("inventory")) {
    return `${title} appears to be an inventory or asset-management oriented project for tracking operational resources.`;
  }

  if (tags.includes("rfid")) {
    return `${title} appears to be an RFID-related project for identification, interaction, or hardware-linked workflows.`;
  }

  if (tags.includes("touch kiosk") || tags.includes("interactive wall")) {
    return `${title} appears to be an interactive installation project for touch-based engagement in a kiosk or wall format.`;
  }

  if (tags.includes("word cloud") || tags.includes("led screen")) {
    return `${title} appears to be a real-time visual display project for live audience participation or large-screen output.`;
  }

  if (tags.includes("background removal") || tags.includes("face detection")) {
    return `${title} appears to be a computer-vision utility for image processing, detection, or visual transformation.`;
  }

  if (tags.includes("backend")) {
    return `${title} appears to be a backend or service layer project supporting an app, booth, or AI workflow.`;
  }

  if (tags.includes("app") || tags.includes("flutter")) {
    return `${title} appears to be an application project for interactive user experiences or operational workflows.`;
  }

  if (tags.includes("firmware")) {
    return `${title} appears to be a firmware or embedded systems project tied to hardware behavior and device control.`;
  }

  if (tags.includes("documentation")) {
    return `${title} appears to be a documentation-focused project used to explain, support, or onboard users into a product.`;
  }

  return `${title} appears to be a company project that could provide naming, workflow, or delivery inspiration for a similar idea.`;
}

function tokenize(value) {
  return toWords(value)
    .toLowerCase()
    .split(" ")
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter((token) => token.length >= 2);
}

function scoreProject(queryTokens, project) {
  const titleTokens = tokenize(project.title);
  const summaryTokens = tokenize(project.summary);
  const tagTokens = project.tags.flatMap(tokenize);

  let score = 0;

  queryTokens.forEach((token) => {
    if (titleTokens.includes(token)) score += 5;
    if (summaryTokens.includes(token)) score += 3;
    if (tagTokens.includes(token)) score += 4;
    if (project.title.toLowerCase().includes(token)) score += 2;
  });

  if (queryTokens.length && project.title.toLowerCase().includes(queryTokens.join(" "))) {
    score += 8;
  }

  return score;
}

export const PROJECT_LIBRARY = RAW_PROJECTS.map((project) => {
  const title = prettifyName(project.name);
  const tags = inferTags(project);
  const summary = inferSummary(project);

  return {
    slug: project.name,
    title,
    summary,
    description: project.description,
    language: project.language,
    tags,
    source: project.description ? "github-description" : "inferred-from-title",
  };
});

export function matchProjects(query, limit = 6) {
  const queryTokens = tokenize(query);

  if (!queryTokens.length) {
    return PROJECT_LIBRARY.slice(0, limit);
  }

  return PROJECT_LIBRARY
    .map((project) => ({
      ...project,
      score: scoreProject(queryTokens, project),
    }))
    .filter((project) => project.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
}

export function buildProjectContext(query, limit = 6) {
  const matches = matchProjects(query, limit);
  if (!matches.length) {
    return "No closely related public company projects were matched from GitHub titles.";
  }

  return matches
    .map((project) => `- ${project.title}: ${project.summary}`)
    .join("\n");
}
