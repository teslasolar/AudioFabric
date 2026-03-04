// ass-os/tags/index.js — Tag provider barrel export + init
import { KI } from '../../core.js';
import { TagProvider } from './provider.js';
import { defineSystemTags } from './definitions.js';

export const tags = new TagProvider('ASSOS');

export function init() {
  defineSystemTags(tags);
  KI.register('ass-os-tags', { update, getState: () => tags.stats() });
  KI.emit('ass-os-tags:ready', tags.stats());
}

function update(dt, t) {
  const v = KI.voice;
  tags.write('INPUT/ENERGY',    v.energy || 0);
  tags.write('INPUT/COHERENCE', v.coherence || 0);
  tags.write('INPUT/PITCH',     v.pn || 0);
  tags.write('INPUT/SOUNDING',  !!v.sounding);
  tags.write('INPUT/VOWEL',     v.vowel || '');
}
