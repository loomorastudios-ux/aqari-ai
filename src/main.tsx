import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker for PWA compliance and offline support
if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'test') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('Aqari PWA Service Worker registered:', reg.scope);
      })
      .catch((err) => {
        console.warn('Aqari PWA Service Worker registration failed:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);

