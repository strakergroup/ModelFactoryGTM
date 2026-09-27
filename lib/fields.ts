// Every section and field of the Custom Models Go-to-Market Fact Pack,
// taken from Sample-Model-Fact-Pack.docx. To add a field, add one line here.

export type Tag = "P" | "N" | "I";
export const TAG_LABEL: Record<Tag, string> = { P: "Public", N: "Under NDA", I: "Internal" };
export const TAG_MEANING: Record<Tag, string> = {
  P: "Website, one-pagers, Sage",
  N: "Security reviews, RFPs",
  I: "Never leaves arbitr",
};

export type TextField = { kind: "text"; key: string; label: string; help: string; tag: Tag };
export type TableField = {
  kind: "table";
  key: string;
  label: string;
  help: string;
  tag: Tag;
  columns: string[];
  presetRows?: string[]; // first column fixed, e.g. asset names
};
export type Field = TextField | TableField;
export type Section = { id: string; title: string; fields: Field[] };
// draft: questions written by us, not yet confirmed by the model team.
export type Part = { id: string; title: string; sections: Section[]; showFor?: string; draft?: boolean };

const t = (key: string, label: string, help: string, tag: Tag): TextField => ({ kind: "text", key, label, help, tag });

export const MODEL_TYPES = [
  { id: "custom_mt", label: "Custom Language Model" },
  { id: "quality_risk", label: "Quality / Risk Model" },
  { id: "llm", label: "LLM Model" },
  { id: "customer_trained", label: "Custom Customer Model" },
  { id: "other", label: "Other" }, // free text in Pack.otherType; no extra questions
] as const;

export const FACTORY_PARTS: Part[] = [
  {
    id: "A",
    title: "Part A — Factory fact sheet",
    sections: [
      {
        id: "A1",
        title: "A1. Team and capability",
        fields: [
          t("a1_team_name", "Team name", "Current name and the external-facing name once chosen", "P"),
          t("a1_one_line", "One-line description", "What the factory does, in under 25 words, no jargon", "P"),
          t("a1_produce", "What we produce", "Model types built (MT, quality/risk, LLM, customer-trained)", "P"),
          t("a1_track_record", "Track record", "Models shipped to production, years operating, volume processed per month", "P"),
          t("a1_coverage", "Coverage", "Languages, language pairs and content domains supported today", "N"),
          t("a1_expertise", "Expertise", "Team size and disciplines (research, ML engineering, linguists, eval)", "I"),
          t("a1_differentiator", "Differentiator", "The one thing we do that generic providers don't, with evidence", "P"),
        ],
      },
      {
        id: "A3",
        title: "A3. How we build models",
        fields: [
          t("a3_base_models", "Base models used", "Every foundation or open-source model we build on, version and licence", "N"),
          t("a3_training", "Training approach", "From scratch, full fine-tune, adapters/LoRA, distillation, retrieval-augmented", "N"),
          t("a3_data_sources", "Data sources", "Public corpora, licensed data, synthetic data, customer data — with proportions", "N"),
          t("a3_feedback", "Learning from feedback", "How human-in-the-loop edits and Cortex content feed retraining, and how often", "P"),
          t("a3_build_time", "Build time", "Typical weeks from request to production model", "P"),
          t("a3_min_data", "Minimum data", "Smallest customer dataset that produces a measurable gain", "P"),
          t("a3_compute", "Compute and cost", "Training and inference infrastructure, cost per model build", "I"),
        ],
      },
      {
        id: "A4",
        title: "A4. Evaluation methodology",
        fields: [
          t("a4_auto_metrics", "Automatic metrics", "Metrics per model type (e.g. COMET, chrF, BLEU for MT; precision, recall, F1, calibration for risk models)", "P"),
          t("a4_human_eval", "Human evaluation", "Protocol (e.g. MQM), who rates, sample size, inter-rater agreement", "P"),
          t("a4_test_sets", "Test sets", "How they're built, held out and protected from training contamination", "N"),
          t("a4_comparators", "Comparators", "Which third-party systems we benchmark against and how often", "N"),
          t("a4_release_gate", "Release gate", "The threshold a model must pass before GA", "N"),
          t("a4_reeval", "Re-evaluation", "Cadence and trigger for re-testing production models", "P"),
        ],
      },
      {
        id: "A5",
        title: "A5. Data governance and privacy",
        fields: [
          t("a5_customer_data", "Customer data in training", "Is customer data ever used to train shared models? Opt-in or opt-out?", "P"),
          t("a5_isolation", "Isolation", "How one customer's data and models are separated from another's", "P"),
          t("a5_retention", "Retention and deletion", "How long training data is kept; how a customer deletes data and models", "P"),
          t("a5_residency", "Data residency", "Where data is stored and processed; regional options", "P"),
          t("a5_pii", "Personal data", "How PII is detected, removed or masked before training", "N"),
          t("a5_provenance", "Provenance and licensing", "Proof we have the right to use each training source", "N"),
          t("a5_subprocessors", "Sub-processors", "Third parties that touch training or inference data", "N"),
        ],
      },
      {
        id: "A6",
        title: "A6. Security and hosting",
        fields: [
          t("a6_hosting", "Hosting", "Cloud provider, regions, single-tenant or dedicated options", "P"),
          t("a6_certs", "Certifications", "SOC 2 status and date, ISO, other attestations", "P"),
          t("a6_encryption", "Encryption", "At rest and in transit; key management", "N"),
          t("a6_access", "Access control", "Who can access models, weights and training data; audit logging", "N"),
          t("a6_ownership", "Model ownership", "Who owns customer-trained weights; export or portability rights", "P"),
          t("a6_sec_testing", "Security testing", "Penetration tests, adversarial and prompt-injection testing, last date", "N"),
        ],
      },
      {
        id: "A7",
        title: "A7. Compliance and responsible AI",
        fields: [
          t("a7_eu_ai_act", "EU AI Act", "Risk classification per model type; transparency obligations we meet", "P"),
          t("a7_gdpr", "GDPR", "Lawful basis for training data; DPA availability", "P"),
          t("a7_bias", "Bias and fairness", "What we test for (e.g. gender, formality, dialect) and results", "N"),
          t("a7_oversight", "Human oversight", "How models run under arbitr assurance levels and human review", "P"),
          t("a7_incidents", "Incident process", "How model failures are reported, triaged and disclosed to customers", "N"),
          t("a7_docs", "Documentation", "Which artefacts a customer can request (model card, eval report, DPIA input)", "P"),
        ],
      },
      {
        id: "A8",
        title: "A8. Operations and support",
        fields: [
          t("a8_availability", "Availability", "Uptime target or SLA for hosted models", "P"),
          t("a8_monitoring", "Monitoring", "How we detect quality drift and regressions in production", "N"),
          t("a8_versioning", "Versioning", "How versions are numbered, announced and rolled back", "P"),
          t("a8_deprecation", "Deprecation", "Notice period before a model version is retired", "P"),
          t("a8_support", "Support", "Channels, hours, response targets, escalation path", "P"),
        ],
      },
    ],
  },
];

export const MODEL_PARTS: Part[] = [
  {
    id: "B",
    title: "Model card",
    sections: [
      {
        id: "B1",
        title: "B1. Identity",
        fields: [
          t("b1_name_version", "Model name and version", "Internal ID and external product name", "P"),
          t("b1_status", "Status", "Research, Beta or GA, and GA date", "P"),
          t("b1_owner", "Owner", "Accountable person on the model team", "I"),
          t("b1_base_model", "Base model", "Foundation model, version and licence", "N"),
          t("b1_one_line", "One-line value", "What it does better, for whom, in under 20 words", "P"),
        ],
      },
      {
        id: "B2",
        title: "B2. Intended use",
        fields: [
          t("b2_use_cases", "Primary use cases", "The jobs this model is built for, most important first", "P"),
          t("b2_customers", "Target customers", "Industries, content types and teams it suits best", "P"),
          t("b2_out_of_scope", "Out of scope", "Uses we do not support or recommend (e.g. unreviewed legal or medical publishing)", "P"),
          t("b2_oversight", "Required oversight", "Minimum arbitr assurance level or human review we recommend", "P"),
        ],
      },
      {
        id: "B3",
        title: "B3. Training data",
        fields: [
          t("b3_sources", "Sources", "Datasets used, with size (segments, tokens or documents)", "N"),
          t("b3_domains", "Domains and languages", "What the data covers and where it is thin", "P"),
          t("b3_dates", "Date range", "Oldest and newest data; knowledge cutoff for LLMs", "P"),
          t("b3_cleaning", "Cleaning and filtering", "Deduplication, PII removal, quality filters applied", "N"),
          t("b3_customer_data", "Customer data", "Whether any customer data was used, and under what consent", "N"),
        ],
      },
      {
        id: "B4",
        title: "B4. Performance",
        fields: [
          {
            kind: "table",
            key: "b4_metrics",
            label: "Results",
            help: "One row per metric. Every number needs a named test set and a date.",
            tag: "N",
            columns: ["Metric", "Test set (name, size, domain)", "This model", "Previous version", "Generic baseline", "Comparator (name + score)", "Date measured"],
          },
          t("b4_headline", "Headline result", "The single number Sales should lead with, in one sentence", "P"),
        ],
      },
      {
        id: "B5",
        title: "B5. Limitations and failure modes",
        fields: [
          t("b5_weaknesses", "Known weaknesses", "Languages, domains, formats or lengths where quality drops", "N"),
          t("b5_errors", "Typical errors", "The most common error types, with an example each", "N"),
          t("b5_bias", "Bias findings", "Results of fairness tests and what we did about them", "N"),
          t("b5_safety", "Safety risks", "Hallucination, omission, toxicity or prompt-injection exposure", "N"),
          t("b5_mitigations", "Mitigations", "Guardrails, fallbacks and review steps that contain these risks", "P"),
        ],
      },
      {
        id: "B6",
        title: "B6. Runtime characteristics",
        fields: [
          t("b6_latency", "Latency", "Median and 95th-percentile per request or per 1,000 words", "P"),
          t("b6_throughput", "Throughput", "Sustained volume per hour", "N"),
          t("b6_limits", "Context or input limits", "Max segment, document or token length", "P"),
          t("b6_formats", "Supported formats", "File and content formats it handles directly", "P"),
          t("b6_unit_cost", "Unit cost", "Inference cost per 1,000 words or tokens", "I"),
        ],
      },
      {
        id: "B7",
        title: "B7. How it runs in arbitr",
        fields: [
          t("b7_where", "Where it appears", "Workflow steps and features that call this model", "P"),
          t("b7_cortex", "Cortex use", "Whether it reads from or writes to Cortex, and how", "P"),
          t("b7_assurance", "Assurance levels", "Which assurance levels it is approved for", "P"),
          t("b7_routing", "Routing", "When arbitr chooses this model over alternatives", "N"),
          t("b7_api", "API and integrations", "Availability via API, MCP or connectors", "P"),
        ],
      },
      {
        id: "B8",
        title: "B8. Version history",
        fields: [
          {
            kind: "table",
            key: "b8_versions",
            label: "Versions",
            help: "One row per released version.",
            tag: "P",
            columns: ["Version", "Date", "What changed"],
          },
        ],
      },
    ],
  },
  {
    id: "C1",
    title: "Type section — Custom Language Model",
    showFor: "custom_mt",
    sections: [
      {
        id: "C1",
        title: "C1. Custom Language Model",
        fields: [
          t("c1_pairs", "Language pairs", "Every supported direction, with GA or Beta status per pair", "P"),
          t("c1_locales", "Locale variants", "Regional variants and formality control (e.g. pt-BR vs pt-PT, tu/vous)", "P"),
          t("c1_domains", "Domains", "Content domains tuned for (legal, life sciences, marketing, UI)", "P"),
          t("c1_terminology", "Terminology", "How glossaries and do-not-translate lists are enforced; enforcement rate", "P"),
          t("c1_tm", "Translation memory", "How TM and Cortex content bias output; leverage uplift", "P"),
          t("c1_tags", "Tags and formatting", "Handling of XLIFF tags, placeholders, markup, numbers and dates; tag error rate", "N"),
          t("c1_quality_by_pair", "Quality by pair", "COMET or MQM score per top-10 pair vs a generic engine", "N"),
          t("c1_post_edit", "Post-edit effort", "Edit distance or minutes saved per 1,000 words, measured with real linguists", "P"),
          t("c1_migration", "Migration fit", "How it replaces engines customers use today, including ModernMT before its Dec 2026 sunset", "P"),
        ],
      },
    ],
  },
  {
    id: "C2",
    title: "Type section — Quality / Risk Model",
    showFor: "quality_risk",
    draft: true,
    sections: [
      {
        id: "C2",
        title: "C2. Quality / Risk Model",
        fields: [
          t("c2_scores", "What it scores", "Content, languages and risk types it evaluates (e.g. MT quality, terminology, claims, personal data)", "P"),
          t("c2_output", "Output", "Score scale, labels or thresholds it returns, and what each one means", "P"),
          t("c2_accuracy", "Detection accuracy", "Precision, recall and F1 per risk type, on a named test set with date", "N"),
          t("c2_missed", "Missed issues", "False-negative rate: how often real problems pass unflagged, and on which content", "N"),
          t("c2_calibration", "Calibration", "How closely scores match observed error rates; how thresholds were chosen", "N"),
          t("c2_routing", "Routing decisions", "Which arbitr assurance levels and review routes rely on this score", "P"),
          t("c2_agreement", "Agreement with reviewers", "Agreement with expert human judgments (e.g. MQM), with sample size", "P"),
          t("c2_override", "Overrides", "How a reviewer overrides a score, and whether overrides feed back into the model", "P"),
        ],
      },
    ],
  },
  {
    id: "C3",
    title: "Type section — LLM Model",
    showFor: "llm",
    draft: true,
    sections: [
      {
        id: "C3",
        title: "C3. LLM Model",
        fields: [
          t("c3_tasks", "Tasks", "What it generates or rewrites (post-editing, style, terminology, summarisation)", "P"),
          t("c3_setup", "Base model and setup", "Foundation model, fine-tuned or prompted, provider and where it is hosted", "N"),
          t("c3_guardrails", "Prompts and guardrails", "System prompts, output constraints and validation wrapped around the model", "I"),
          t("c3_hallucination", "Hallucination and omission", "Measured rate of added or dropped meaning, on a named test set with date", "N"),
          t("c3_context", "Context window", "Maximum input and output length; how long documents are split", "P"),
          t("c3_grounding", "Grounding", "Which sources it may use (Cortex, TM, glossaries) and how it is held to them", "P"),
          t("c3_injection", "Prompt-injection exposure", "How content containing instructions is handled; date of last test", "N"),
          t("c3_provider_data", "Provider data use", "Whether a third-party model provider keeps or trains on inputs; contract terms", "P"),
        ],
      },
    ],
  },
  {
    id: "C4",
    title: "Type section — Custom Customer Model",
    showFor: "customer_trained",
    sections: [
      {
        id: "C4",
        title: "C4. Custom Customer Model",
        fields: [
          t("c4_data_needed", "Data we need", "Minimum and ideal data: TM size, glossaries, style guides, approved content", "P"),
          t("c4_onboarding", "Onboarding steps", "What the customer does, what we do, in order", "P"),
          t("c4_time_to_model", "Time to first model", "Weeks from data receipt to a model in production", "P"),
          t("c4_uplift", "Measured uplift", "Gain on the customer's own held-out content vs our generic model", "P"),
          t("c4_retraining", "Retraining", "Cadence and trigger (volume of new approved content, drift)", "P"),
          t("c4_isolation", "Isolation", "Confirmation the model and data serve only that customer", "P"),
          t("c4_ownership", "Ownership and exit", "Who owns weights; what happens to data and model at contract end", "P"),
          t("c4_proof", "Proof customer", "A named or anonymised customer result, with approval status", "N"),
        ],
      },
    ],
  },
  {
    id: "D",
    title: "Part D — Go-to-market",
    sections: [
      {
        id: "D1",
        title: "D1. Packaging and pricing",
        fields: [
          t("d1_how_sold", "How it's sold", "Included in the platform, add-on SKU, or custom build fee", "N"),
          t("d1_pricing", "Pricing basis", "Per word, per request, per model build, per language pair, or credits", "N"),
          t("d1_credits", "Credit mapping", "How usage converts to Intelligence Credits, if applicable", "N"),
          t("d1_sku", "SKU", "SKU code(s) and regions available", "I"),
          t("d1_margin", "Margin", "Inference and build cost vs price", "I"),
        ],
      },
      {
        id: "D2",
        title: "D2. Qualifying a buyer",
        fields: [
          t("d2_signals", "Best-fit signals", "What tells a rep this customer needs this model (volume, domain, regulation, current engine)", "I"),
          t("d2_disqualifiers", "Disqualifiers", "When this model is the wrong answer", "I"),
          t("d2_questions", "Discovery questions", "Three to five questions reps should ask", "I"),
          t("d2_objections", "Common objections", "Top objections with the evidence-backed answer to each", "N"),
        ],
      },
      {
        id: "D3",
        title: "D3. Customer evaluation and onboarding",
        fields: [
          t("d3_eval_offer", "Evaluation offer", "Pilot or bake-off on the customer's own content: scope, length, cost", "P"),
          t("d3_success", "Success criteria", "The measurable result that turns a pilot into a contract", "N"),
          t("d3_request", "Request process", "Where a customer or rep requests the model; who picks it up; response time", "P"),
          t("d3_onboarding", "Onboarding steps", "Numbered steps from signature to live use in arbitr", "P"),
          t("d3_deliverables", "What customers get", "Deliverables at go-live: model card, eval report, dashboards", "P"),
          t("d3_reporting", "Ongoing reporting", "Quality reporting the customer sees after launch, and how often", "P"),
        ],
      },
      {
        id: "D4",
        title: "D4. Sales and marketing assets",
        fields: [
          {
            kind: "table",
            key: "d4_assets",
            label: "Assets",
            help: "Say whether each asset exists, link it, and name its owner.",
            tag: "I",
            columns: ["Asset", "Exists?", "Link", "Owner"],
            presetRows: [
              "Demo script or recorded demo",
              "Before/after output samples (approved content only)",
              "One-page summary",
              "Security and procurement pack",
              "Sage knowledge entry",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "E",
    title: "Part E — Approved claims register",
    sections: [
      {
        id: "E",
        title: "Claims",
        fields: [
          {
            kind: "table",
            key: "e_claims",
            label: "Claims register",
            help: "Exact wording only. A claim with no evidence (section + test set) cannot be approved.",
            tag: "P",
            columns: ["Claim (exact wording)", "Model or factory", "Evidence (section + test set)", "Tag", "Approved by", "Review by"],
          },
        ],
      },
    ],
  },
];

export const SIGNOFF_ROLES = [
  { role: "model_team", label: "Model team lead", scope: "Technical accuracy" },
  { role: "product", label: "Product", scope: "Positioning and packaging" },
  { role: "security_legal", label: "Security & Legal", scope: "Data, licensing, compliance" },
  { role: "revops", label: "RevOps", scope: "Pricing and SKUs" },
] as const;

export const ALL_ROLES = [
  { role: "model_team", label: "Model team" },
  { role: "product", label: "Product" },
  { role: "marketing", label: "Marketing" },
  { role: "security_legal", label: "Security & Legal" },
  { role: "revops", label: "RevOps" },
] as const;

export type Answers = Record<string, string | string[][]>;

export function partsFor(kind: "factory" | "model", modelTypes: string[]): Part[] {
  if (kind === "factory") return FACTORY_PARTS;
  return MODEL_PARTS.filter((p) => !p.showFor || modelTypes.includes(p.showFor));
}

export function fieldsFor(kind: "factory" | "model", modelTypes: string[]): Field[] {
  return partsFor(kind, modelTypes).flatMap((p) => p.sections.flatMap((s) => s.fields));
}

export function isAnswered(field: Field, answers: Answers): boolean {
  const v = answers[field.key];
  if (field.kind === "text") return typeof v === "string" && v.trim().length > 0;
  if (!Array.isArray(v)) return false;
  const start = field.presetRows ? 1 : 0; // preset first column doesn't count
  return v.some((row) => row.slice(start).some((c) => c && c.trim().length > 0));
}

export function completion(kind: "factory" | "model", modelTypes: string[], answers: Answers) {
  const fields = fieldsFor(kind, modelTypes);
  const done = fields.filter((f) => isAnswered(f, answers)).length;
  return { done, total: fields.length };
}

export function emptyTable(field: TableField): string[][] {
  if (field.presetRows) return field.presetRows.map((r) => [r, ...field.columns.slice(1).map(() => "")]);
  return [field.columns.map(() => "")];
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  launch_ready: "Launch-ready",
};

// "Custom Language Model · Other: Speech model"
export function typeLabels(modelTypes: string[], otherType?: string): string {
  return (
    modelTypes
      .map((t) => (t === "other" ? `Other: ${otherType?.trim() || "unspecified"}` : MODEL_TYPES.find((m) => m.id === t)?.label ?? t))
      .join(" · ") || "No type chosen"
  );
}

// "b4_headline" -> "Headline result" (for comment references).
export function fieldLabel(key: string): string {
  for (const part of [...FACTORY_PARTS, ...MODEL_PARTS])
    for (const s of part.sections) for (const f of s.fields) if (f.key === key) return f.label;
  return key;
}
