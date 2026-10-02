// Optional capabilities on a backend descriptor. Omitted restrictions allow
// the existing Bergman options. New engines declare their own supported set.
import {getBackend} from './backends.js';

export const QUADRATIC_BASIS_CAPABILITIES = Object.freeze({
  choices: Object.freeze({task: Object.freeze(['gb']), ring: Object.freeze(['noncomm']),
    order: Object.freeze(['degleftlex'])}),
  fixedSettings: Object.freeze({weights: '', nonhomog: 'degreewise', strategy: 'default',
    rabbit: '', lowterms: 'quick', outmode: 'ALG', legacy: false, monomialPruning: false,
    augmentation: 'graded', matrix: '', maxserdeg: '', nmodgen: '1', nlmodgen: '1', nrmodgen: '1'}),
  homogeneous: true,
  relationDegrees: Object.freeze([2]),
  console: false,
});

export function backendCapabilities(backend) {
  return (typeof backend === 'string' ? getBackend(backend) : backend).capabilities || {};
}

export function backendAllows(backend, setting, value) {
  const {choices = {}, fixedSettings = {}} = backendCapabilities(backend);
  if (Object.hasOwn(fixedSettings, setting)) {
    const required = fixedSettings[setting];
    return typeof required === 'boolean' ? value === required : String(value) === String(required);
  }
  return !Object.hasOwn(choices, setting) || choices[setting].includes(value);
}

export function backendSettingsErrors(form, backend = form.backend ?? 'standard') {
  const caps = backendCapabilities(backend);
  const restricted = new Set([...Object.keys(caps.choices || {}), ...Object.keys(caps.fixedSettings || {})]);
  const errors = [...restricted].some(key => form[key] !== undefined && !backendAllows(backend, key, form[key]))
    ? ['The selected engine does not support these settings.'] : [];
  for (const [key, range] of Object.entries(caps.numericRanges || {})) {
    const value = form[key], empty = value === '' || value === undefined;
    if (empty && !range.required) continue;
    if (empty || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value))
        || Number(value) < range.min || Number(value) > range.max) {
      errors.push('The selected engine requires a maximal degree from 1 to 20.');
    }
  }
  if (caps.maximumGenerators && form.vars?.length > caps.maximumGenerators) {
    errors.push('The selected engine supports at most 16 generators.');
  }
  return errors;
}

export function backendRelationErrors(parsedRelations, backend) {
  const caps = backendCapabilities(backend), errors = [];
  const degrees = parsedRelations.map(terms => terms.map(term => term.factors.reduce((d, f) => d + f.e, 0)));
  if (caps.homogeneous && degrees.some(row => new Set(row).size > 1)) errors.push('The selected engine requires homogeneous relations.');
  if (caps.relationDegrees && degrees.some(row => row.some(d => !caps.relationDegrees.includes(d)))) errors.push('The selected engine does not support these relation degrees.');
  if (caps.maximumCoefficient && parsedRelations.some(terms => terms.some(term => BigInt(term.coef) > BigInt(caps.maximumCoefficient)))) errors.push('The selected engine supports input integers up to 2^62−1 in absolute value.');
  if (caps.maximumCoefficient && degrees.some(row => row.some(d => d < 1 || d > 20))) errors.push('The selected engine supports relation degrees from 1 to 20.');
  return errors;
}

// Used by the actual form and by browser checks with a future-engine profile.
// Task metadata supplies constraints that apply independently of the backend.
export function applyBackendCapabilities(root, backend, {tasks, translate, onRingChange = () => {}}) {
  for (const name of ['ring', 'field']) {
    const radios = [...root.querySelectorAll(`input[name="${name}"]`)];
    for (const input of radios) input.disabled = !backendAllows(backend, name, input.value);
    if (radios.some(input => input.checked && input.disabled)) {
      const next = radios.find(input => !input.disabled);
      if (next) {next.checked = true; if (name === 'ring') onRingChange();}
    }
  }
  const ring = root.querySelector('input[name="ring"]:checked')?.value;
  for (const label of root.querySelectorAll('[data-task]')) {
    const task = tasks.find(t => t.id === label.dataset.task);
    const input = label.querySelector('input'), note = label.querySelector('.t-note');
    const engineBlocked = !backendAllows(backend, 'task', task.id);
    const ringBlocked = task.ring && task.ring !== ring;
    input.disabled = !!(engineBlocked || ringBlocked);
    label.classList.toggle('unavailable', input.disabled);
    note.hidden = !input.disabled;
    note.textContent = engineBlocked ? translate('backend.unsupported') : ringBlocked
      ? translate(task.ring === 'comm' ? 'task.commOnly' : 'task.noncommOnly') : '';
  }
  const taskInputs = [...root.querySelectorAll('input[name="task"]')];
  if (taskInputs.some(input => input.checked && input.disabled)) {
    const next = taskInputs.find(input => !input.disabled);
    if (next) next.checked = true;
  }
  const {fixedSettings = {}} = backendCapabilities(backend);
  for (const input of root.querySelectorAll('input[id], select[id], textarea[id]')) {
    const fixed = Object.hasOwn(fixedSettings, input.id);
    input.disabled = fixed;
    if (fixed) {
      if (input.type === 'checkbox') input.checked = fixedSettings[input.id];
      else input.value = fixedSettings[input.id];
    }
    if (input.tagName === 'SELECT' && input.id !== 'backend' && input.id !== 'memoryMiB') {
      for (const option of input.options) option.disabled = !backendAllows(backend, input.id, option.value);
      if (input.selectedOptions[0]?.disabled) {
        const next = [...input.options].find(option => !option.disabled);
        if (next) input.value = next.value;
      }
    }
    input.closest('label')?.classList.toggle('backend-disabled', fixed);
    if (fixed) {input.title = translate('backend.unsupported'); input.dataset.backendDisabled = 'true';}
    else if (input.dataset.backendDisabled) {input.removeAttribute('title'); delete input.dataset.backendDisabled;}
  }
}
