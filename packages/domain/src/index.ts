import { z } from "zod";

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type JsonObject = { [key: string]: JsonValue };

export const DOCUMENT_VERSION = 2 as const;

const TiptapMarkSchema = z.object({
  type: z.string().min(1),
  attrs: z.record(z.string(), z.unknown()).optional(),
});

export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  text?: string;
  marks?: TiptapMark[];
  content?: TiptapNode[];
};

export type TiptapMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

const TiptapNodeSchema: z.ZodType<TiptapNode> = z.lazy(() =>
  z
    .object({
      type: z.string().min(1),
      attrs: z.record(z.string(), z.unknown()).optional(),
      text: z.string().optional(),
      marks: z.array(TiptapMarkSchema).optional(),
      content: z.array(TiptapNodeSchema).optional(),
    })
    .strict(),
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
