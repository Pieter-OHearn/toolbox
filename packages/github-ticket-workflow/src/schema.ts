export const reviewOutputSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  properties: {
    result: {
      type: "string",
      enum: ["no_findings", "findings"],
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          severity: {
            type: "string",
            enum: ["high", "medium", "low"],
          },
          file: {
            type: "string",
          },
          problem: {
            type: "string",
          },
          change: {
            type: "string",
          },
        },
        required: ["severity", "file", "problem", "change"],
      },
    },
  },
  required: ["result", "findings"],
} as const;
