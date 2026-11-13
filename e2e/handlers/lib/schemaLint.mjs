/**
 * Linter for OpenAI Structured Outputs `strict: true` JSON schemas.
 * Returns an array of human-readable problems (empty = OK). Rules (https://platform.openai.com/docs/guides/structured-outputs):
 *  - root must be type object (not anyOf)
 *  - every object: additionalProperties === false and `required` lists EVERY key in `properties`
 *  - arrays need `items`; `type` may be a string or an array of strings (['string','null'] for nullable)
 *  - unsupported keywords are rejected (allOf, not, if/then/else, patternProperties, default, oneOf, ...)
 *  - nesting depth <= 10, <= 5000 properties
 */
const UNSUPPORTED = ['allOf', 'not', 'dependentRequired', 'dependentSchemas', 'if', 'then', 'else', 'patternProperties', 'oneOf', 'default', 'unevaluatedProperties', 'propertyNames', 'minProperties', 'maxProperties'];

export function lintStrictSchema(schema) {
  const problems = [];
  let propCount = 0;
  const walk = (s, path, depth) => {
    if (depth > 10) problems.push(`${path}: nesting deeper than 10`);
    if (!s || typeof s !== 'object') { problems.push(`${path}: schema is not an object`); return; }
    for (const k of UNSUPPORTED) if (k in s) problems.push(`${path}: unsupported keyword "${k}"`);
    if (s.anyOf) { s.anyOf.forEach((x, i) => walk(x, `${path}.anyOf[${i}]`, depth + 1)); return; }
    if (s.$ref) return;
    const types = Array.isArray(s.type) ? s.type : [s.type];
    if (!s.type && !s.enum) problems.push(`${path}: missing "type"`);
    for (const t of types) if (t && !['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'].includes(t)) problems.push(`${path}: bad type "${t}"`);
    if (types.includes('object')) {
      if (s.additionalProperties !== false) problems.push(`${path}: object must set additionalProperties:false`);
      const props = Object.keys(s.properties ?? {});
      propCount += props.length;
      const req = new Set(s.required ?? []);
      for (const p of props) if (!req.has(p)) problems.push(`${path}: property "${p}" is not in required`);
      for (const r of req) if (!props.includes(r)) problems.push(`${path}: required "${r}" is not a property`);
      for (const p of props) walk(s.properties[p], `${path}.${p}`, depth + 1);
    }
    if (types.includes('array')) {
      if (!s.items) problems.push(`${path}: array without items`);
      else walk(s.items, `${path}[]`, depth + 1);
    }
  };
  if (!schema || (schema.type !== 'object')) problems.push('root: must be type "object"');
  walk(schema, 'root', 0);
  if (propCount > 5000) problems.push('too many properties');
  return problems;
}
