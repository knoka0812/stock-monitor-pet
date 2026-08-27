import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import PetWindow from './components/pet/PetWindow';
import SettingsWindow from './components/settings/SettingsWindow';

function App() {
  const [mode, setMode] = useState<'pet' | 'settings'>('pet');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const win = params.get('window');
    if (win === 'settings') {
      setMode('settings');
    } else {
      setMode('pet');
    }
  }, []);

  if (mode === 'settings') {
    return <SettingsWindow />;
  }

  return <PetWindow onOpenSettings={openSettingsWindow} />;
}

async function openSettingsWindow() {
  try {
    await invoke('open_settings');
  } catch (e) {
    console.error('openSettingsWindow error', e);
    alert('打开设置失败: ' + String(e));
  }
}

export default App;
