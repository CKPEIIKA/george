// Normalizes a basis off the main thread; see normal-basis.js.
import { normalizeBasis } from './normal-basis.js';
onmessage = ({ data }) => {
  try { postMessage({ result: normalizeBasis({ ...data, onProgress: (progress) => postMessage({ progress }) }) }); }
  catch (error) { postMessage({ error: error.message }); }
};
