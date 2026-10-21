import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
// Dossiers d'archives : machine à écrire (procès-verbaux) et écriture manuscrite (carnet de la victime).
import '@fontsource/special-elite/400.css';
import '@fontsource/caveat/500.css';
import './styles.css';
import { App } from './App';
import './installation';

createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
