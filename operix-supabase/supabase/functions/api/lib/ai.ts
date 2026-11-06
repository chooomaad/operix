/**
 * Operix AI — analyse d'une déclaration terrain.
 *
 * Gemini ou Claude peuvent être appelés avec une clé serveur. Sans clé —
 * ou en cas d'échec — moteur de règles déterministe. Le champ `engine`
 * (`ai` | `rules`) dit toujours lequel a répondu ; le mobile l'affiche.
 * La clé ne quitte jamais le serveur.
 *
 * Port fidèle de app/Services/Ai/* de operix-api.
 */

export const INCIDENT_TYPES = ["LTI", "MTC", "RWC", "FAC", "HPI", "Fire", "Security", "Autre"] as const;
export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export const PRIORITIES = ["immediate", "urgent", "shift", "prevention"] as const;

export type IncidentType = typeof INCIDENT_TYPES[number];
export type RiskLevel = typeof RISK_LEVELS[number];
export type Priority = typeof PRIORITIES[number];

export interface ProposedAction {
  priority: Priority;
  delay_minutes: number;
  responsible_role: string;
  description: string;
}

export interface Analysis {
  category: string;
  subcategory: string;
  risk_level: RiskLevel;
  incident_type: IncidentType;
  confidence: number;
  summary: string;
  risks: string[];
  causes: string[];
  aggravating_factor: string | null;
  legal_reference: string | null;
  actions: ProposedAction[];
}

const TYPE_ALIASES: Record<string, IncidentType> = {
  FIRST_AID: "FAC",
  FIRSTAID: "FAC",
  FA: "FAC",
  FIRE: "Fire",
  SECURITY: "Security",
  AUTRE: "Autre",
  OTHER: "Autre",
  MTI: "MTC",
};

export function normalizeType(value: unknown): IncidentType {
  const v = typeof value === "string" ? value.trim() : "";
  if ((INCIDENT_TYPES as readonly string[]).includes(v)) return v as IncidentType;
  return TYPE_ALIASES[v.toUpperCase()] ?? "Autre";
}

/** JSON Schema transmis au modèle (structured outputs). */
export function jsonSchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      category: { type: "string", description: "Catégorie HSSE courte, ex. « Glissade & Chute »" },
      subcategory: { type: "string" },
      risk_level: { type: "string", enum: [...RISK_LEVELS] },
      incident_type: { type: "string", enum: [...INCIDENT_TYPES] },
      confidence: { type: "integer", description: "Certitude 0-100 sur les causes" },
      summary: { type: "string" },
      risks: { type: "array", items: { type: "string" } },
      causes: { type: "array", items: { type: "string" } },
      aggravating_factor: { type: ["string", "null"] },
      legal_reference: { type: ["string", "null"] },
      actions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            priority: { type: "string", enum: [...PRIORITIES] },
            delay_minutes: { type: "integer" },
            responsible_role: { type: "string" },
            description: { type: "string" },
          },
          required: ["priority", "delay_minutes", "responsible_role", "description"],
          additionalProperties: false,
        },
      },
    },
    required: [
      "category", "subcategory", "risk_level", "incident_type", "confidence", "summary",
      "risks", "causes", "aggravating_factor", "legal_reference", "actions",
    ],
    additionalProperties: false,
  };
}

const str = (v: unknown): string => (typeof v === "string" ? [...v].slice(0, 500).join("").trim() : "");
const list = (v: unknown, n: number): string[] =>
  (Array.isArray(v) ? v.slice(0, n) : []).map(str).filter((s) => s !== "");

/** Borne et nettoie une analyse quelle que soit sa provenance (IA, règles, mobile). */
export function normalize(a: Record<string, unknown>): Analysis {
  const actions: ProposedAction[] = [];
  for (const act of (Array.isArray(a.actions) ? a.actions : []).slice(0, 6)) {
    if (!act || typeof act !== "object") continue;
    const o = act as Record<string, unknown>;
    if (str(o.description) === "") continue;
    const delay = Number(o.delay_minutes ?? 60);
    actions.push({
      priority: (PRIORITIES as readonly unknown[]).includes(o.priority) ? (o.priority as Priority) : "urgent",
      delay_minutes: Math.max(0, Math.min(60 * 24 * 30, Number.isFinite(delay) ? Math.trunc(delay) : 60)),
      responsible_role: str(o.responsible_role) || "Superviseur HSSE",
      description: str(o.description),
    });
  }
  const confidence = Math.trunc(Number(a.confidence ?? 0));
  return {
    category: str(a.category) || "Événement HSSE",
    subcategory: str(a.subcategory),
    risk_level: (RISK_LEVELS as readonly unknown[]).includes(a.risk_level) ? (a.risk_level as RiskLevel) : "medium",
    incident_type: normalizeType(a.incident_type),
    confidence: Math.max(0, Math.min(100, Number.isFinite(confidence) ? confidence : 0)),
    summary: str(a.summary),
    risks: list(a.risks, 5),
    causes: list(a.causes, 5),
    aggravating_factor: str(a.aggravating_factor) || null,
    legal_reference: str(a.legal_reference) || null,
    actions,
  };
}

// ── Moteur de règles (repli) ────────────────────────────────────────────────

type RuleData = Omit<Analysis, "summary" | "legal_reference" | "confidence">;

const RULES: { keys: string[]; data: RuleData }[] = [
  {
    keys: ["huile", "fuite", "glissa", "glissant", "hydraul", "chute de plain"],
    data: {
      category: "Glissade & Chute", subcategory: "Contamination du sol par un fluide",
      risk_level: "high", incident_type: "HPI",
      risks: ["Risque de chute de plain-pied pour le personnel", "Surface glissante sur un axe de circulation", "Zone non balisée"],
      causes: ["Fuite de fluide non contenue", "Nettoyage non réalisé immédiatement", "Absence de kit absorbant à proximité"],
      aggravating_factor: "Passage d'engins et de piétons sur la zone",
      actions: [
        { priority: "immediate", delay_minutes: 15, responsible_role: "Chef de quart", description: "Sécuriser et baliser la zone contaminée" },
        { priority: "urgent", delay_minutes: 30, responsible_role: "Équipe d'entretien", description: "Épandre un absorbant industriel et dégraisser la zone" },
        { priority: "shift", delay_minutes: 120, responsible_role: "Maintenance", description: "Identifier et réparer la source de la fuite" },
        { priority: "prevention", delay_minutes: 1440, responsible_role: "Superviseur HSSE", description: "Briefing sécurité de 5 minutes à la prochaine relève" },
      ],
    },
  },
  {
    keys: ["grue", "levage", "élingue", "elingue", "câble", "cable", "charge suspendue", "portique"],
    data: {
      category: "Levage & Manutention", subcategory: "Défaillance d'accessoire de levage",
      risk_level: "high", incident_type: "HPI",
      risks: ["Chute de charge suspendue", "Écrasement du personnel au sol", "Endommagement des équipements"],
      causes: ["Usure ou défaut de l'accessoire de levage", "Inspection pré-utilisation incomplète", "Zone d'évolution de la charge non interdite"],
      aggravating_factor: null,
      actions: [
        { priority: "immediate", delay_minutes: 10, responsible_role: "Grutier / Chef de quart", description: "Arrêter l'opération de levage et dégager la zone sous charge" },
        { priority: "urgent", delay_minutes: 60, responsible_role: "Maintenance", description: "Consigner et inspecter l'accessoire de levage" },
        { priority: "shift", delay_minutes: 240, responsible_role: "Maintenance", description: "Remplacer l'accessoire défectueux et tracer l'intervention" },
        { priority: "prevention", delay_minutes: 2880, responsible_role: "Superviseur HSSE", description: "Rappeler la check-list pré-levage aux équipes" },
      ],
    },
  },
  {
    keys: ["feu", "incendie", "fumée", "fumee", "flamme", "étincelle"],
    data: {
      category: "Incendie", subcategory: "Départ de feu",
      risk_level: "critical", incident_type: "Fire",
      risks: ["Propagation du feu", "Intoxication par les fumées", "Explosion en zone ATEX"],
      causes: ["Source d'ignition à proximité de combustibles", "Stockage non conforme", "Permis de feu absent ou non respecté"],
      aggravating_factor: null,
      actions: [
        { priority: "immediate", delay_minutes: 5, responsible_role: "Équipe d'intervention", description: "Déclencher l'alarme et évacuer la zone" },
        { priority: "urgent", delay_minutes: 30, responsible_role: "Superviseur HSSE", description: "Contrôler l'extinction complète et sécuriser le périmètre" },
        { priority: "shift", delay_minutes: 240, responsible_role: "Responsable HSSE", description: "Analyser la source d'ignition et les permis en cours" },
        { priority: "prevention", delay_minutes: 4320, responsible_role: "Responsable HSSE", description: "Vérifier les moyens d'extinction et le stockage de la zone" },
      ],
    },
  },
  {
    keys: ["epi", "casque", "gilet", "harnais", "sans protection", "violation", "non-respect", "non respect"],
    data: {
      category: "Non-respect des règles", subcategory: "Équipement de protection individuelle",
      risk_level: "medium", incident_type: "Autre",
      risks: ["Exposition du personnel sans protection", "Banalisation des écarts"],
      causes: ["EPI indisponible ou inadapté", "Sensibilisation insuffisante", "Supervision terrain limitée"],
      aggravating_factor: null,
      actions: [
        { priority: "immediate", delay_minutes: 15, responsible_role: "Chef d'équipe", description: "Faire cesser l'exposition et fournir l'EPI requis" },
        { priority: "shift", delay_minutes: 240, responsible_role: "Superviseur HSSE", description: "Entretien de recadrage avec les personnes concernées" },
        { priority: "prevention", delay_minutes: 2880, responsible_role: "Responsable HSSE", description: "Vérifier la disponibilité des EPI au poste" },
      ],
    },
  },
];

const FALLBACK: RuleData = {
  category: "Événement HSSE", subcategory: "À qualifier par le superviseur",
  risk_level: "medium", incident_type: "Autre",
  risks: ["Risque à évaluer sur place"],
  causes: ["Causes à déterminer lors de l'investigation"],
  aggravating_factor: null,
  actions: [
    { priority: "immediate", delay_minutes: 30, responsible_role: "Chef de quart", description: "Sécuriser la zone et prévenir le superviseur" },
    { priority: "shift", delay_minutes: 240, responsible_role: "Superviseur HSSE", description: "Qualifier l'événement et compléter l'analyse des causes" },
  ],
};

export function analyzeWithRules(description: string, location: string | null): Analysis {
  const text = `${description} ${location ?? ""}`.toLowerCase();
  let best: RuleData | null = null;
  let bestScore = 0;
  for (const rule of RULES) {
    const score = rule.keys.filter((k) => text.includes(k)).length;
    if (score > bestScore) {
      best = rule.data;
      bestScore = score;
    }
  }
  return normalize({
    ...(best ?? FALLBACK),
    summary: "Analyse par règles métier (aucun moteur IA configuré).",
    legal_reference: "ISO 45001 §8.1.2 — maîtrise des dangers",
    // Plafonnée bas : un moteur de mots-clés ne doit jamais afficher 94 %.
    confidence: best ? Math.min(70, 40 + 10 * bestScore) : 20,
  } as unknown as Record<string, unknown>);
}

// ── Instructions communes aux fournisseurs ──────────────────────────────────

const SYSTEM = `Tu es le moteur d'analyse sécurité (HSSE) d'OPERIX, utilisé sur des sites industriels
à risques (ports, terminaux, mines, chantiers, énergie). À partir d'une déclaration terrain
(description, lieu, type d'événement, éventuellement une photo), produis :
- une catégorie et sous-catégorie courtes, en français ;
- un niveau de risque (low, medium, high, critical) proportionné aux faits décrits ;
- le type d'incident le plus proche parmi la liste imposée (HPI = presqu'accident à haut potentiel,
  FAC = premiers soins, MTC = soins médicaux, RWC = travail restreint, LTI = arrêt de travail ;
  en cas de doute, Autre) ;
- 2 à 4 risques concrets, 2 à 4 causes probables, un facteur aggravant éventuel ;
- une référence normative pertinente si elle est évidente (ISO 45001, code du travail), sinon null ;
- 3 à 5 actions ordonnées, chacune avec une priorité (immediate, urgent, shift, prevention),
  un délai en minutes, un rôle responsable (pas de nom de personne) et une description impérative.
Reste factuel : n'invente ni victime ni blessure non mentionnée. Si la photo contredit la
description, signale-le dans summary. confidence (0-100) mesure ta certitude sur les causes ;
baisse-la quand la déclaration est vague.`;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function analyzeWithClaude(
  apiKey: string,
  model: string,
  input: { description: string; location: string | null; eventType: string | null; image?: File },
): Promise<Analysis> {
  const content: Record<string, unknown>[] = [];
  if (input.image && [...IMAGE_TYPES, "image/gif"].includes(input.image.type)) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: input.image.type, data: toBase64(new Uint8Array(await input.image.arrayBuffer())) },
    });
  }
  content.push({
    type: "text",
    text: `Type déclaré : ${input.eventType || "incident"}\nLieu : ${input.location || "non précisé"}\nDescription terrain :\n${input.description}`,
  });

  const res = await fetch(`${Deno.env.get("ANTHROPIC_BASE_URL") ?? "https://api.anthropic.com"}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: "low", format: { type: "json_schema", schema: jsonSchema() } },
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const msg = (await res.json()) as { stop_reason?: string; content?: { type: string; text?: string }[] };
  if (msg.stop_reason === "refusal") throw new Error("Analyse refusée par le modèle");
  if (msg.stop_reason === "max_tokens") throw new Error("Réponse IA tronquée");
  const text = msg.content?.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Réponse IA vide");
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") throw new Error("Réponse IA illisible");
  return normalize(parsed as Record<string, unknown>);
}

const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    category: { type: "STRING" },
    subcategory: { type: "STRING" },
    risk_level: { type: "STRING", enum: [...RISK_LEVELS] },
    incident_type: { type: "STRING", enum: [...INCIDENT_TYPES] },
    confidence: { type: "INTEGER" },
    summary: { type: "STRING" },
    risks: { type: "ARRAY", items: { type: "STRING" } },
    causes: { type: "ARRAY", items: { type: "STRING" } },
    aggravating_factor: { type: "STRING", nullable: true },
    legal_reference: { type: "STRING", nullable: true },
    actions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          priority: { type: "STRING", enum: [...PRIORITIES] },
          delay_minutes: { type: "INTEGER" },
          responsible_role: { type: "STRING" },
          description: { type: "STRING" },
        },
        required: ["priority", "delay_minutes", "responsible_role", "description"],
      },
    },
  },
  required: [
    "category", "subcategory", "risk_level", "incident_type", "confidence", "summary",
    "risks", "causes", "aggravating_factor", "legal_reference", "actions",
  ],
};

export async function analyzeWithGemini(
  apiKey: string,
  model: string,
  input: { description: string; location: string | null; eventType: string | null; image?: File },
): Promise<Analysis> {
  const parts: Record<string, unknown>[] = [];
  if (input.image && IMAGE_TYPES.includes(input.image.type)) {
    parts.push({
      inlineData: {
        mimeType: input.image.type,
        data: toBase64(new Uint8Array(await input.image.arrayBuffer())),
      },
    });
  }
  parts.push({
    text: `Type déclaré : ${input.eventType || "incident"}\nLieu : ${input.location || "non précisé"}\nDescription terrain :\n${input.description}`,
  });

  const baseUrl = (Deno.env.get("GEMINI_BASE_URL") || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
  const res = await fetch(`${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: GEMINI_SCHEMA,
        maxOutputTokens: 2000,
        temperature: 0.2,
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const response = await res.json() as {
    candidates?: {
      finishReason?: string;
      content?: { parts?: { text?: string }[] };
    }[];
    promptFeedback?: { blockReason?: string };
  };
  const candidate = response.candidates?.[0];
  if (response.promptFeedback?.blockReason) throw new Error(`Gemini blocked prompt: ${response.promptFeedback.blockReason}`);
  if (candidate?.finishReason === "MAX_TOKENS") throw new Error("Réponse Gemini tronquée");
  const text = candidate?.content?.parts?.find((part) => typeof part.text === "string")?.text;
  if (!text) throw new Error("Réponse Gemini vide");
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Réponse Gemini illisible");
  return normalize(parsed as Record<string, unknown>);
}

/** Point d'entrée : Gemini ou Claude si configuré, sinon moteur de règles. */
export async function analyze(input: { description: string; location: string | null; eventType: string | null; image?: File }) {
  const started = performance.now();
  const geminiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  const configuredProvider = Deno.env.get("OPERIX_AI_PROVIDER")?.trim().toLowerCase();
  const provider = configuredProvider || (geminiKey ? "gemini" : anthropicKey ? "anthropic" : "rules");
  const model = provider === "gemini"
    ? Deno.env.get("OPERIX_GEMINI_MODEL") || "gemini-3.5-flash-lite"
    : Deno.env.get("OPERIX_AI_MODEL") || "claude-opus-5-5";

  let engine: "ai" | "rules" = "rules";
  let fallback_reason: "not_configured" | "provider_unavailable" | "rules_selected" | null = null;
  let result: Analysis | null = null;
  if (provider === "gemini" || provider === "anthropic") {
    try {
      if (provider === "gemini" && geminiKey) result = await analyzeWithGemini(geminiKey, model, input);
      else if (provider === "anthropic" && anthropicKey) result = await analyzeWithClaude(anthropicKey, model, input);
      else throw new Error(`La clé API du fournisseur ${provider} n'est pas configurée`);
      engine = "ai";
    } catch (e) {
      fallback_reason = provider === "gemini" && !geminiKey || provider === "anthropic" && !anthropicKey
        ? "not_configured"
        : "provider_unavailable";
      console.warn(`Operix AI (${provider}) : repli sur le moteur de règles —`, e instanceof Error ? e.message : e);
    }
  } else if (provider !== "rules") {
    fallback_reason = "provider_unavailable";
    console.warn(`Operix AI : fournisseur non reconnu "${provider}", repli sur le moteur de règles`);
  } else {
    fallback_reason = configuredProvider === "rules" ? "rules_selected" : "not_configured";
  }
  result ??= analyzeWithRules(input.description, input.location);

  return {
    ...result,
    engine,
    model: engine === "ai" ? `${provider}:${model}` : null,
    fallback_reason: engine === "ai" ? null : fallback_reason,
    duration_ms: Math.round(performance.now() - started),
    analyzed_at: new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00"),
  };
}
