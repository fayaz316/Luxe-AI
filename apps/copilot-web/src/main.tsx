// SPDX-License-Identifier: Apache-2.0
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/instrument-sans';
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
