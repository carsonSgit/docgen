import { z } from "zod";

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type JsonObject = { [key: string]: JsonValue };

export const DOCUMENT_VERSION = 2 as const;
export const TEMPLATE_VERSION = 1 as const;

export const MAX_IMAGE_DIMENSION_POINTS = 1440;
export const IMAGE_ASSET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,127}$/;
export const HEADER_DISTANCE_POINTS = 36;
export const FOOTER_DISTANCE_POINTS = 36;

/** Fixed-layout metrics shared by the browser renderer and Google compiler. */
export const DOCUMENT_TYPOGRAPHY = {
  fontFamily: "Arial",
  bodyFontSizePoints: 11,
  lineSpacingPercent: 115,
  headings: {
    1: { fontSizePoints: 20, spaceAbovePoints: 0, spaceBelowPoints: 6 },
    2: { fontSizePoints: 16, spaceAbovePoints: 12, spaceBelowPoints: 6 },
    3: { fontSizePoints: 14, spaceAbovePoints: 10, spaceBelowPoints: 2 },
    4: { fontSizePoints: 12, spaceAbovePoints: 8, spaceBelowPoints: 2 },
    5: { fontSizePoints: 11, spaceAbovePoints: 6, spaceBelowPoints: 2 },
    6: { fontSizePoints: 10, spaceAbovePoints: 4, spaceBelowPoints: 2 },
  },
} as const;

const ImageAttributesSchema = z
  .object({
    assetId: z.string().regex(IMAGE_ASSET_ID_PATTERN),
    alt: z.string().trim().max(500),
    width: z.number().finite().positive().max(MAX_IMAGE_DIMENSION_POINTS),
    height: z.number().finite().positive().max(MAX_IMAGE_DIMENSION_POINTS),
  })
  .strict();

export type ImageAttributes = z.infer<typeof ImageAttributesSchema>;

const TiptapMarkSchema = z.object({
  type: z.string().min(1),
  attrs: z.record(z.string(), z.unknown()).optional(),
});

export type DocumentNode = {
  type: string;
  attrs?: Record<string, unknown>;
  text?: string;
  marks?: DocumentMark[];
  content?: DocumentNode[];
};

export type DocumentMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

/** @deprecated Use DocumentNode; this alias remains for the existing editor adapter. */
export type TiptapNode = DocumentNode;

/** @deprecated Use DocumentMark; this alias remains for the existing editor adapter. */
export type TiptapMark = DocumentMark;

const TiptapNodeSchema: z.ZodType<TiptapNode> = z.lazy(() =>
  z
    .object({
      type: z.string().min(1),
      attrs: z.record(z.string(), z.unknown()).optional(),
      text: z.string().optional(),
      marks: z.array(TiptapMarkSchema).optional(),
      content: z.array(TiptapNodeSchema).optional(),
    })
    .strict()
    .superRefine((node, context) => {
      if (node.type !== "image") return;
      const result = ImageAttributesSchema.safeParse(node.attrs);
      if (!result.success) {
        for (const issue of result.error.issues) {
          context.addIssue({ ...issue, path: ["attrs", ...issue.path] });
        }
      }
    }),
);

const DocumentSectionSchema = TiptapNodeSchema;

const PageLayoutSchema = z
  .object({
    size: z.literal("letter"),
    width: z.literal(612),
    height: z.literal(792),
    margins: z
      .object({
        top: z.literal(72),
        right: z.literal(72),
        bottom: z.literal(72),
        left: z.literal(72),
      })
      .strict(),
  })
  .strict();

const DocumentEnvelopeInputSchema = z
  .object({
    version: z.literal(DOCUMENT_VERSION),
    title: z.string().trim().min(1),
    page: PageLayoutSchema,
    content: TiptapNodeSchema,
    header: DocumentSectionSchema.nullable().optional(),
    footer: DocumentSectionSchema.nullable().optional(),
  })
  .strict();

const DocumentEnvelopeV1Schema = z
  .object({
    version: z.literal(1),
    title: z.string().trim().min(1),
    page: PageLayoutSchema,
    content: TiptapNodeSchema,
  })
  .strict();

export const DocumentEnvelopeSchema = DocumentEnvelopeInputSchema.transform(
  ({ header, footer, ...document }) => ({
    ...document,
    header: header ?? null,
    footer: footer ?? null,
  }),
);

export type DocumentEnvelope = z.infer<typeof DocumentEnvelopeSchema>;
export type PageLayout = z.infer<typeof PageLayoutSchema>;

export const DocumentTemplateIdSchema = z.enum([
  "blank",
  "resume",
  "meeting-notes",
  "letter",
]);
export type DocumentTemplateId = z.infer<typeof DocumentTemplateIdSchema>;

export const DocumentTemplateSchema = z
  .object({
    id: DocumentTemplateIdSchema,
    name: z.string().trim().min(1),
    description: z.string().trim().min(1),
    version: z.literal(TEMPLATE_VERSION),
    document: DocumentEnvelopeSchema,
  })
  .strict();

export type DocumentTemplate = z.infer<typeof DocumentTemplateSchema>;

const page = (): PageLayout => ({
  size: "letter",
  width: 612,
  height: 792,
  margins: { top: 72, right: 72, bottom: 72, left: 72 },
});

const templateDocument = (
  title: string,
  content: TiptapNode[],
): DocumentEnvelope =>
  DocumentEnvelopeSchema.parse({
    version: DOCUMENT_VERSION,
    title,
    page: page(),
    content: { type: "doc", content },
  });

const templateDefinitions: readonly DocumentTemplate[] = [
  {
    id: "blank",
    name: "Blank",
    description: "Start with an empty document.",
    version: TEMPLATE_VERSION,
    document: createBlankDocument(),
  },
  {
    id: "resume",
    name: "Resume",
    description: "A polished starting point for your experience.",
    version: TEMPLATE_VERSION,
    document: templateDocument("Resume", [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Your Name" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Professional title · email · phone · location",
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Experience" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Company — Role" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Describe your impact and achievements." },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Education" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "School — Degree" }],
      },
    ]),
  },
  {
    id: "meeting-notes",
    name: "Meeting notes",
    description: "Capture an agenda, notes, and action items.",
    version: TEMPLATE_VERSION,
    document: templateDocument("Meeting notes", [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Meeting notes" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Date · Attendees" }],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Agenda" }],
      },
      {
        type: "bulletList",
        content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Notes" }],
      },
      { type: "paragraph" },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Action items" }],
      },
      {
        type: "bulletList",
        content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
      },
    ]),
  },
  {
    id: "letter",
    name: "Letter",
    description: "A simple structure for writing a letter.",
    version: TEMPLATE_VERSION,
    document: templateDocument("Letter", [
      { type: "paragraph", content: [{ type: "text", text: "Date" }] },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Recipient name\nAddress" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Dear Recipient," }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Write your letter here." }],
      },
      { type: "paragraph", content: [{ type: "text", text: "Sincerely," }] },
      { type: "paragraph", content: [{ type: "text", text: "Your name" }] },
    ]),
  },
];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

// Export the validated registry for discovery; factories clone its envelopes.
export const BUILT_IN_TEMPLATES: readonly DocumentTemplate[] =
  deepFreeze(templateDefinitions);

const cloneDocument = (document: DocumentEnvelope): DocumentEnvelope =>
  parseDocumentEnvelope(JSON.parse(JSON.stringify(document)));

export function parseDocumentTemplate(input: unknown): DocumentTemplate {
  return DocumentTemplateSchema.parse(input);
}

export function listDocumentTemplates(): readonly {
  id: DocumentTemplateId;
  name: string;
  description: string;
  version: typeof TEMPLATE_VERSION;
}[] {
  return BUILT_IN_TEMPLATES.map(({ id, name, description, version }) => ({
    id,
    name,
    description,
    version,
  }));
}

export function getDocumentTemplate(id: DocumentTemplateId): DocumentTemplate {
  const template = BUILT_IN_TEMPLATES.find((candidate) => candidate.id === id);
  if (!template) {
    throw new Error(`Unknown document template: ${id}`);
  }
  return { ...template, document: cloneDocument(template.document) };
}

export function createDocumentFromTemplate(
  id: DocumentTemplateId,
): DocumentEnvelope {
  return getDocumentTemplate(id).document;
}
export type DocumentSection = z.infer<typeof DocumentSectionSchema>;

export function createBlankDocument(): DocumentEnvelope {
  return {
    version: DOCUMENT_VERSION,
    title: "Untitled document",
    page: {
      size: "letter",
      width: 612,
      height: 792,
      margins: { top: 72, right: 72, bottom: 72, left: 72 },
    },
    content: { type: "doc", content: [{ type: "paragraph" }] },
    header: null,
    footer: null,
  };
}

export function validateImageDimensions(width: number, height: number): void {
  ImageAttributesSchema.shape.width.parse(width);
  ImageAttributesSchema.shape.height.parse(height);
}

export function createImageNode(attributes: ImageAttributes): TiptapNode {
  return { type: "image", attrs: ImageAttributesSchema.parse(attributes) };
}

export function parseDocumentEnvelope(input: unknown): DocumentEnvelope {
  const current = DocumentEnvelopeSchema.safeParse(input);
  if (current.success) {
    return current.data;
  }

  const legacy = DocumentEnvelopeV1Schema.safeParse(input);
  if (legacy.success) {
    return {
      ...legacy.data,
      version: DOCUMENT_VERSION,
      header: null,
      footer: null,
    };
  }

  throw current.error;
}

export function validateDocumentEnvelope(input: unknown) {
  try {
    return { success: true as const, data: parseDocumentEnvelope(input) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error };
    }
    throw error;
  }
}
