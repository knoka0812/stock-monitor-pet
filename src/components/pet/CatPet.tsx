import alertAsset from '../../assets/pet/alert.png';
import downAsset from '../../assets/pet/down.png';
import neutralAsset from '../../assets/pet/neutral.png';
import upAsset from '../../assets/pet/up.png';
import dogAlertAsset from '../../assets/pet/dog-alert.png';
import dogDownAsset from '../../assets/pet/dog-down.png';
import dogNeutralAsset from '../../assets/pet/dog-neutral.png';
import dogUpAsset from '../../assets/pet/dog-up.png';
import type { PetSkin } from '../../types';

interface CatPetProps {
  size: number;
  mood: 'up' | 'down' | 'neutral' | 'alert';
  skin: PetSkin;
  customAsset?: string | null;
}

const DEFAULT_ASSETS = {
  neutral: neutralAsset,
  up: upAsset,
  down: downAsset,
  alert: alertAsset,
} as const;

const DOG_ASSETS = {
  neutral: dogNeutralAsset,
  up: dogUpAsset,
  down: dogDownAsset,
  alert: dogAlertAsset,
} as const;

export default function CatPet({ size, mood, skin, customAsset }: CatPetProps) {
  const assets = skin === 'dog' ? DOG_ASSETS : DEFAULT_ASSETS;
  const asset = skin === 'custom' && customAsset ? customAsset : assets[mood];

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
