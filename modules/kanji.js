// kanji.js — Japanese elemental kanji system + texture generation
import { KI } from './core.js';

export const KANJI = {
  ah: { char: '火', name: 'Fire', reading: 'HI', color: '#ff4444', hex: 0xff4444, blast: 'kamehameha' },
  ee: { char: '雷', name: 'Lightning', reading: 'RAI', color: '#ffdd00', hex: 0xffdd00, blast: 'finalflash' },
  oh: { char: '気', name: 'Spirit', reading: 'KI', color: '#ffffff', hex: 0xffffff, blast: 'spiritbomb' },
  oo: { char: '水', name: 'Water', reading: 'SUI', color: '#aa44ff', hex: 0xaa44ff, blast: 'galickgun' },
  eh: { char: '風', name: 'Wind', reading: 'FŪ', color: '#ff8844', hex: 0xff8844, blast: 'barrage' },
  mm: { char: '土', name: 'Earth', reading: 'DO', color: '#44ffaa', hex: 0x44ffaa, blast: 'kiball' }
};

export const PHONEMES = {
  ah: { label: 'AH', color: '#ff4444', hex: 0xff4444, power: 0 },
  ee: { label: 'EE', color: '#ffdd00', hex: 0xffdd00, power: 0 },
  oh: { label: 'OH', color: '#ffffff', hex: 0xffffff, power: 0 },
  oo: { label: 'OO', color: '#aa44ff', hex: 0xaa44ff, power: 0 },
  eh: { label: 'EH', color: '#ff8844', hex: 0xff8844, power: 0 },
  mm: { label: 'MM', color: '#44ffaa', hex: 0x44ffaa, power: 0 }
};

export const PH_KEYS = Object.keys(PHONEMES);
export const kanjiTextures = {};
export const kanjiGlowTextures = {};

export function init() {
  // generate textures
  Object.keys(KANJI).forEach(k => {
    const kj = KANJI[k];
    // main texture
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const x = c.getContext('2d');
    x.shadowColor = kj.color; x.shadowBlur = 40;
    x.fillStyle = kj.color; x.font = 'bold 150px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(kj.char, 128, 128);
    x.shadowBlur = 0; x.fillStyle = '#fff'; x.fillText(kj.char, 128, 128);
    kanjiTextures[k] = new THREE.CanvasTexture(c);

    // glow texture
    const g = document.createElement('canvas'); g.width = 128; g.height = 128;
    const gx = g.getContext('2d');
    gx.shadowColor = kj.color; gx.shadowBlur = 30;
    gx.fillStyle = kj.color; gx.font = 'bold 80px serif'; gx.textAlign = 'center'; gx.textBaseline = 'middle';
    gx.fillText(kj.char, 64, 64);
    kanjiGlowTextures[k] = new THREE.CanvasTexture(g);
  });

  KI.register('kanji', { KANJI, PHONEMES, PH_KEYS, kanjiTextures, kanjiGlowTextures });
  KI.emit('kanji:ready');
}
