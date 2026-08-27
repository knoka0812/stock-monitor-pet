import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import PetWindow from './components/pet/PetWindow';
import SettingsWindow from './components/settings/SettingsWindow';

function App() {
  const [mode, setMode] = useState<'pet' | 'settings'>('pet');
  const currentWindow = getCurrentWindow();

  useEffect(() => {
    setMode(currentWindow.label === 'settings' ? 'settings' : 'pet');
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
