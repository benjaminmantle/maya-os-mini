const registry = {};

export function registerShowcase(templateKey, component) {
  registry[templateKey] = component;
}

export function getShowcase(templateKey) {
  return registry[templateKey] || null;
}
