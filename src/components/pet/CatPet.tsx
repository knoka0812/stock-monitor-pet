import alertAsset from '../../assets/pet/alert.png';
import downAsset from '../../assets/pet/down.png';
import neutralAsset from '../../assets/pet/neutral.png';
import upAsset from '../../assets/pet/up.png';
import type { PetSkin } from '../../types';

interface CatPetProps {
  size: number;
  mood: 'up' | 'down' | 'neutral' | 'alert';
  skin: PetSkin;
  customAsset?: string | null;
}

const MOOD_ASSETS = {
  neutral: neutralAsset,
  up: upAsset,
  down: downAsset,
  alert: alertAsset,
} as const;

export default function CatPet({ size, mood, skin, customAsset }: CatPetProps) {
  const asset = skin === 'custom' && customAsset ? customAsset : MOOD_ASSETS[mood];

  return (
    <img
      src={asset}
      width={size}
      height={size}
      alt=""
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        objectPosition: 'bottom',
      }}
      draggable={false}
    />
  );
}
