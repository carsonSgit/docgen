import { z } from "zod";

/**
 * The single point-based layout contract shared by every renderer.  CSS pixels
 * are deliberately absent: conversion belongs at the browser boundary.
 */
export const DEFAULT_RENDER_METRICS = {
  typography: {
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
  },
  spacing: { paragraphAbovePoints: 0, paragraphBelowPoints: 0 },
  indentation: {
    listStartPoints: 27,
    listHangingPoints: 18,
    nestedListStepPoints: 27,
  },
  alignment: {
    default: "left",
    allowed: ["left", "center", "right", "justify"],
  },
  page: {
    widthPoints: 612,
    heightPoints: 792,
    margins: {
      topPoints: 72,
      rightPoints: 72,
      bottomPoints: 72,
      leftPoints: 72,
    },
  },
  headerFooter: { headerDistancePoints: 36, footerDistancePoints: 36 },
  media: { maxWidthPoints: 1440, maxHeightPoints: 1440 },
} as const;

export type RenderMetrics = {
  typography: {
    fontFamily: string;
    bodyFontSizePoints: number;
    lineSpacingPercent: number;
    headings: Record<
      1 | 2 | 3 | 4 | 5 | 6,
      {
        fontSizePoints: number;
        spaceAbovePoints: number;
        spaceBelowPoints: number;
      }
    >;
  };
  spacing: { paragraphAbovePoints: number; paragraphBelowPoints: number };
  indentation: {
    listStartPoints: number;
    listHangingPoints: number;
    nestedListStepPoints: number;
  };
  alignment: {
    default: "left" | "center" | "right" | "justify";
    allowed: readonly ("left" | "center" | "right" | "justify")[];
  };
  page: {
    widthPoints: number;
    heightPoints: number;
    margins: {
      topPoints: number;
      rightPoints: number;
      bottomPoints: number;
      leftPoints: number;
    };
  };
  headerFooter: { headerDistancePoints: number; footerDistancePoints: number };
  media: { maxWidthPoints: number; maxHeightPoints: number };
};

const alignment = z.enum(["left", "center", "right", "justify"]);
const heading = z
  .object({
    fontSizePoints: z.number().finite().positive(),
    spaceAbovePoints: z.number().finite().nonnegative(),
    spaceBelowPoints: z.number().finite().nonnegative(),
  })
  .partial()
  .strict();
const partialMetricsSchema = z
  .object({
    typography: z
      .object({
        fontFamily: z.string().trim().min(1).optional(),
        bodyFontSizePoints: z.number().finite().positive().optional(),
        lineSpacingPercent: z.number().finite().positive().optional(),
        headings: z
          .object({
            1: heading.optional(),
            2: heading.optional(),
            3: heading.optional(),
            4: heading.optional(),
            5: heading.optional(),
            6: heading.optional(),
          })
          .partial()
          .optional(),
      })
      .partial()
      .strict()
      .optional(),
    spacing: z
      .object({
        paragraphAbovePoints: z.number().finite().nonnegative().optional(),
        paragraphBelowPoints: z.number().finite().nonnegative().optional(),
      })
      .partial()
      .strict()
      .optional(),
    indentation: z
      .object({
        listStartPoints: z.number().finite().nonnegative().optional(),
        listHangingPoints: z.number().finite().nonnegative().optional(),
        nestedListStepPoints: z.number().finite().nonnegative().optional(),
      })
      .partial()
      .strict()
      .optional(),
    alignment: z
      .object({
        default: alignment.optional(),
        allowed: z.array(alignment).min(1).optional(),
      })
      .partial()
      .strict()
      .optional(),
    page: z
      .object({
        widthPoints: z.number().finite().positive().optional(),
        heightPoints: z.number().finite().positive().optional(),
        margins: z
          .object({
            topPoints: z.number().finite().nonnegative().optional(),
            rightPoints: z.number().finite().nonnegative().optional(),
            bottomPoints: z.number().finite().nonnegative().optional(),
            leftPoints: z.number().finite().nonnegative().optional(),
          })
          .partial()
          .strict()
          .optional(),
      })
      .partial()
      .strict()
      .optional(),
    headerFooter: z
      .object({
        headerDistancePoints: z.number().finite().nonnegative().optional(),
        footerDistancePoints: z.number().finite().nonnegative().optional(),
      })
      .partial()
      .strict()
      .optional(),
    media: z
      .object({
        maxWidthPoints: z.number().finite().positive().optional(),
        maxHeightPoints: z.number().finite().positive().optional(),
      })
      .partial()
      .strict()
      .optional(),
  })
  .strict();

export type RenderMetricsOverrides = z.input<typeof partialMetricsSchema>;

export function normalizeRenderMetrics(input: unknown = {}): RenderMetrics {
  const value = partialMetricsSchema.parse(input);
  const headings = { ...DEFAULT_RENDER_METRICS.typography.headings } as Record<
    1 | 2 | 3 | 4 | 5 | 6,
    {
      fontSizePoints: number;
      spaceAbovePoints: number;
      spaceBelowPoints: number;
    }
  >;
  for (const level of [1, 2, 3, 4, 5, 6] as const) {
    headings[level] = {
      ...headings[level],
      ...value.typography?.headings?.[level],
    };
  }
  const result = {
    ...DEFAULT_RENDER_METRICS,
    ...value,
    typography: {
      ...DEFAULT_RENDER_METRICS.typography,
      ...value.typography,
      headings,
    },
    spacing: { ...DEFAULT_RENDER_METRICS.spacing, ...value.spacing },
    indentation: {
      ...DEFAULT_RENDER_METRICS.indentation,
      ...value.indentation,
    },
    alignment: { ...DEFAULT_RENDER_METRICS.alignment, ...value.alignment },
    page: {
      ...DEFAULT_RENDER_METRICS.page,
      ...value.page,
      margins: {
        ...DEFAULT_RENDER_METRICS.page.margins,
        ...value.page?.margins,
      },
    },
    headerFooter: {
      ...DEFAULT_RENDER_METRICS.headerFooter,
      ...value.headerFooter,
    },
    media: { ...DEFAULT_RENDER_METRICS.media, ...value.media },
  };
  if (!result.alignment.allowed.includes(result.alignment.default)) {
    result.alignment.allowed = [
      ...result.alignment.allowed,
      result.alignment.default,
    ];
  }
  return result as RenderMetrics;
}

export function resolveNodeRenderMetrics(
  metrics: RenderMetrics,
  attrs?: Record<string, unknown>,
) {
  const alignment = attrs?.textAlign;
  return typeof alignment === "string" &&
    metrics.alignment.allowed.includes(alignment as never)
    ? {
        ...metrics,
        alignment: {
          ...metrics.alignment,
          default: alignment as RenderMetrics["alignment"]["default"],
        },
      }
    : metrics;
}
