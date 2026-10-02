// SPDX-License-Identifier: MIT
// Separate from ECL: loading this engine never downloads the Lisp runtime.
import {dispatchNative} from './george-entry.js';
onmessage = async ({data}) => {
  try {
    if (!await dispatchNative(data, message => postMessage(message))) {
      postMessage({id: data.id, error: 'Unknown Native NC command.'});
    }
  } catch (error) {
    postMessage({id: data.id, error: error.message || String(error)});
  } finally {
    if (data.command === 'run') postMessage({closed: true});
  }
};
