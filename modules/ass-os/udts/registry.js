// ass-os/udts/registry.js — UDT Registry (Layer 0 meta-standard)
// Defines how UDTs are structured: inheritance, validation, instantiation.

const FIELD_TYPES = ['str', 'int', 'float', 'bool', 'enum', 'ref', 'array', 'object', 'any', 'timestamp', 'duration', 'uuid'];

export class UDTRegistry {
  constructor() {
    this.templates = new Map();
    this.standards = new Map();
    this.crosswalks = [];
  }

  define(name, template) {
    if (template.base && this.templates.has(template.base)) {
      const parent = this.templates.get(template.base);
      template._resolved = {
        fields: { ...parent._resolved?.fields || Object.fromEntries((parent.fields || []).map(f => [f.name, f])),
                  ...Object.fromEntries((template.fields || []).map(f => [f.name, f])) },
        methods: [...(parent._resolved?.methods || parent.methods || []), ...(template.methods || [])],
        constraints: [...(parent._resolved?.constraints || parent.constraints || []), ...(template.constraints || [])]
      };
    } else {
      template._resolved = {
        fields: Object.fromEntries((template.fields || []).map(f => [f.name, f])),
        methods: template.methods || [],
        constraints: template.constraints || []
      };
    }
    template.name = name;
    this.templates.set(name, template);
    return template;
  }

  get(name) { return this.templates.get(name); }

  validate(name, instance) {
    const tmpl = this.templates.get(name);
    if (!tmpl) return { valid: false, errors: [`UDT "${name}" not found`] };
    const errors = [];
    const fields = tmpl._resolved.fields;
    for (const [fname, fdef] of Object.entries(fields)) {
      if (fdef.required && (instance[fname] === undefined || instance[fname] === null))
        errors.push(`Missing required field: ${fname}`);
      if (instance[fname] !== undefined && fdef.range) {
        const v = instance[fname];
        if (typeof v === 'number' && (v < fdef.range[0] || v > fdef.range[1]))
          errors.push(`${fname}=${v} out of range [${fdef.range[0]},${fdef.range[1]}]`);
      }
    }
    for (const c of tmpl._resolved.constraints) {
      if (c.check && !c.check(instance)) errors.push(`Constraint ${c.id}: ${c.message || 'failed'}`);
    }
    return { valid: errors.length === 0, errors };
  }

  instantiate(name, data = {}) {
    const tmpl = this.templates.get(name);
    if (!tmpl) return null;
    const instance = { _udt: name, _created: Date.now() };
    for (const [fname, fdef] of Object.entries(tmpl._resolved.fields))
      instance[fname] = data[fname] !== undefined ? data[fname] : (fdef.default !== undefined ? fdef.default : null);
    return instance;
  }

  listTemplates() { return Array.from(this.templates.keys()); }
  listByStandard(stdId) { return Array.from(this.templates.entries()).filter(([,t]) => t.standard === stdId).map(([n]) => n); }
  defineStandard(std) { this.standards.set(std.id, std); }
  defineCrosswalk(cw) { this.crosswalks.push(cw); }
  crosswalk(entity, fromStd, toStd) { return this.crosswalks.filter(c => c.from_std === fromStd && c.to_std === toStd && c.from_entity === entity); }
}

export const registry = new UDTRegistry();
