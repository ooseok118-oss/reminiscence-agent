// Keep the provider's decoding grammar small. Full limits and identity checks
// are applied locally after generation, using the original Zod schema.
export function simplifyModelSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(simplifyModelSchema);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) =>
    !["$schema", "minLength", "maxLength", "minItems", "maxItems", "pattern", "format"].includes(key),
  ).map(([key, child]) => [key, simplifyModelSchema(child)]));
}
