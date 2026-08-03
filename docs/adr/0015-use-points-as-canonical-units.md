# Use points as canonical document units

The Local Document stores page dimensions, margins, font sizes, spacing, and indentation in points because Google Docs uses points for these measurements. The browser renderer converts points to CSS pixels at its boundary; the exporter passes point values directly to Google Docs API requests.
