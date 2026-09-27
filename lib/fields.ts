// Every section and field of the Custom Models Go-to-Market Fact Pack.
// Schema v2 (27 Sep 2026): merged duplicates, Required/Optional per field,
// type-dependent help. See CHANGELOG.md. To add a field, add one line here.

export const SCHEMA_VERSION = 3;

export type Tag = "P" | "N" | "I";
export const TAG_LABEL: Record<Tag, string> = { P: "Public", N: "Under NDA", I: "Internal" };
export const TAG_MEANING: Record<Tag, string> = {
  P: "Website, one-pagers, Sage",
  N: "Security reviews, RFPs",
  I: "Never leaves arbitr",
};

type Common = {
  key: string;
  label: string;
  help: string;
  tag: Tag;
  required?: boolean;
  // Extra help shown when a model type is active, e.g. LLM-only prompts.
  helpFor?: Partial<Record<string, string>>;
  // Replaces the help entirely for a model type (first active match wins).
  helpReplaceFor?: Partial<Record<string, string>>;
  showFor?: string; // only shown when this model type is active
  // A measured spec: any number in it must say what it was measured under.
  measured?: boolean;
  subOf?: string; // rendered as an indented sub-note under another field
};
export type TextField = Common & { kind: "text" };
export type Column = { name: string; type?: "text" | "date" | "select"; options?: string[] };
export type TableField = Common & {
  kind: "table";
  columns: Column[];
  presetRows?: string[]; // first column fixed, e.g. asset names
};
export type Field = TextField | TableField;
export type Section = { id: string; title: string; fields: Field[]; readonlyFactory?: { key: string; label: string } };
// draft: questions written by us, not yet confirmed by the model team.
export type Part = { id: string; title: string; sections: Section[]; showFor?: string; draft?: boolean };

type Opts = Omit<Common, "key" | "label" | "help" | "tag">;
const t = (key: string, label: string, help: string, tag: Tag, opts: Opts = {}): TextField => ({ kind: "text", key, label, help, tag, ...opts });
const req = { required: true };
const col = (name: string, extra: Omit<Column, "name"> = {}): Column => ({ name, ...extra });

export const MODEL_TYPES = [
  { id: "custom_mt", label: "Custom Language Model" },
  { id: "quality_risk", label: "Quality / Risk Model" },
  { id: "llm", label: "LLM Model" },
  { id: "customer_trained", label: "Custom Customer Model" },
  { id: "other", label: "Other" }, // free text in Pack.otherType; no extra questions
] as const;

export const SCALES = ["0–1", "0–100", "minutes", "%"];

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
      {
        id: "A9",
        title: "A9. Factory-wide settings",
        fields: [
          t(
            "a9_request_process",
            "Request process",
            "Where a customer or rep requests a model, who picks it up, and response time. Shown read-only in D3 of every model pack.",
            "P",
          ),
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
          t("b1_name_version", "Model name and version", "Internal ID and external product name", "P", req),
          t("b1_status", "Status", "Research, Beta or GA, and GA date", "P", req),
          t("b1_owner", "Owner", "Accountable person on the model team", "I", req),
          t("b1_base_model", "Base model", "Foundation model, version and licence", "N", req),
          t("b1_one_line", "One-line value", "What it does better, for whom, in under 20 words", "P", req),
        ],
      },
      {
        id: "B2",
        title: "B2. Intended use",
        fields: [
          t("b2_use_cases", "Primary use cases", "The jobs this model is built for, most important first", "P", req),
          t("b2_customers", "Target customers", "Industries, content types and teams it suits best", "P", req),
          t("b2_out_of_scope", "Out of scope", "Uses we do not support or recommend (e.g. unreviewed legal or medical publishing)", "P", req),
          t(
            "b2_oversight_assurance",
            "Oversight and assurance",
            "The minimum arbitr assurance level, the assurance levels it is approved for, and the human review we recommend",
            "P",
            req,
          ),
        ],
      },
      {
        id: "B3",
        title: "B3. Training data",
        fields: [
          t("b3_sources", "Sources", "Datasets used, with size (segments, tokens or documents)", "N", req),
          t("b3_domains", "Domains and languages covered", "What the training data covers. Record thin areas and gaps in B5, not here.", "P"),
          t("b3_dates", "Date range", "Oldest and newest data; knowledge cutoff for LLMs", "P"),
          t("b3_cleaning", "Cleaning and filtering", "Deduplication, PII removal, quality filters applied", "N"),
          t("b3_customer_data", "Customer data", "Whether any customer data was used, and under what consent", "N", req),
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
            help:
              "The one source for every performance number in this pack. One row per metric and scope; every number needs a named test set, its scale and a measurement date. Rows past their re-validate date block launch.",
            tag: "N",
            required: true,
            columns: [
              col("Metric"),
              col("Language pair / Scope"),
              col("Test set (name, size, domain)"),
              col("Scale", { type: "select", options: SCALES }),
              col("This model"),
              col("Previous version"),
              col("Generic baseline"),
              col("Comparator (name + score)"),
              col("Date measured", { type: "date" }),
              col("Re-validate by", { type: "date" }),
            ],
          },
          t("b4_headline", "Headline result", "The single number Sales should lead with, in one sentence. It must match an approved claim in Part E.", "P", req),
        ],
      },
      {
        id: "B5",
        title: "B5. Limitations and failure modes",
        fields: [
          t(
            "b5_weaknesses",
            "Known weaknesses and gaps",
            "The one place for quality gaps: languages, domains, formats or lengths where quality drops, and where training data is thin",
            "N",
            req,
          ),
          t("b5_error_modes", "Error modes", "The most common error types, with an example of each", "N", {
            helpFor: { llm: "LLM: also cover hallucination, toxicity and prompt-injection exposure, with an example of each." },
          }),
          t("b5_bias", "Bias findings", "Results of fairness tests and what we did about them", "N", {
            helpReplaceFor: {
              llm: "Results of fairness tests and what we did about them",
              custom_mt: "Gender, formality and register bias tests, and results.",
            },
          }),
          t("b5_mitigations", "Mitigations", "Guardrails, fallbacks and review steps that contain these risks", "P", req),
        ],
      },
      {
        id: "B6",
        title: "B6. Runtime characteristics",
        fields: [
          t("b6_latency", "Latency", "Median and 95th-percentile per request or per 1,000 words, and the conditions measured under (hardware, load, document type or test set)", "P", { measured: true }),
          t("b6_throughput", "Throughput", "Sustained volume per hour, and the conditions measured under (hardware, load, region)", "N", { measured: true }),
          t("b6_limits", "Context or input limits", "Max segment, document or token length", "P"),
          t("b6_formats", "Supported formats", "File and content formats it handles directly", "P"),
          t("b6_unit_cost", "Unit cost", "Inference cost per 1,000 words or tokens", "I"),
        ],
      },
      {
        id: "B7",
        title: "B7. How it runs in arbitr",
        fields: [
          t("b7_how_used", "How arbitr uses it", "Where it sits in the workflow and which features call it", "P"),
          t("b7_routing_note", "Routing logic", "When arbitr chooses this model over alternatives", "N", { subOf: "b7_how_used" }),
          t("b7_cortex", "Cortex use", "Whether it reads from or writes to Cortex, and how", "P"),
          t("b7_api", "API and integrations", "Availability via API, MCP or connectors", "P"),
          t(
            "b7_data_handling",
            "Data handling",
            "Where the model is hosted and where data is processed; whether customer content is stored or logged at runtime, and for how long; sub-processors",
            "P",
            req,
          ),
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
            help: "One row per released model version (e.g. v2.1). Not the same as pack revisions (Rev 1, Rev 2).",
            tag: "P",
            columns: [col("Version"), col("Date"), col("What changed")],
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
          t("c1_pairs", "Language pairs", "Every supported direction, with GA or Beta status per pair. Scores per pair go in B4.", "P"),
          t("c1_locales", "Locale variants", "Regional variants and formality control (e.g. pt-BR vs pt-PT, tu/vous)", "P"),
          t("c1_domains", "Domains", "Content domains tuned for (legal, life sciences, marketing, UI)", "P"),
          t("c1_terminology", "Terminology", "How glossaries and do-not-translate lists are enforced; enforcement rate", "P"),
          t("c1_tm", "Translation memory", "How TM and Cortex content bias output; leverage uplift", "P"),
          t("c1_tags", "Tags and formatting", "Handling of XLIFF tags, placeholders, markup, numbers and dates; tag error rate", "N"),
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
          t("c2_accuracy", "Detection accuracy", "Precision, recall and F1 per risk type. Record the numbers in B4.", "N"),
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
          t("c3_hallucination", "Hallucination and omission", "Measured rate of added or dropped meaning. Record the numbers in B4.", "N"),
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
          t(
            "d1_packaging",
            "Packaging & pricing",
            "How it's sold (included, add-on SKU or custom build fee), the pricing basis (per word, request, build, language pair or credits), and how usage converts to Intelligence Credits",
            "N",
            req,
          ),
          t("d1_sku", "SKU", "SKU code(s) and regions available", "I", req),
          t("d1_margin", "Margin", "Inference and build cost vs price", "I", req),
        ],
      },
      {
        id: "D2",
        title: "D2. Qualifying a buyer",
        fields: [
          t("d2_signals", "Best-fit signals", "What tells a rep this customer needs this model (volume, domain, regulation, current engine)", "I"),
          t(
            "d2_disqualifiers",
            "Disqualifiers",
            "When this model is the wrong answer for a buyer. Point to B2 Out of scope and B5 Known weaknesses rather than restating them.",
            "I",
          ),
          t("d2_questions", "Discovery questions", "Three to five questions reps should ask", "I"),
          t("d2_objections", "Common objections", "Top objections with the evidence-backed answer to each", "I"),
        ],
      },
      {
        id: "D3",
        title: "D3. Customer evaluation and onboarding",
        readonlyFactory: { key: "a9_request_process", label: "Request process (factory-wide)" },
        fields: [
          t("d3_eval_offer", "Evaluation offer", "Pilot or bake-off on the customer's own content: scope, length, cost", "P"),
          t("d3_success", "Success criteria", "The measurable result that turns a pilot into a contract", "N"),
          t("d3_onboarding", "Onboarding steps", "Numbered steps from signature to live use in arbitr", "P"),
          t("d3_onboarding_ctm", "Customer-trained build", "Extra steps for a customer-trained build: what the customer does, what we do, in order", "P", {
            subOf: "d3_onboarding",
            showFor: "customer_trained",
          }),
          t("d3_deliverables", "Deliverables and reporting", "What customers get at go-live (model card, eval report, dashboards) and the quality reporting they see after launch, and how often", "P"),
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
            columns: [col("Asset"), col("Exists?"), col("Link"), col("Owner")],
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
            help:
              "Exact wording only. A claim counts as approved only when it has Evidence (section + test set, e.g. “B4 Results row 3”) and Approved by. " +
              "A Public field needs a registered claim only if it states a performance result (98.6% enforcement, COMET 0.87), an improvement or delta (+6 pts, saves 22 minutes), " +
              "or a comparison with another product or engine (faster than, vs, replaces, drop-in). Exempt: product specs (latency, limits, formats) and commercial terms " +
              "(timelines, pilot scope, retention periods), but a measured spec with numbers must name the conditions it was measured under. Evidence that cites a field " +
              "which no longer exists is flagged as a broken reference.",
            tag: "P",
            required: true,
            columns: [
              col("Claim (exact wording)"),
              col("Model or factory"),
              col("Evidence (section + test set)"),
              col("Tag"),
              col("Approved by"),
              col("Review by"),
              col("Source field"),
            ],
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
// Field key -> reason it doesn't apply (at least 10 characters).
export type NA = Record<string, string>;
export const NA_MIN = 10;

export function partsFor(kind: "factory" | "model", modelTypes: string[]): Part[] {
  if (kind === "factory") return FACTORY_PARTS;
  return MODEL_PARTS.filter((p) => !p.showFor || modelTypes.includes(p.showFor)).map((p) => ({
    ...p,
    sections: p.sections.map((s) => ({ ...s, fields: s.fields.filter((f) => !f.showFor || modelTypes.includes(f.showFor)) })),
  }));
}

export function fieldsFor(kind: "factory" | "model", modelTypes: string[]): Field[] {
  return partsFor(kind, modelTypes).flatMap((p) => p.sections.flatMap((s) => s.fields));
}

export function helpFor(field: Field, modelTypes: string[]): string {
  let help = field.help;
  if (field.helpReplaceFor) {
    const hits = Object.entries(field.helpReplaceFor).filter(([type]) => modelTypes.includes(type)).map(([, h]) => h!);
    if (hits.length) help = [...new Set(hits)].join(" ");
  }
  const extra = Object.entries(field.helpFor ?? {}).filter(([type]) => modelTypes.includes(type)).map(([, h]) => h);
  return [help, ...extra].join(" ");
}

export function isAnswered(field: Field, answers: Answers): boolean {
  const v = answers[field.key];
  if (field.kind === "text") return typeof v === "string" && v.trim().length > 0;
  if (!Array.isArray(v)) return false;
  const start = field.presetRows ? 1 : 0; // preset first column doesn't count
  return v.some((row) => row.slice(start).some((c) => c && c.trim().length > 0));
}

export const isNA = (field: Field, na: NA = {}) => (na[field.key]?.trim().length ?? 0) >= NA_MIN;
export const isDone = (field: Field, answers: Answers, na: NA = {}) => isAnswered(field, answers) || isNA(field, na);

export function completion(kind: "factory" | "model", modelTypes: string[], answers: Answers, na: NA = {}) {
  const fields = fieldsFor(kind, modelTypes);
  const req = fields.filter((f) => f.required);
  const opt = fields.filter((f) => !f.required);
  return {
    requiredDone: req.filter((f) => isDone(f, answers, na)).length,
    requiredTotal: req.length,
    optionalDone: opt.filter((f) => isDone(f, answers, na)).length,
    optionalTotal: opt.length,
  };
}

export const completionText = (c: ReturnType<typeof completion>) =>
  c.requiredTotal ? `Required: ${c.requiredDone}/${c.requiredTotal} · Optional: ${c.optionalDone}/${c.optionalTotal}` : `Answered: ${c.optionalDone}/${c.optionalTotal}`;

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

export function findField(key: string): Field | undefined {
  for (const part of [...FACTORY_PARTS, ...MODEL_PARTS]) for (const s of part.sections) for (const f of s.fields) if (f.key === key) return f;
  return undefined;
}

// "b4_headline" -> "Headline result" (for comment references).
export const fieldLabel = (key: string) => findField(key)?.label ?? key;

// Sections a field belongs to, e.g. "B4" (used in flag messages).
export function sectionOf(key: string): string {
  for (const part of [...FACTORY_PARTS, ...MODEL_PARTS]) for (const s of part.sections) if (s.fields.some((f) => f.key === key)) return s.id;
  return "";
}
