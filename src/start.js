import {prepareIsolation} from './isolation.js';
if (await prepareIsolation() !== 'reloading') await import('./app.js');
