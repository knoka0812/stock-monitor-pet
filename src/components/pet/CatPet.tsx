import type { PetSkin } from '../../types';

interface CatPetProps {
  size: number;
  mood: 'up' | 'down' | 'neutral' | 'alert';
  skin: PetSkin;
  customAsset?: string | null;
}

const SKIN_COLORS: Record<PetSkin, { body: string; belly: string; stripe: string }> = {
  orange_cat: { body: '#FF9F43', belly: '#FFEAA7', stripe: '#E17055' },
  gray_cat: { body: '#B2BEC3', belly: '#DFE6E9', stripe: '#636E72' },
  calico_cat: { body: '#FDCB6E', belly: '#FFF9E6', stripe: '#E17055' },
  custom: { body: '#FF9F43', belly: '#FFEAA7', stripe: '#E17055' },
};

export default function CatPet({ size, mood, skin, customAsset }: CatPetProps) {
  if (skin === 'custom' && customAsset) {
    return (
      <img
        src={customAsset}
        width={size}
        height={size}
        alt="pet"
        style={{ display: 'block', imageRendering: 'auto' }}
        draggable={false}
      />
    );
  }

  const colors = SKIN_COLORS[skin];
  const isUp = mood === 'up';
  const isDown = mood === 'down';
  const isAlert = mood === 'alert';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      style={{ display: 'block' }}
    >
      {/* 尾巴 */}
      <path
        d={isUp ? 'M20 90 Q5 80 15 65 Q25 55 20 70' : 'M20 90 Q0 95 10 100 Q20 105 25 95'}
        fill="none"
        stroke={colors.body}
        strokeWidth="8"
        strokeLinecap="round"
      />

      {/* 身体 */}
      <ellipse cx="60" cy="85" rx="38" ry="28" fill={colors.body} />
      <ellipse cx="60" cy="92" rx="26" ry="16" fill={colors.belly} />

      {/* 头 */}
      <circle cx="60" cy="55" r="32" fill={colors.body} />

      {/* 耳朵 */}
      <polygon points="32,30 40,8 52,26" fill={colors.body} />
      <polygon points="36,26 42,14 48,24" fill={colors.belly} />
      <polygon points="88,30 80,8 68,26" fill={colors.body} />
      <polygon points="84,26 78,14 72,24" fill={colors.belly} />

      {/* 条纹 */}
      <path
        d="M45 35 Q50 28 55 35"
        fill="none"
        stroke={colors.stripe}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M65 35 Q70 28 75 35"
        fill="none"
        stroke={colors.stripe}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* 眼睛 */}
      {isDown ? (
        <>
          <path d="M44 52 Q48 56 52 52" fill="none" stroke="#2D3436" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M68 52 Q72 56 76 52" fill="none" stroke="#2D3436" strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : isAlert ? (
        <>
          <circle cx="48" cy="54" r="5" fill="#2D3436" />
          <circle cx="72" cy="54" r="5" fill="#2D3436" />
          <circle cx="49" cy="52" r="1.5" fill="white" />
          <circle cx="73" cy="52" r="1.5" fill="white" />
        </>
      ) : mood === 'neutral' ? (
        <>
          <path d="M43 54 L53 54" stroke="#2D3436" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M67 54 L77 54" stroke="#2D3436" strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M44 53 Q48 49 52 53 Q48 57 44 53" fill="#2D3436" />
          <path d="M68 53 Q72 49 76 53 Q72 57 68 53" fill="#2D3436" />
          <circle cx="49" cy="51" r="1" fill="white" />
          <circle cx="73" cy="51" r="1" fill="white" />
        </>
      )}

      {/* 腮红 */}
      {isUp && (
        <>
          <circle cx="40" cy="63" r="4" fill="#FAB1A0" opacity="0.6" />
          <circle cx="80" cy="63" r="4" fill="#FAB1A0" opacity="0.6" />
        </>
      )}

      {/* 鼻子 */}
      <polygon points="57,62 63,62 60,66" fill="#E17055" />

      {/* 嘴 */}
      {isUp ? (
        <path d="M54 68 Q60 74 66 68" fill="none" stroke="#2D3436" strokeWidth="2" strokeLinecap="round" />
      ) : isDown ? (
        <path d="M54 71 Q60 65 66 71" fill="none" stroke="#2D3436" strokeWidth="2" strokeLinecap="round" />
      ) : isAlert ? (
        <ellipse cx="60" cy="70" rx="3" ry="4" fill="#2D3436" />
      ) : (
        <path d="M55 69 Q60 71 65 69" fill="none" stroke="#2D3436" strokeWidth="2" strokeLinecap="round" />
      )}

      {/* 胡须 */}
      <line x1="25" y1="64" x2="42" y2="66" stroke="#2D3436" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="25" y1="70" x2="42" y2="69" stroke="#2D3436" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="78" y1="66" x2="95" y2="64" stroke="#2D3436" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="78" y1="69" x2="95" y2="70" stroke="#2D3436" strokeWidth="1.5" strokeLinecap="round" />

      {/* 前爪 */}
      <ellipse cx="45" cy="108" rx="8" ry="5" fill={colors.body} />
      <ellipse cx="75" cy="108" rx="8" ry="5" fill={colors.body} />

      {/* 提醒时的惊叹号 */}
      {isAlert && (
        <g>
          <circle cx="95" cy="25" r="14" fill="#E74C3C" />
          <text x="95" y="22" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">!</text>
        </g>
      )}
    </svg>
  );
}
