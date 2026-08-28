import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SettingsWindow from './components/settings/SettingsWindow';
import './styles/pet.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsWindow />
  </StrictMode>,
);
