import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './fonts.css';
import { installLiquidGlass } from './glass.ts';
import { installLiquidBlobs } from './liquid.ts';
import './styles.css';

installLiquidGlass();
installLiquidBlobs();
createRoot(document.getElementById('root')!).render(<App />);

// Offline: registered in production builds only. The service worker caches app code, never user data.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js').catch(() => undefined));
}
