import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import PetWindow from './components/pet/PetWindow';

function App() {
  useEffect(() => {
  }, []);

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
