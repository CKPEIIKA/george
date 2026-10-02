// George Native NC 0.1 uses ordinary homogeneous degree and one word order.
// These restrictions describe this implementation, not a family of algebras.
export const NATIVE_CAPABILITIES = Object.freeze({
  choices: Object.freeze({task: ['gb'], ring: ['noncomm'], order: ['degleftlex']}),
  fixedSettings: Object.freeze({weights: '', nonhomog: 'degreewise', strategy: 'default',
    rabbit: '', lowterms: 'quick', outmode: 'ALG', legacy: false, monomialPruning: false,
    augmentation: 'graded', matrix: '', maxserdeg: '', nmodgen: '1', nlmodgen: '1', nrmodgen: '1'}),
  numericRanges: Object.freeze({maxdeg: {min: 1, max: 20, required: true}}),
  homogeneous: true, maximumGenerators: 16,
  maximumCoefficient: '4611686018427387903', console: false,
});
