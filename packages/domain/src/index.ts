import { z } from "zod";

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type JsonObject = { [key: string]: JsonValue };

export const DOCUMENT_VERSION = 1 as const;

export const MAX_IMAGE_DIMENSION_POINTS = 1440;
export const IMAGE_ASSET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,127}$/;

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

export function validateImageDimensions(width: number, height: number): void {
  ImageAttributesSchema.shape.width.parse(width);
  ImageAttributesSchema.shape.height.parse(height);
}

export function createImageNode(attributes: ImageAttributes): TiptapNode {
  return { type: "image", attrs: ImageAttributesSchema.parse(attributes) };
}

export function parseDocumentEnvelope(input: unknown): DocumentEnvelope {
  return DocumentEnvelopeSchema.parse(input);
}

export function validateDocumentEnvelope(input: unknown) {
  return DocumentEnvelopeSchema.safeParse(input);
}
