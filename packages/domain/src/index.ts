import { z } from "zod";

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type JsonObject = { [key: string]: JsonValue };

export const DOCUMENT_VERSION = 1 as const;

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

export const DocumentEnvelopeSchema = z
  .object({
    version: z.literal(DOCUMENT_VERSION),
    title: z.string().trim().min(1),
    page: PageLayoutSchema,
    content: TiptapNodeSchema,
  })
  .strict();

export type DocumentEnvelope = z.infer<typeof DocumentEnvelopeSchema>;
export type PageLayout = z.infer<typeof PageLayoutSchema>;

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
  };
}

export function parseDocumentEnvelope(input: unknown): DocumentEnvelope {
  return DocumentEnvelopeSchema.parse(input);
}

export function validateDocumentEnvelope(input: unknown) {
  return DocumentEnvelopeSchema.safeParse(input);
}
