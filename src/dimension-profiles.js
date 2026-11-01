// Preconfigured dimension authorities. Imported proof chains remain external evidence.
export const FK6_DIMENSIONS_THROUGH20 = {
  "schema": 1,
  "kind": "external-dimensions",
  "identity": "17c5a3b13bbae1fd6e03ece75139f297d437bda2ae062b093d77a92f091b88bf",
  "modulus": 0,
  "source": "FK6 project proof chain, exact through degree 20; external proof is not replayed by the browser",
  "certificateRunSHA256": "ff53cb4a9ea903dbd63c3875a2d512884953586e3ec832036504431be47857a2",
  "proofStatus": "Original-identity proofs, exact derivative minors, finite subalgebra factorization, inherited Q nonzero/primitive and quotient-coideal arguments. Not externally reviewed or proof-assistant formalized.",
  "entries": [
    {
      "degree": 1,
      "dimension": "15"
    },
    {
      "degree": 2,
      "dimension": "125"
    },
    {
      "degree": 3,
      "dimension": "765"
    },
    {
      "degree": 4,
      "dimension": "3831"
    },
    {
      "degree": 5,
      "dimension": "16605"
    },
    {
      "degree": 6,
      "dimension": "64432"
    },
    {
      "degree": 7,
      "dimension": "228855"
    },
    {
      "degree": 8,
      "dimension": "755777"
    },
    {
      "degree": 9,
      "dimension": "2347365"
    },
    {
      "degree": 10,
      "dimension": "6916867"
    },
    {
      "degree": 11,
      "dimension": "19468980"
    },
    {
      "degree": 12,
      "dimension": "52632322"
    },
    {
      "degree": 13,
      "dimension": "137268120"
    },
    {
      "degree": 14,
      "dimension": "346652740"
    },
    {
      "degree": 15,
      "dimension": "850296030"
    },
    {
      "degree": 16,
      "dimension": "2031123484"
    },
    {
      "degree": 17,
      "dimension": "4735557180"
    },
    {
      "degree": 18,
      "dimension": "10797439780"
    },
    {
      "degree": 19,
      "dimension": "24117029700"
    },
    {
      "degree": 20,
      "dimension": "52848046446"
    }
  ]
};
const legacyDocument = {...FK6_DIMENSIONS_THROUGH20,
  entries: FK6_DIMENSIONS_THROUGH20.entries.filter(entry => entry.degree <= 17),
  source: 'Imported FK6 dimension profile through degree 17; component dimensions are available in the kernel'};
// A profile supplies evidence and the settings it needs. Further presentations
// can register their own documents without adding a presentation-specific control.
export const DIMENSION_PROFILES = Object.freeze({
  'fk6-20': {mode: 'assume', document: FK6_DIMENSIONS_THROUGH20,
    settings: {hilbertGate: true, hilbertSectors: true}, componentThroughDegree: 17},
  'fk6-17': {mode: 'compiled', document: legacyDocument,
    settings: {hilbertGate: true, hilbertSectors: true}, componentThroughDegree: 17},
});
export const DIMENSION_PROFILE_MODES = Object.freeze(Object.keys(DIMENSION_PROFILES));
export function dimensionProfileText(mode) {
  const profile = DIMENSION_PROFILES[mode];
  if (!profile) throw new Error('Unknown dimension profile: ' + mode);
  return JSON.stringify(profile.document, null, 2);
}
