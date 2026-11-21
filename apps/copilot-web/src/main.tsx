// SPDX-License-Identifier: Apache-2.0
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/jost/400.css';
import '@fontsource/jost/400-italic.css';
import '@fontsource/jost/500.css';
import '@fontsource/jost/600.css';
import App from './App';
import './styles.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Root element is missing from the document.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

window.addEventListener('load', () => {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Offline support is an enhancement; registration failures are non-fatal.
  });
});
