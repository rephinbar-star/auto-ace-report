import type { ValidationStatus } from "@/types/best-deal";

/**
 * Maps a benchmark validation status to the exact user-facing claim we are
 * allowed to make. A source merely mentioning a model is never "corroboration".
 */
export function resolveValidationLabel(
  sourceName: string,
  status: ValidationStatus
): string {
  switch (status) {
    case "corroborated_numeric":
      return `Corroborated by ${sourceName}`;
    case "editorial_match":
      return `Also featured by ${sourceName}`;
    case "no_comparable_match":
      return "No comparable benchmark found";
    case "not_applicable":
      return "Not applicable (lease benchmark)";
    case "unavailable":
    default:
      return "Source unavailable";
  }
}
