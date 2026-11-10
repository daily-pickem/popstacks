/**
 * PopStacks: Art Toy Atelier — Rich Game Music Synthesizer & ASMR Sound Engine
 * 100% Procedural Web Audio API Engine featuring:
 *  - Multi-instrument 96 BPM Cozy Atelier Game Soundtrack (Kalimba melody, Celesta chords, Pizzicato bass, Woodblock/Shaker groove)
 *  - Dynamic sidechain music ducking during 10-disc bursts & fanfares
 *  - Layered ASMR wood clacks, ascending C Major pentatonic marimba chimes, ceramic bubble pops, and Ollie character synth reactions
 *  - Tactile Haptics (navigator.vibrate + visual HUD indicator)
 */
(function () {
  'use strict';

  // C Major Pentatonic frequencies from C4 to E7
  const PENTATONIC_SCALE = [
    261.63,  // C4
    293.66,  // D4
    329.63,  // E4
    392.00,  // G4
    440.00,  // A4
    523.25,  // C5
    587.33,  // D5
    659.25,  // E5
    783.99,  // G5
    880.00,  // A5
    1046.50, // C6
    1174.66, // D6
    1318.51, // E6
    1567.98, // G6
    1760.00, // A6
    2093.00, // C7
    2349.32, // D7
    2637.02  // E7
  ];

  const TRANSFER_SCALE = PENTATONIC_SCALE.slice(5);

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function hashTrackSeed(str) {
    let h = 2166136261 >>> 0;
    const s = String(str || 'classic');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function createSeededRng(seed) {
    let a = seed >>> 0;
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 10 Series Musical Archetypes + Classic Studio Default
  const SERIES_MUSIC_ARCHETYPES = {
    classic: {
      seriesTitle: 'Studio Kalimba',
      instrumentLabel: 'Birch Kalimba & Celesta',
      baseMidi: 60, // C4
      baseBpm: 96,
      scaleIntervals: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24], // Major Pentatonic
      chordProgressions: [
        [0, 4, 7, 11, 14],
        [-3, 0, 4, 7, 12],
        [-7, 0, 5, 9, 12],
        [-5, 2, 5, 9, 11],
        [-3, 0, 4, 9, 12],
        [-7, -2, 2, 5, 9],
        [-5, 0, 4, 7, 12],
        [-5, -1, 2, 7, 11]
      ],
      leadWave: 'sine',
      overWave: 'triangle',
      overRatio: 2.0,
      overGain: 0.02,
      leadAttack: 0.006,
      leadDecaySteps: 2.6,
      padWave: 'triangle',
      bassWave: 'triangle',
      percPitchHigh: 880,
      percPitchLow: 680
    },
    'series-1': {
      seriesTitle: 'Forest Marimba & Flute',
      instrumentLabel: 'Botanical Woody Marimba',
      baseMidi: 65, // F4
      baseBpm: 96,
      scaleIntervals: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24], // Warm F Pentatonic
      chordProgressions: [
        [0, 4, 7, 9, 14],
        [-3, 0, 4, 7, 12],
        [-5, -1, 2, 7, 11],
        [-7, -3, 0, 4, 9],
        [2, 5, 9, 12, 16],
        [0, 4, 7, 11, 14],
        [-3, 0, 5, 9, 12],
        [-5, 0, 2, 7, 11]
      ],
      leadWave: 'sine',
      overWave: 'sine',
      overRatio: 3.0,
      overGain: 0.026,
      leadAttack: 0.005,
      leadDecaySteps: 2.4,
      padWave: 'sine',
      bassWave: 'triangle',
      percPitchHigh: 960,
      percPitchLow: 640
    },
    'series-2': {
      seriesTitle: 'Shrine Koto & Shamisen',
      instrumentLabel: 'Urushi Plucked Koto',
      baseMidi: 62, // D4
      baseBpm: 108,
      scaleIntervals: [0, 1, 5, 7, 8, 12, 13, 17, 19, 20, 24], // Japanese In-Sen / Miyako-bushi
      chordProgressions: [
        [0, 5, 7, 12, 13],
        [-2, 3, 7, 10, 12],
        [-4, 1, 5, 8, 12],
        [-5, 0, 5, 7, 12],
        [0, 7, 8, 12, 17],
        [-2, 5, 7, 10, 15],
        [-4, 0, 5, 8, 13],
        [-5, 1, 5, 7, 12]
      ],
      leadWave: 'sawtooth',
      overWave: 'triangle',
      overRatio: 2.0,
      overGain: 0.022,
      leadAttack: 0.002,
      leadDecaySteps: 1.5,
      padWave: 'sine',
      bassWave: 'triangle',
      percPitchHigh: 1220,
      percPitchLow: 480
    },
    'series-3': {
      seriesTitle: 'Nebula Synth & Starlight Arp',
      instrumentLabel: 'Cosmic Lydian Bell-Synth',
      baseMidi: 60, // C4
      baseBpm: 118,
      scaleIntervals: [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18, 19], // Lydian Cosmic Scale
      chordProgressions: [
        [0, 4, 7, 11, 18],
        [2, 6, 9, 14, 18],
        [-3, 0, 4, 7, 11],
        [-1, 2, 6, 9, 14],
        [4, 7, 11, 14, 18],
        [2, 6, 9, 13, 16],
        [0, 4, 7, 11, 16],
        [-2, 2, 6, 9, 14]
      ],
      leadWave: 'square',
      overWave: 'sine',
      overRatio: 4.0,
      overGain: 0.028,
      leadAttack: 0.008,
      leadDecaySteps: 2.8,
      padWave: 'triangle',
      bassWave: 'sawtooth',
      percPitchHigh: 1580,
      percPitchLow: 990
    },
    'series-4': {
      seriesTitle: 'Tea House Lo-Fi Rhodes',
      instrumentLabel: 'Matcha Electric Piano & Chime',
      baseMidi: 63, // Eb4
      baseBpm: 82,
      scaleIntervals: [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17, 19], // Dorian Jazz Scale
      chordProgressions: [
        [0, 3, 7, 10, 14],
        [-4, 0, 3, 7, 10],
        [-2, 2, 5, 9, 12],
        [-5, -1, 2, 5, 9],
        [3, 7, 10, 14, 17],
        [0, 3, 7, 9, 14],
        [-2, 1, 5, 8, 12],
        [-5, 0, 2, 7, 10]
      ],
      leadWave: 'sine',
      overWave: 'triangle',
      overRatio: 2.0,
      overGain: 0.018,
      leadAttack: 0.015,
      leadDecaySteps: 3.6,
      padWave: 'triangle',
      bassWave: 'sine',
      percPitchHigh: 620,
      percPitchLow: 420
    },
    'series-5': {
      seriesTitle: 'Canyon Handpan & Clay Drum',
      instrumentLabel: 'Sunstone Caravan Handpan',
      baseMidi: 62, // D4
      baseBpm: 104,
      scaleIntervals: [0, 1, 4, 5, 7, 8, 10, 12, 13, 16, 17, 19], // Phrygian Dominant / Hijaz Canyon
      chordProgressions: [
        [0, 4, 7, 10, 12],
        [1, 5, 8, 12, 13],
        [-2, 1, 5, 7, 10],
        [0, 4, 7, 12, 16],
        [5, 8, 12, 13, 17],
        [0, 4, 7, 10, 16],
        [-2, 2, 5, 8, 12],
        [0, 4, 7, 10, 12]
      ],
      leadWave: 'triangle',
      overWave: 'sine',
      overRatio: 2.98,
      overGain: 0.028,
      leadAttack: 0.004,
      leadDecaySteps: 2.4,
      padWave: 'sine',
      bassWave: 'triangle',
      percPitchHigh: 520,
      percPitchLow: 280
    },
    'series-6': {
      seriesTitle: 'Nocturne Music-Box Waltz',
      instrumentLabel: 'Velvet Celesta & Harp',
      baseMidi: 57, // A3
      baseBpm: 92,
      scaleIntervals: [0, 2, 3, 5, 7, 8, 11, 12, 14, 15, 19, 20, 23], // Harmonic Minor
      chordProgressions: [
        [0, 3, 7, 12, 15],
        [-4, 0, 3, 8, 12],
        [-7, -2, 2, 5, 8],
        [-5, -1, 2, 7, 11],
        [3, 7, 12, 15, 19],
        [0, 5, 8, 12, 17],
        [-4, 2, 5, 8, 14],
        [-1, 2, 7, 11, 14]
      ],
      leadWave: 'sine',
      overWave: 'sine',
      overRatio: 4.0,
      overGain: 0.032,
      leadAttack: 0.003,
      leadDecaySteps: 3.2,
      padWave: 'triangle',
      bassWave: 'triangle',
      percPitchHigh: 1380,
      percPitchLow: 980
    },
    'series-7': {
      seriesTitle: 'Clockwork Toyshop Harpsichord',
      instrumentLabel: 'Brass Spinet & Escapement',
      baseMidi: 67, // G4
      baseBpm: 120,
      scaleIntervals: [0, 2, 4, 5, 7, 9, 10, 12, 14, 16, 17, 19], // Mixolydian Clockwork
      chordProgressions: [
        [0, 4, 7, 10, 14],
        [-2, 2, 5, 9, 12],
        [-4, 0, 3, 7, 10],
        [-5, -1, 2, 7, 12],
        [2, 5, 9, 12, 16],
        [0, 4, 7, 12, 16],
        [-2, 2, 5, 10, 14],
        [-5, 0, 2, 7, 11]
      ],
      leadWave: 'sawtooth',
      overWave: 'square',
      overRatio: 2.0,
      overGain: 0.018,
      leadAttack: 0.002,
      leadDecaySteps: 1.4,
      padWave: 'triangle',
      bassWave: 'sawtooth',
      percPitchHigh: 1660,
      percPitchLow: 1180
    },
    'series-8': {
      seriesTitle: 'Lagoon Steelpan & Pearl Harp',
      instrumentLabel: 'Tropical Steel-Drum & Wave',
      baseMidi: 64, // E4
      baseBpm: 110,
      scaleIntervals: [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 19, 21], // Bright Island Major
      chordProgressions: [
        [0, 4, 7, 11, 14],
        [-3, 1, 4, 9, 12],
        [-5, -1, 2, 6, 9],
        [-7, -3, 0, 4, 7],
        [4, 7, 11, 14, 16],
        [2, 6, 9, 14, 18],
        [-3, 1, 4, 9, 13],
        [-5, 0, 2, 7, 11]
      ],
      leadWave: 'triangle',
      overWave: 'sine',
      overRatio: 2.99,
      overGain: 0.03,
      leadAttack: 0.004,
      leadDecaySteps: 2.5,
      padWave: 'sine',
      bassWave: 'sine',
      percPitchHigh: 820,
      percPitchLow: 580
    },
    'series-9': {
      seriesTitle: 'Origami Washi Glockenspiel',
      instrumentLabel: 'Crystal Paper-Chime & Koto',
      baseMidi: 66, // F#4
      baseBpm: 88,
      scaleIntervals: [0, 2, 5, 7, 9, 12, 14, 17, 19, 21, 24], // Japanese Yo Pentatonic
      chordProgressions: [
        [0, 5, 7, 12, 14],
        [-3, 2, 7, 9, 14],
        [-5, 0, 5, 7, 12],
        [-2, 2, 5, 9, 12],
        [2, 7, 9, 14, 17],
        [0, 5, 9, 12, 17],
        [-3, 2, 5, 9, 14],
        [-5, 0, 5, 7, 12]
      ],
      leadWave: 'sine',
      overWave: 'triangle',
      overRatio: 3.0,
      overGain: 0.024,
      leadAttack: 0.003,
      leadDecaySteps: 2.8,
      padWave: 'sine',
      bassWave: 'triangle',
      percPitchHigh: 1280,
      percPitchLow: 920
    },
    'series-10': {
      seriesTitle: 'Golden Vault Royal Carillon',
      instrumentLabel: '24K Gold Chimes & Fanfare',
      baseMidi: 60, // C4
      baseBpm: 112,
      scaleIntervals: [0, 2, 4, 5, 7, 8, 11, 12, 14, 16, 19, 20, 24], // Harmonic Major
      chordProgressions: [
        [0, 4, 7, 11, 14],
        [-4, 0, 3, 8, 12],
        [-5, -1, 2, 7, 11],
        [-2, 2, 5, 8, 14],
        [4, 7, 11, 16, 19],
        [0, 5, 8, 12, 17],
        [-4, 0, 5, 8, 14],
        [-5, -1, 2, 7, 14]
      ],
      leadWave: 'triangle',
      overWave: 'sawtooth',
      overRatio: 2.0,
      overGain: 0.025,
      leadAttack: 0.004,
      leadDecaySteps: 2.9,
      padWave: 'triangle',
      bassWave: 'triangle',
      percPitchHigh: 1440,
      percPitchLow: 1050
    }
  };

  // 6 distinct per-figurine arrangement styles inside each series
  const FIGURINE_ARRANGEMENT_STYLES = [
    {
      name: 'Flowing Marimba Wave',
      swing: 0,
      hasCounterHarmony: true,
      arpMode: true,
      waltzFeel: false,
      arpStepMask: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1],
      arpVoicePattern: [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 3, 2, 1, 3, 2],
      drumPattern: [1, 0, 3, 0, 2, 0, 3, 0, 1, 0, 3, 0, 2, 0, 3, 1]
    },
    {
      name: 'Shimmering 16th Cascade',
      swing: 0,
      hasCounterHarmony: true,
      arpMode: true,
      waltzFeel: false,
      arpStepMask: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      arpVoicePattern: [0, 2, 1, 3, 2, 4, 3, 1, 0, 2, 3, 4, 2, 3, 1, 2],
      drumPattern: [1, 0, 3, 0, 2, 0, 3, 0, 1, 0, 3, 0, 2, 0, 3, 3]
    },
    {
      name: 'Music-Box Waltz Duet',
      swing: 0,
      hasCounterHarmony: true,
      arpMode: true,
      waltzFeel: true,
      arpStepMask: [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0],
      arpVoicePattern: [0, 1, 2, 4, 2, 1, 0, 2, 3, 4, 2, 1, 0, 2, 4, 2],
      drumPattern: [1, 0, 3, 0, 0, 3, 2, 0, 3, 0, 0, 3, 2, 0, 3, 0]
    },
    {
      name: 'Swung Lo-Fi Focus Pocket',
      swing: 0.022,
      hasCounterHarmony: true,
      arpMode: true,
      waltzFeel: false,
      arpStepMask: [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1],
      arpVoicePattern: [0, 3, 1, 4, 2, 3, 1, 2, 0, 4, 2, 3, 1, 4, 2, 1],
      drumPattern: [1, 0, 0, 3, 2, 0, 3, 1, 0, 3, 1, 0, 2, 0, 3, 0]
    },
    {
      name: 'Hypnotic Glass Ostinato',
      swing: 0,
      hasCounterHarmony: true,
      arpMode: true,
      waltzFeel: false,
      arpStepMask: [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
      arpVoicePattern: [0, 1, 2, 0, 1, 3, 2, 1, 0, 2, 4, 2, 1, 3, 4, 2],
      drumPattern: [1, 3, 2, 3, 1, 0, 2, 3, 1, 3, 2, 0, 1, 2, 3, 2]
    },
    {
      name: 'Grand Virtuoso Symphony',
      swing: 0.012,
      hasCounterHarmony: true,
      arpMode: true,
      waltzFeel: false,
      arpStepMask: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      arpVoicePattern: [0, 2, 4, 1, 3, 4, 2, 0, 1, 3, 4, 2, 4, 3, 2, 1],
      drumPattern: [1, 0, 3, 1, 2, 0, 1, 3, 1, 1, 3, 0, 2, 3, 1, 2]
    }
  ];

  // =========================================================================
  // 10 Series + Classic Theme-Specific Core Gameplay SFX Profiles
  // Each theme radically transforms Pickup, Magnetic Snap, Stack Place,
  // Disc-by-Disc Parabolic Transfer Chimes, 20ms Peel Ticks, 10-Disc Burst,
  // Obstacles (Frozen Clay), and Booster SFX!
  // =========================================================================
  const SERIES_SFX_PROFILES = {
    classic: {
      sfxLabel: 'Studio Birch & Matte Vinyl',
      pickup: { f1: 240, f2: 420, dur: 0.055, wave: 'triangle', sub1: 480, sub2: 680, subWave: 'sine', noiseHz: 0, noiseGain: 0 },
      snap: { f1: 820, f2: 410, dur: 0.024, wave: 'sine', ping1: 1240, ping2: 980, pingWave: 'triangle', doubleTick: false },
      place: { thump1: 195, thump2: 72, thumpDur: 0.09, thumpWave: 'sine', clack1: 560, clack2: 260, clackWave: 'triangle', ring1: 880, ring2: 440, ringWave: 'sine', noiseHz: 0, noiseGain: 0 },
      transfer: { wave: 'sine', dur: 0.26, gain: 0.19, overWave: 'triangle', overRatio: 4.0, overDur: 0.048, overGain: 0.05, shimRatio: 2.0, shimWave: 'sine', shimGain: 0.045, glide: 1.0 },
      peel: { baseHz: 440, spanHz: 560, glide: 1.72, wave: 'sine', overWave: 'triangle', overRatio: 1.5, dur: 0.032 },
      burst: { boom1: 140, boom2: 48, boomWave: 'sine', pop1: 320, pop2: 1240, popDur: 0.08, popWave: 'sine', filterType: 'bandpass', noiseHz1: 1950, noiseHz2: 1950, noiseQ: 3.0, noiseDur: 0.045, noiseGain: 0.17, chordWave: 'sine', chordOverWave: 'triangle', chordStagger: 0.03 }
    },
    'series-1': {
      sfxLabel: 'Carved Rosewood, Bamboo & Leaf Rustle',
      pickup: { f1: 280, f2: 520, dur: 0.06, wave: 'sine', sub1: 840, sub2: 1260, subWave: 'sine', noiseHz: 2600, noiseGain: 0.045 },
      snap: { f1: 740, f2: 510, dur: 0.028, wave: 'sine', ping1: 1480, ping2: 1110, pingWave: 'sine', doubleTick: false },
      place: { thump1: 175, thump2: 68, thumpDur: 0.10, thumpWave: 'sine', clack1: 430, clack2: 290, clackWave: 'sine', ring1: 1290, ring2: 860, ringWave: 'sine', noiseHz: 1800, noiseGain: 0.04 },
      transfer: { wave: 'sine', dur: 0.28, gain: 0.20, overWave: 'sine', overRatio: 3.0, overDur: 0.065, overGain: 0.065, shimRatio: 2.0, shimWave: 'triangle', shimGain: 0.04, glide: 1.0 },
      peel: { baseHz: 390, spanHz: 520, glide: 1.45, wave: 'sine', overWave: 'sine', overRatio: 3.0, dur: 0.036 },
      burst: { boom1: 135, boom2: 52, boomWave: 'sine', pop1: 290, pop2: 980, popDur: 0.09, popWave: 'sine', filterType: 'bandpass', noiseHz1: 1400, noiseHz2: 3200, noiseQ: 2.2, noiseDur: 0.075, noiseGain: 0.15, chordWave: 'sine', chordOverWave: 'sine', chordStagger: 0.032 }
    },
    'series-2': {
      sfxLabel: 'Urushi Lacquer, Koto Pluck & Taiko Thump',
      pickup: { f1: 360, f2: 720, dur: 0.048, wave: 'sawtooth', sub1: 720, sub2: 1080, subWave: 'triangle', noiseHz: 3400, noiseGain: 0.04 },
      snap: { f1: 1360, f2: 920, dur: 0.02, wave: 'triangle', ping1: 2720, ping2: 1840, pingWave: 'sine', doubleTick: true },
      place: { thump1: 145, thump2: 46, thumpDur: 0.12, thumpWave: 'triangle', clack1: 920, clack2: 440, clackWave: 'sawtooth', ring1: 1840, ring2: 920, ringWave: 'triangle', noiseHz: 2900, noiseGain: 0.055 },
      transfer: { wave: 'sawtooth', dur: 0.22, gain: 0.13, overWave: 'triangle', overRatio: 2.0, overDur: 0.08, overGain: 0.07, shimRatio: 1.5, shimWave: 'sine', shimGain: 0.05, glide: 1.015 },
      peel: { baseHz: 520, spanHz: 680, glide: 1.25, wave: 'sawtooth', overWave: 'triangle', overRatio: 2.0, dur: 0.028 },
      burst: { boom1: 115, boom2: 38, boomWave: 'triangle', pop1: 440, pop2: 1560, popDur: 0.07, popWave: 'sawtooth', filterType: 'bandpass', noiseHz1: 2600, noiseHz2: 1200, noiseQ: 3.5, noiseDur: 0.06, noiseGain: 0.18, chordWave: 'sawtooth', chordOverWave: 'triangle', chordStagger: 0.024 }
    },
    'series-3': {
      sfxLabel: 'Cyber-Neon Plasma, Synth-Pad & Laser Lock',
      pickup: { f1: 180, f2: 880, dur: 0.075, wave: 'sawtooth', sub1: 360, sub2: 1760, subWave: 'square', noiseHz: 4200, noiseGain: 0.035 },
      snap: { f1: 1480, f2: 1960, dur: 0.026, wave: 'square', ping1: 2960, ping2: 3520, pingWave: 'sine', doubleTick: false },
      place: { thump1: 260, thump2: 42, thumpDur: 0.13, thumpWave: 'sawtooth', clack1: 1280, clack2: 320, clackWave: 'square', ring1: 1920, ring2: 2560, ringWave: 'sine', noiseHz: 3800, noiseGain: 0.045 },
      transfer: { wave: 'square', dur: 0.27, gain: 0.11, overWave: 'sine', overRatio: 4.0, overDur: 0.14, overGain: 0.07, shimRatio: 2.005, shimWave: 'sawtooth', shimGain: 0.038, glide: 1.03 },
      peel: { baseHz: 620, spanHz: 980, glide: 1.95, wave: 'square', overWave: 'sine', overRatio: 2.0, dur: 0.026 },
      burst: { boom1: 220, boom2: 34, boomWave: 'sawtooth', pop1: 240, pop2: 2200, popDur: 0.11, popWave: 'square', filterType: 'bandpass', noiseHz1: 900, noiseHz2: 4800, noiseQ: 4.0, noiseDur: 0.09, noiseGain: 0.16, chordWave: 'square', chordOverWave: 'sine', chordStagger: 0.026 }
    },
    'series-4': {
      sfxLabel: 'Raku Ceramic Glaze, Matcha Whisk & Rhodes Bell',
      pickup: { f1: 310, f2: 465, dur: 0.065, wave: 'sine', sub1: 620, sub2: 930, subWave: 'triangle', noiseHz: 2100, noiseGain: 0.03 },
      snap: { f1: 980, f2: 760, dur: 0.025, wave: 'sine', ping1: 1960, ping2: 1520, pingWave: 'sine', doubleTick: false },
      place: { thump1: 165, thump2: 64, thumpDur: 0.095, thumpWave: 'sine', clack1: 680, clack2: 510, clackWave: 'sine', ring1: 1360, ring2: 1360, ringWave: 'triangle', noiseHz: 2400, noiseGain: 0.03 },
      transfer: { wave: 'sine', dur: 0.34, gain: 0.18, overWave: 'triangle', overRatio: 2.0, overDur: 0.16, overGain: 0.06, shimRatio: 3.0, shimWave: 'sine', shimGain: 0.035, glide: 1.0 },
      peel: { baseHz: 480, spanHz: 480, glide: 1.38, wave: 'sine', overWave: 'triangle', overRatio: 2.0, dur: 0.035 },
      burst: { boom1: 130, boom2: 50, boomWave: 'sine', pop1: 380, pop2: 1120, popDur: 0.085, popWave: 'sine', filterType: 'bandpass', noiseHz1: 2200, noiseHz2: 1600, noiseQ: 2.5, noiseDur: 0.065, noiseGain: 0.14, chordWave: 'sine', chordOverWave: 'triangle', chordStagger: 0.036 }
    },
    'series-5': {
      sfxLabel: 'Chiseled Canyon Sandstone & Handpan Harmonic',
      pickup: { f1: 190, f2: 310, dur: 0.068, wave: 'triangle', sub1: 566, sub2: 920, subWave: 'sine', noiseHz: 1200, noiseGain: 0.06 },
      snap: { f1: 540, f2: 360, dur: 0.03, wave: 'triangle', ping1: 1610, ping2: 1072, pingWave: 'sine', doubleTick: false },
      place: { thump1: 128, thump2: 44, thumpDur: 0.125, thumpWave: 'triangle', clack1: 380, clack2: 190, clackWave: 'triangle', ring1: 760, ring2: 755, ringWave: 'sine', noiseHz: 1100, noiseGain: 0.075 },
      transfer: { wave: 'triangle', dur: 0.32, gain: 0.18, overWave: 'sine', overRatio: 2.98, overDur: 0.18, overGain: 0.075, shimRatio: 2.0, shimWave: 'sine', shimGain: 0.05, glide: 0.996 },
      peel: { baseHz: 340, spanHz: 460, glide: 1.32, wave: 'triangle', overWave: 'sine', overRatio: 2.98, dur: 0.036 },
      burst: { boom1: 108, boom2: 36, boomWave: 'triangle', pop1: 240, pop2: 860, popDur: 0.095, popWave: 'triangle', filterType: 'lowpass', noiseHz1: 1400, noiseHz2: 520, noiseQ: 2.0, noiseDur: 0.08, noiseGain: 0.20, chordWave: 'triangle', chordOverWave: 'sine', chordStagger: 0.032 }
    },
    'series-6': {
      sfxLabel: 'Gothic Stained-Glass, Celesta & Velvet Harp',
      pickup: { f1: 420, f2: 840, dur: 0.065, wave: 'sine', sub1: 1680, sub2: 2520, subWave: 'sine', noiseHz: 4800, noiseGain: 0.025 },
      snap: { f1: 1560, f2: 1170, dur: 0.028, wave: 'sine', ping1: 3120, ping2: 2340, pingWave: 'sine', doubleTick: false },
      place: { thump1: 150, thump2: 55, thumpDur: 0.10, thumpWave: 'sine', clack1: 880, clack2: 660, clackWave: 'sine', ring1: 2640, ring2: 1760, ringWave: 'sine', noiseHz: 4200, noiseGain: 0.035 },
      transfer: { wave: 'sine', dur: 0.35, gain: 0.17, overWave: 'sine', overRatio: 4.0, overDur: 0.18, overGain: 0.07, shimRatio: 1.5, shimWave: 'triangle', shimGain: 0.045, glide: 1.0 },
      peel: { baseHz: 580, spanHz: 780, glide: 1.55, wave: 'sine', overWave: 'sine', overRatio: 4.0, dur: 0.032 },
      burst: { boom1: 125, boom2: 45, boomWave: 'sine', pop1: 520, pop2: 1960, popDur: 0.09, popWave: 'sine', filterType: 'highpass', noiseHz1: 3200, noiseHz2: 5400, noiseQ: 3.2, noiseDur: 0.07, noiseGain: 0.14, chordWave: 'sine', chordOverWave: 'sine', chordStagger: 0.034 }
    },
    'series-7': {
      sfxLabel: 'Clockwork Brass Gear, Escapement & Spinet',
      pickup: { f1: 520, f2: 780, dur: 0.042, wave: 'sawtooth', sub1: 1040, sub2: 1560, subWave: 'square', noiseHz: 3600, noiseGain: 0.05 },
      snap: { f1: 1680, f2: 1120, dur: 0.018, wave: 'square', ping1: 2240, ping2: 1680, pingWave: 'sawtooth', doubleTick: true },
      place: { thump1: 210, thump2: 65, thumpDur: 0.085, thumpWave: 'triangle', clack1: 1180, clack2: 590, clackWave: 'square', ring1: 1770, ring2: 885, ringWave: 'sawtooth', noiseHz: 3200, noiseGain: 0.06 },
      transfer: { wave: 'sawtooth', dur: 0.21, gain: 0.12, overWave: 'square', overRatio: 2.0, overDur: 0.06, overGain: 0.045, shimRatio: 3.0, shimWave: 'triangle', shimGain: 0.04, glide: 1.0 },
      peel: { baseHz: 680, spanHz: 720, glide: 1.18, wave: 'square', overWave: 'sawtooth', overRatio: 2.0, dur: 0.022 },
      burst: { boom1: 155, boom2: 48, boomWave: 'triangle', pop1: 480, pop2: 1680, popDur: 0.075, popWave: 'sawtooth', filterType: 'bandpass', noiseHz1: 2800, noiseHz2: 950, noiseQ: 2.4, noiseDur: 0.085, noiseGain: 0.18, chordWave: 'sawtooth', chordOverWave: 'triangle', chordStagger: 0.025 }
    },
    'series-8': {
      sfxLabel: 'Lagoon Hydro-Bubble, Sea-Glass & Steelpan',
      pickup: { f1: 220, f2: 680, dur: 0.07, wave: 'sine', sub1: 440, sub2: 1360, subWave: 'sine', noiseHz: 1600, noiseGain: 0.035 },
      snap: { f1: 640, f2: 1180, dur: 0.028, wave: 'sine', ping1: 1280, ping2: 1920, pingWave: 'triangle', doubleTick: false },
      place: { thump1: 160, thump2: 75, thumpDur: 0.10, thumpWave: 'sine', clack1: 380, clack2: 860, clackWave: 'sine', ring1: 1140, ring2: 1710, ringWave: 'triangle', noiseHz: 1500, noiseGain: 0.045 },
      transfer: { wave: 'triangle', dur: 0.29, gain: 0.18, overWave: 'sine', overRatio: 2.99, overDur: 0.13, overGain: 0.07, shimRatio: 2.0, shimWave: 'sine', shimGain: 0.05, glide: 1.018 },
      peel: { baseHz: 380, spanHz: 660, glide: 2.05, wave: 'sine', overWave: 'sine', overRatio: 2.99, dur: 0.034 },
      burst: { boom1: 130, boom2: 54, boomWave: 'sine', pop1: 260, pop2: 1640, popDur: 0.095, popWave: 'sine', filterType: 'bandpass', noiseHz1: 800, noiseHz2: 2800, noiseQ: 3.6, noiseDur: 0.08, noiseGain: 0.16, chordWave: 'triangle', chordOverWave: 'sine', chordStagger: 0.028 }
    },
    'series-9': {
      sfxLabel: 'Folded Washi Paper Crease & Crystal Glass Marimba',
      pickup: { f1: 480, f2: 760, dur: 0.045, wave: 'sine', sub1: 1440, sub2: 2280, subWave: 'triangle', noiseHz: 3900, noiseGain: 0.065 },
      snap: { f1: 1420, f2: 960, dur: 0.02, wave: 'sine', ping1: 2840, ping2: 1920, pingWave: 'sine', doubleTick: false },
      place: { thump1: 210, thump2: 84, thumpDur: 0.08, thumpWave: 'sine', clack1: 940, clack2: 470, clackWave: 'triangle', ring1: 1880, ring2: 1410, ringWave: 'sine', noiseHz: 3600, noiseGain: 0.07 },
      transfer: { wave: 'sine', dur: 0.30, gain: 0.18, overWave: 'triangle', overRatio: 3.0, overDur: 0.11, overGain: 0.06, shimRatio: 2.0, shimWave: 'sine', shimGain: 0.045, glide: 1.0 },
      peel: { baseHz: 560, spanHz: 640, glide: 1.48, wave: 'sine', overWave: 'triangle', overRatio: 3.0, dur: 0.026 },
      burst: { boom1: 150, boom2: 58, boomWave: 'sine', pop1: 420, pop2: 1480, popDur: 0.075, popWave: 'sine', filterType: 'highpass', noiseHz1: 2900, noiseHz2: 4600, noiseQ: 2.6, noiseDur: 0.055, noiseGain: 0.17, chordWave: 'sine', chordOverWave: 'triangle', chordStagger: 0.028 }
    },
    'series-10': {
      sfxLabel: '24K Gold Bullion Gong, Diamond Chime & Royal Harp',
      pickup: { f1: 330, f2: 660, dur: 0.07, wave: 'triangle', sub1: 990, sub2: 1980, subWave: 'sine', noiseHz: 5200, noiseGain: 0.03 },
      snap: { f1: 1320, f2: 1760, dur: 0.028, wave: 'triangle', ping1: 2640, ping2: 3520, pingWave: 'sine', doubleTick: false },
      place: { thump1: 140, thump2: 48, thumpDur: 0.12, thumpWave: 'triangle', clack1: 880, clack2: 440, clackWave: 'triangle', ring1: 1760, ring2: 2640, ringWave: 'sine', noiseHz: 4800, noiseGain: 0.04 },
      transfer: { wave: 'triangle', dur: 0.36, gain: 0.18, overWave: 'sine', overRatio: 2.0, overDur: 0.22, overGain: 0.075, shimRatio: 3.0, shimWave: 'sine', shimGain: 0.055, glide: 1.003 },
      peel: { baseHz: 523.25, spanHz: 820, glide: 1.65, wave: 'triangle', overWave: 'sine', overRatio: 2.0, dur: 0.034 },
      burst: { boom1: 118, boom2: 42, boomWave: 'triangle', pop1: 392, pop2: 1975, popDur: 0.10, popWave: 'triangle', filterType: 'bandpass', noiseHz1: 3600, noiseHz2: 5200, noiseQ: 3.4, noiseDur: 0.075, noiseGain: 0.16, chordWave: 'triangle', chordOverWave: 'sine', chordStagger: 0.03 }
    }
  };

  /**
   * Builds a unique, deterministic 256-step (16-bar, 4-movement A-A'-B-C) continuous looping
   * focus soundtrack themed to any of the 60 figurines (or 'classic' when no figurine is equipped).
   */
  function buildFigurineMusicTrack(figOrId) {
    let figId = 'classic';
    let seriesId = 'classic';
    let indexInSeries = 1;
    let figName = 'Classic Studio Birch';

    if (figOrId && typeof figOrId === 'object') {
      figId = figOrId.id || 'fig-01';
      seriesId = figOrId.seriesId || 'series-1';
      indexInSeries = figOrId.indexInSeries || 1;
      figName = figOrId.name || figId;
    } else if (typeof figOrId === 'string' && figOrId !== 'classic') {
      figId = figOrId;
      const num = Math.max(1, Math.min(60, parseInt(figId.replace('fig-', ''), 10) || 1));
      const sIdx = Math.ceil(num / 6);
      seriesId = `series-${sIdx}`;
      indexInSeries = ((num - 1) % 6) + 1;
      if (
        typeof window !== 'undefined' &&
        window.PopStacksCatalog &&
        typeof window.PopStacksCatalog.getFigurineById === 'function'
      ) {
        try {
          const found = window.PopStacksCatalog.getFigurineById(figId);
          if (found) {
            figName = found.name;
            seriesId = found.seriesId;
            indexInSeries = found.indexInSeries;
          }
        } catch (_e) {}
      }
    }

    const arch = SERIES_MUSIC_ARCHETYPES[seriesId] || SERIES_MUSIC_ARCHETYPES['series-1'];
    const fIdx = figId === 'classic' ? 0 : Math.max(0, Math.min(5, (indexInSeries || 1) - 1));
    const style = FIGURINE_ARRANGEMENT_STYLES[fIdx];

    // Distinct per-figurine transposition, tempo, waveform & harmonic character
    const semitoneOffsets = [0, 2, -2, 5, -4, 7];
    const bpmOffsets = [-4, 0, -6, -8, 2, 6];
    const leadWaveOverrides = [
      arch.leadWave,
      'triangle',
      'sine',
      arch.leadWave === 'sine' ? 'triangle' : 'sine',
      arch.leadWave === 'sawtooth' ? 'triangle' : arch.leadWave,
      arch.leadWave
    ];
    const rootMidi = arch.baseMidi + (figId === 'classic' ? 0 : semitoneOffsets[fIdx]);
    const bpm = Math.max(76, Math.min(118, arch.baseBpm + (figId === 'classic' ? 0 : bpmOffsets[fIdx])));
    const rng = createSeededRng(hashTrackSeed(`${figId}-${seriesId}-${indexInSeries}-focus-v3`));

    // 16-Bar Progression across 4 movements:
    // Bars 0..3 (A: Main Theme), Bars 4..7 (A': Development), Bars 8..11 (B: Soaring Bridge), Bars 12..15 (C: Resolution)
    const baseProgs = arch.chordProgressions || SERIES_MUSIC_ARCHETYPES.classic.chordProgressions;
    const sixteenBarProgIndices = [
      0, 1, 2, 3, // Movement I (A)
      0, 2, 1, 3, // Movement II (A')
      4, 5, 6, 7, // Movement III (B - Bridge)
      4, 6, 2, 3  // Movement IV (C - Luminous Resolution)
    ];

    const chordBars = sixteenBarProgIndices.map((pIdx, barIdx) => {
      const prog = baseProgs[pIdx % baseProgs.length];
      const voShift = barIdx >= 8 && barIdx < 12 ? 12 : 0;
      return prog.map((interval, vIdx) =>
        midiToFreq(rootMidi - 12 + interval + (vIdx >= 3 ? voShift : 0))
      );
    });

    // 16-Bar Warm Sustained Basslines
    const bassRhythmPatterns = [
      [0, 4, 8, 12, 14],
      [0, 3, 6, 8, 11, 14],
      [0, 6, 10, 12],
      [0, 3, 7, 8, 12, 14],
      [0, 4, 6, 8, 12, 14],
      [0, 3, 6, 8, 10, 12, 14]
    ];
    const bassStepsActive = bassRhythmPatterns[fIdx];
    const bassBars = sixteenBarProgIndices.map((pIdx) => {
      const prog = baseProgs[pIdx % baseProgs.length];
      const rootNote = rootMidi - 24 + prog[0];
      const fifthNote = rootNote + 7;
      const octaveNote = rootNote + 12;
      const thirdNote = rootNote + (prog[1] - prog[0]);
      const row = new Array(16).fill(0);
      bassStepsActive.forEach((st, idx) => {
        const choices = [rootNote, fifthNote, octaveNote, thirdNote];
        const midi = idx === 0 || st === 8 ? rootNote : choices[idx % choices.length];
        row[st] = midiToFreq(midi);
      });
      return row;
    });

    // 256-Step Long-Form Singing Melody + Note Durations + Continuous Focus Arpeggiator + Counter-Harmony
    const scale = arch.scaleIntervals;
    const totalSteps = 256;
    const melodySteps = new Array(totalSteps).fill(0);
    const melodyDurSteps = new Array(totalSteps).fill(0);
    const harmonySteps = new Array(totalSteps).fill(0);
    const arpSteps = new Array(totalSteps).fill(0);

    // Distinct melodic rhythm templates per movement so the 16 bars evolve organically
    const movementStepTemplates = [
      // Movement I (Bars 0-3): Lyrical, breathing theme with long sustained notes
      [
        { step: 0, dur: 4 },
        { step: 4, dur: 2 },
        { step: 6, dur: 3 },
        { step: 10, dur: 2 },
        { step: 12, dur: 4 }
      ],
      // Movement II (Bars 4-7): Flowing ornamental variation
      [
        { step: 0, dur: 3 },
        { step: 3, dur: 2 },
        { step: 6, dur: 2 },
        { step: 8, dur: 4 },
        { step: 12, dur: 2 },
        { step: 14, dur: 2 }
      ],
      // Movement III (Bars 8-11): Soaring emotional bridge with expressive held notes
      [
        { step: 0, dur: 6 },
        { step: 6, dur: 2 },
        { step: 8, dur: 4 },
        { step: 12, dur: 4 }
      ],
      // Movement IV (Bars 12-15): Meditative resolution cadence
      [
        { step: 0, dur: 4 },
        { step: 4, dur: 4 },
        { step: 8, dur: 3 },
        { step: 11, dur: 2 },
        { step: 14, dur: 2 }
      ]
    ];

    // Establish a memorable 5-note signature motif for this specific figurine
    const motifDegrees = [];
    let seedDeg = (fIdx * 2 + 1) % Math.min(6, scale.length);
    for (let m = 0; m < 6; m++) {
      motifDegrees.push(seedDeg);
      const stepChoice = [1, 2, -1, 2, -2, 1][(m + fIdx) % 6];
      seedDeg = Math.max(0, Math.min(scale.length - 2, seedDeg + stepChoice));
    }

    let degIdx = motifDegrees[0];
    for (let bar = 0; bar < 16; bar++) {
      const movementIdx = Math.floor(bar / 4);
      const barInMov = bar % 4;
      const phrase = movementStepTemplates[(movementIdx + (fIdx % 2)) % movementStepTemplates.length];
      const chord = chordBars[bar] || chordBars[0];

      // 1. Populate continuous hypnotic Focus Arpeggiator (`arpSteps`) for every bar
      const mask = style.arpStepMask || [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
      const voicePat = style.arpVoicePattern || [0, 1, 2, 3, 4, 3, 2, 1];
      for (let st = 0; st < 16; st++) {
        if (mask[st % mask.length]) {
          const vIdx = (voicePat[(st + bar) % voicePat.length] + fIdx) % chord.length;
          const baseFreq = chord[vIdx];
          const octMult = st % 4 === 2 && movementIdx >= 1 ? 4 : 2;
          arpSteps[bar * 16 + st] = baseFreq * octMult;
        }
      }

      // 2. Populate Legato Lead Melody & Counter-Harmony
      for (let i = 0; i < phrase.length; i++) {
        const { step: stepInBar, dur } = phrase[i];
        // On Bar 3, 7, 11, 15 let the final note breathe and resolve cleanly
        if (barInMov === 3 && i === phrase.length - 1 && dur < 4) {
          continue;
        }

        if (barInMov === 0 && i < 3) {
          // Anchor each 4-bar movement with the figurine's recognizable signature motif
          degIdx = motifDegrees[(i + movementIdx) % motifDegrees.length];
        } else if (barInMov === 3 && i >= phrase.length - 2) {
          // Cadential resolution toward tonic or fifth at the end of a 4-bar phrase
          degIdx = bar === 15 ? 0 : i === phrase.length - 1 ? 2 : 4;
        } else {
          const deltaPool =
            movementIdx === 2 ? [-1, 1, 2, 2, -2] : [-2, -1, 1, 1, 2];
          const delta = deltaPool[Math.floor(rng() * deltaPool.length)];
          degIdx = Math.max(0, Math.min(scale.length - 1, degIdx + delta));
        }

        const registerBoost = movementIdx === 2 && i <= 2 ? 12 : 0;
        const midi = rootMidi + scale[degIdx] + registerBoost;
        const absStep = bar * 16 + stepInBar;
        melodySteps[absStep] = midiToFreq(midi);
        melodyDurSteps[absStep] = barInMov === 3 && i === phrase.length - 2 ? Math.max(dur, 5) : dur;

        // Warm 3rd/6th Counter-Harmony on key phrase beats
        if (style.hasCounterHarmony && (i % 2 === 0 || movementIdx >= 1)) {
          const harmDeg = Math.max(0, degIdx >= 2 ? degIdx - 2 : degIdx + 2);
          const harmMidi = rootMidi + scale[Math.min(scale.length - 1, harmDeg)];
          harmonySteps[absStep] = midiToFreq(harmMidi);
        }
      }
    }

    const sfxProfile = SERIES_SFX_PROFILES[seriesId] || SERIES_SFX_PROFILES.classic;
    // Build an 18-step ascending cascade transfer scale in this figurine's exact modal scale
    const baseScale = arch.scaleIntervals || [0, 2, 4, 7, 9, 12];
    const uniqueUnderOctave = baseScale.filter((semi, idx) => semi < 12 && baseScale.indexOf(semi) === idx);
    const scaleDegs = uniqueUnderOctave.length >= 4 ? uniqueUnderOctave : [0, 2, 4, 7, 9];
    const transferScaleFreqs = [];
    for (let i = 0; i < 18; i++) {
      const oct = Math.floor(i / scaleDegs.length);
      const semi = scaleDegs[i % scaleDegs.length];
      transferScaleFreqs.push(midiToFreq(rootMidi + 12 + oct * 12 + semi));
    }

    return {
      id: figId,
      seriesId,
      fIdx,
      rootMidi,
      figName,
      trackTitle: `${figName} · ${arch.seriesTitle} (${style.name})`,
      instrumentLabel: `${arch.instrumentLabel} · ${style.name}`,
      sfxLabel: sfxProfile.sfxLabel,
      bpm,
      arch: {
        ...arch,
        leadWave: leadWaveOverrides[fIdx] || arch.leadWave
      },
      sfxProfile,
      transferScaleFreqs,
      style,
      melodySteps,
      melodyDurSteps,
      harmonySteps,
      arpSteps,
      chordBars,
      bassBars
    };
  }

  class PopStacksAudio {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.masterSfxGain = null;
      this.musicBusGain = null;
      this.musicFilter = null;
      this.musicDelay = null;
      this.musicDelayFeedback = null;
      this.musicDelayFilter = null;
      this.musicWetGain = null;
      this.muted = false;
      this.hapticsEnabled = true;
      // Rich game music is ON by default so the game feels alive immediately!
      this.ambientEnabled = true;
      this.unlocked = false;
      this.lastHaptic = 'Ready';
      this.hapticTimer = null;

      // Mobile web browser & app lifecycle tracking
      this.hidden =
        typeof document !== 'undefined'
          ? !!(document.hidden || document.visibilityState === 'hidden')
          : false;
      this.adPlaying = false;

      // Sequencer & Figurine Track state
      this.musicTimer = null;
      this.bgmPlaying = false;
      this.musicStep = 0;
      this.nextNoteTime = 0;
      this.equippedFigurineId = null;
      this.musicContextMode = 'board'; // 'board' (full puzzle focus soundtrack) | 'meta' (subtle lounge mode)
      this.currentTrack = buildFigurineMusicTrack('classic');
      this.stepDurationSec = 60 / this.currentTrack.bpm / 4;

      this._bindGlobalGestureUnlock();
      this._bindLifecycleListeners();
    }

    _bindLifecycleListeners() {
      if (typeof window === 'undefined' || typeof document === 'undefined') return;

      const handleVisibility = (hidden) => {
        this.setHidden(hidden);
      };

      // 1. Standard HTML5 Page Visibility API (Desktop & Mobile Web)
      document.addEventListener(
        'visibilitychange',
        () => {
          handleVisibility(!!(document.hidden || document.visibilityState === 'hidden'));
        },
        { passive: true }
      );

      // 2. Mobile Safari / BFCache page lifecycle
      window.addEventListener('pagehide', () => handleVisibility(true), { passive: true });
      window.addEventListener('pageshow', () => handleVisibility(false), { passive: true });

      // 3. W3C Page Lifecycle API (Modern Chromium / Android Web)
      document.addEventListener('freeze', () => handleVisibility(true), { passive: true });
      document.addEventListener('resume', () => handleVisibility(false), { passive: true });

      // 4. Mobile webview / Cordova / Capacitor fallback events
      document.addEventListener('pause', () => handleVisibility(true), { passive: true });
      document.addEventListener('resume', () => handleVisibility(false), { passive: true });

      // 5. Capacitor Native App plugin if present
      try {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
          window.Capacitor.Plugins.App.addListener('appStateChange', (state) => {
            handleVisibility(!state.isActive);
          });
          window.Capacitor.Plugins.App.addListener('pause', () => handleVisibility(true));
          window.Capacitor.Plugins.App.addListener('resume', () => handleVisibility(false));
        }
      } catch (_e) {}
    }

    setHidden(hidden) {
      const isHidden = !!hidden;
      if (this.hidden === isHidden) return;
      this.hidden = isHidden;
      this._syncPlaybackState();
    }

    setAdPlaying(playing) {
      const isAd = !!playing;
      if (this.adPlaying === isAd) return;
      this.adPlaying = isAd;
      this._syncPlaybackState();
    }

    _syncPlaybackState() {
      const shouldSilence = this.hidden || this.adPlaying || this.muted;
      const shouldSuspend = this.hidden || this.adPlaying;

      if (shouldSilence) {
        if (this.ctx && this.masterGain) {
          try {
            const now = this.ctx.currentTime;
            this.masterGain.gain.cancelScheduledValues(now);
            this.masterGain.gain.setValueAtTime(0, now);
            this.masterGain.gain.value = 0;
          } catch (_e) {}
        }
      } else {
        if (this.ctx && this.masterGain) {
          try {
            const now = this.ctx.currentTime;
            this.masterGain.gain.cancelScheduledValues(now);
            this.masterGain.gain.setValueAtTime(0, now);
            this.masterGain.gain.linearRampToValueAtTime(1.0, now + 0.05);
          } catch (_e) {}
        }
      }

      if (shouldSuspend) {
        if (this.musicTimer) {
          clearInterval(this.musicTimer);
          this.musicTimer = null;
        }
        if (this.ctx && this.ctx.state === 'running') {
          this.ctx.suspend().catch(() => {});
        }
      } else {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        if (this.ambientEnabled && !this.muted && !this.musicTimer) {
          if (this.ctx) {
            this.nextNoteTime = this.ctx.currentTime + 0.05;
          }
          this.startStudioAmbient();
        }
      }
    }

    _bindGlobalGestureUnlock() {
      if (typeof window === 'undefined') return;
      const unlockHandler = () => {
        if (this.muted || this.hidden || this.adPlaying) return;
        const ctx = this.initContext(false);
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().then(() => {
            this.unlocked = true;
            if (this.ambientEnabled && !this.muted && !this.hidden && !this.adPlaying) {
              if (!this.musicTimer) {
                this.startStudioAmbient();
              } else if (this.nextNoteTime < ctx.currentTime) {
                this.nextNoteTime = ctx.currentTime + 0.03;
              }
            }
          }).catch(() => {});
        }
      };
      window.addEventListener('pointerdown', unlockHandler, { passive: true });
      window.addEventListener('touchstart', unlockHandler, { passive: true });
      window.addEventListener('keydown', unlockHandler, { passive: true });
    }

    initContext(skipAutoMusic = false) {
      if (this.hidden || this.adPlaying) return null;
      if (this.ctx) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().then(() => {
            this.unlocked = true;
            if (this.nextNoteTime < this.ctx.currentTime) {
              this.nextNoteTime = this.ctx.currentTime + 0.03;
            }
          }).catch(() => {});
        }
        this.unlocked = this.ctx.state === 'running';
        if (!skipAutoMusic && this.ambientEnabled && !this.muted && !this.musicTimer && !this.hidden && !this.adPlaying) {
          this.startStudioAmbient();
        }
        return this.ctx;
      }
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime((this.muted || this.hidden || this.adPlaying) ? 0 : 1.0, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        this.masterSfxGain = this.ctx.createGain();
        this.masterSfxGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        this.masterSfxGain.connect(this.masterGain);

        this.musicFilter = this.ctx.createBiquadFilter();
        this.musicFilter.type = 'lowpass';
        this.musicFilter.frequency.setValueAtTime(
          this.musicContextMode === 'meta' ? 1050 : 5400,
          this.ctx.currentTime
        );
        this.musicFilter.Q.setValueAtTime(0.65, this.ctx.currentTime);

        this.musicBusGain = this.ctx.createGain();
        const targetGain = this.musicContextMode === 'meta' ? 0.20 : 0.56;
        this.musicBusGain.gain.setValueAtTime(targetGain, this.ctx.currentTime);

        // Warm Stereo/Tape Echo Ambience Loop so focus notes & arpeggios bloom seamlessly
        this.musicDelay = this.ctx.createDelay(1.0);
        this.musicDelay.delayTime.setValueAtTime(0.285, this.ctx.currentTime);
        this.musicDelayFilter = this.ctx.createBiquadFilter();
        this.musicDelayFilter.type = 'lowpass';
        this.musicDelayFilter.frequency.setValueAtTime(2200, this.ctx.currentTime);
        this.musicDelayFeedback = this.ctx.createGain();
        this.musicDelayFeedback.gain.setValueAtTime(0.34, this.ctx.currentTime);
        this.musicWetGain = this.ctx.createGain();
        this.musicWetGain.gain.setValueAtTime(0.28, this.ctx.currentTime);

        // Dry + Wet routing
        this.musicFilter.connect(this.musicBusGain);
        this.musicFilter.connect(this.musicDelay);
        this.musicDelay.connect(this.musicDelayFilter);
        this.musicDelayFilter.connect(this.musicDelayFeedback);
        this.musicDelayFeedback.connect(this.musicDelay);
        this.musicDelayFilter.connect(this.musicWetGain);
        this.musicWetGain.connect(this.musicBusGain);

        this.musicBusGain.connect(this.masterGain);

        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        this.unlocked = true;
        if (!skipAutoMusic && this.ambientEnabled && !this.muted && !this.musicTimer && !this.hidden && !this.adPlaying) {
          this.startStudioAmbient();
        }
      } catch (e) {
        this.ctx = null;
      }
      return this.ctx;
    }

    /**
     * Switches the active soundtrack to match the equipped figurine (or 'classic' when unequipped).
     */
    setEquippedFigurineTrack(figOrId, playPreviewFlourish = false) {
      const nextId =
        figOrId && typeof figOrId === 'object' ? figOrId.id : figOrId || 'classic';
      this.equippedFigurineId = nextId === 'classic' ? null : nextId;
      this.currentTrack = buildFigurineMusicTrack(figOrId || 'classic');
      this.stepDurationSec = 60 / (this.currentTrack.bpm || 96) / 4;
      // Reset sequencer to step 0 and synchronize nextNoteTime so the new figurine's track flows immediately
      this.musicStep = 0;
      if (this.ctx) {
        this.nextNoteTime = this.ctx.currentTime + (playPreviewFlourish ? 0.28 : 0.03);
        if (this.musicDelay) {
          // Sync tape delay time to dotted-8th of the figurine's tempo
          const dottedEighth = Math.max(0.18, Math.min(0.48, this.stepDurationSec * 3));
          this.musicDelay.delayTime.setTargetAtTime(dottedEighth, this.ctx.currentTime, 0.05);
        }
      }

      if (playPreviewFlourish && !this.muted && !this.hidden && !this.adPlaying) {
        this.playFigurineEquipFanfare(figOrId);
      } else if (this.ambientEnabled && !this.muted && !this.hidden && !this.adPlaying && this.ctx && !this.musicTimer) {
        this.startStudioAmbient();
      }
      return this.currentTrack;
    }

    /**
     * Substantial celebratory audio + haptic fanfare when equipping a figurine companion.
     */
    playFigurineEquipFanfare(figOrId) {
      if (this.muted || this.hidden || this.adPlaying) return;
      this.triggerHaptic([22, 30, 50], 'FigurineEquipped');
      const ctx = this.initContext();
      if (!ctx) return;

      this.duckMusic(0.22, 0.28, 0.45);
      const track = this.currentTrack || buildFigurineMusicTrack(figOrId || 'classic');
      const arch = track.arch || SERIES_MUSIC_ARCHETYPES.classic;
      const chord = (track.chordBars && track.chordBars[0]) || [261.63, 329.63, 392.0, 523.25];

      // 1. Tactile pedestal lock-in thock
      this._playTone(155, 58, 0.14, 'triangle', 0.24, 0);
      this._playTone(580, 260, 0.045, 'triangle', 0.13, 0.006);

      // 2. Warm 4-voice harmonic chord swell
      chord.slice(0, 4).forEach((freq, idx) => {
        this._playTone(freq * 1.5, freq * 1.5, 0.42, 'sine', 0.1, 0.04 + idx * 0.03);
      });

      // 3. Ascending 6-note signature figurine melody flourish + octave chime
      const scale = arch.scaleIntervals || [0, 2, 4, 7, 9, 12];
      const rootMidi = arch.baseMidi || 60;
      const motifNotes = [scale[0], scale[1], scale[2], scale[3], scale[4], scale[5] || 12];
      motifNotes.forEach((semi, idx) => {
        const f = midiToFreq(rootMidi + semi);
        const isLast = idx === motifNotes.length - 1;
        this._playTone(
          f,
          isLast ? f * 1.002 : f,
          isLast ? 0.48 : 0.18,
          arch.leadWave || 'triangle',
          isLast ? 0.17 : 0.13,
          0.08 + idx * 0.065
        );
        if (isLast) {
          this._playTone(f * 2, f * 2, 0.52, 'sine', 0.11, 0.08 + idx * 0.065);
        }
      });
    }

    /**
     * Switches between active puzzle focus music ('board') and subtle lounge/menu music ('meta').
     */
    setMusicContextMode(mode = 'board') {
      const normalized = mode === 'board' ? 'board' : 'meta';
      const changed = this.musicContextMode !== normalized;
      this.musicContextMode = normalized;
      if (changed) {
        this.musicStep = 0;
        if (this.ctx) {
          this.nextNoteTime = this.ctx.currentTime + 0.03;
        }
      }
      if (this.ctx && this.musicBusGain && this.musicFilter) {
        const now = this.ctx.currentTime;
        const targetGain = normalized === 'meta' ? 0.18 : 0.56;
        const targetCutoff = normalized === 'meta' ? 980 : 5400;
        this.musicBusGain.gain.cancelScheduledValues(now);
        this.musicBusGain.gain.setValueAtTime(
          Math.max(0.12, this.musicBusGain.gain.value || targetGain),
          now
        );
        this.musicBusGain.gain.linearRampToValueAtTime(targetGain, now + 0.28);

        this.musicFilter.frequency.cancelScheduledValues(now);
        this.musicFilter.frequency.setValueAtTime(
          Math.max(500, this.musicFilter.frequency.value || targetCutoff),
          now
        );
        this.musicFilter.frequency.exponentialRampToValueAtTime(targetCutoff, now + 0.28);
      }
      if (this.ambientEnabled && !this.muted && !this.hidden && !this.adPlaying && this.ctx && !this.musicTimer) {
        this.startStudioAmbient();
      }
      return this.musicContextMode;
    }

    setMuted(muted) {
      this.muted = !!muted;
      this._syncPlaybackState();
      return this.muted;
    }

    setHapticsEnabled(enabled) {
      this.hapticsEnabled = !!enabled;
      return this.hapticsEnabled;
    }

    toggleMute() {
      this.setMuted(!this.muted);
      if (!this.muted && !this.hidden && !this.adPlaying) {
        this.initContext();
        this.playUiClick();
      }
      return this.muted;
    }

    toggleMusic() {
      if (this.ambientEnabled) {
        this.stopStudioAmbient(false);
      } else {
        this.ambientEnabled = true;
        if (!this.hidden && !this.adPlaying && !this.muted) {
          this.startStudioAmbient();
          this.playUiClick();
        }
      }
      return this.ambientEnabled;
    }

    /**
     * Temporarily ducks background music so big SFX & fanfares pop cleanly without killing the focus loop
     */
    duckMusic(duckGain = 0.22, holdSec = 0.25, releaseSec = 0.35) {
      if (!this.ctx || !this.musicBusGain || this.hidden || this.adPlaying) return;
      const now = this.ctx.currentTime;
      const restoreGain = this.musicContextMode === 'meta' ? 0.18 : 0.56;
      const safeDuck = Math.max(0.14, Math.min(duckGain, restoreGain * 0.65));
      try {
        this.musicBusGain.gain.cancelScheduledValues(now);
        this.musicBusGain.gain.setValueAtTime(
          Math.max(safeDuck, this.musicBusGain.gain.value || restoreGain),
          now
        );
        this.musicBusGain.gain.linearRampToValueAtTime(safeDuck, now + 0.025);
        this.musicBusGain.gain.linearRampToValueAtTime(restoreGain, now + holdSec + releaseSec);
      } catch (e) {}
    }

    triggerHaptic(pattern, label) {
      if (this.hidden) return;
      this.lastHaptic = label || (Array.isArray(pattern) ? `Burst [${pattern.join(',')}]` : `${pattern}ms`);
      if (this.hapticsEnabled) {
        try {
          if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(pattern);
          }
        } catch (e) {}
      }

      const pill = document.getElementById('tel-haptic');
      const dbg = document.getElementById('dbg-haptic');
      if (pill) {
        const shortLabel = String(this.lastHaptic).split(' ')[0];
        pill.textContent = `📳 ${shortLabel}`;
        pill.classList.add('pulse');
        clearTimeout(this.hapticTimer);
        this.hapticTimer = setTimeout(() => {
          pill.classList.remove('pulse');
        }, 180);
      }
      if (dbg) {
        dbg.textContent = this.lastHaptic;
      }
    }

    _playTone(freq, endFreq, durationSec, type = 'sine', peakGain = 0.15, delaySec = 0, dest = null) {
      if (this.muted || this.hidden || this.adPlaying) return;
      const ctx = this.initContext();
      if (!ctx) return;

      const start = ctx.currentTime + delaySec;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), start);
      if (endFreq && endFreq !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + durationSec * 0.9);
      }

      gain.gain.setValueAtTime(0.0008, start);
      gain.gain.linearRampToValueAtTime(peakGain, start + Math.min(0.008, durationSec * 0.2));
      gain.gain.exponentialRampToValueAtTime(0.0005, start + durationSec);

      osc.connect(gain);
      gain.connect(dest || this.masterSfxGain || this.masterGain || ctx.destination);
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (e) {}
      };
      osc.start(start);
      osc.stop(start + durationSec + 0.015);
    }

    _getActiveSfxContext() {
      const track = this.currentTrack || buildFigurineMusicTrack('classic');
      const arch = track.arch || SERIES_MUSIC_ARCHETYPES.classic;
      const sfx = track.sfxProfile || SERIES_SFX_PROFILES[track.seriesId] || SERIES_SFX_PROFILES.classic;
      const rootMidi = track.rootMidi || arch.baseMidi || 60;
      const pitchMult = Math.pow(2, (rootMidi - 60) / 24);
      const scaleFreqs =
        track.transferScaleFreqs && track.transferScaleFreqs.length
          ? track.transferScaleFreqs
          : TRANSFER_SCALE;
      return { track, arch, sfx, rootMidi, pitchMult, scaleFreqs };
    }

    _playNoiseBurst(
      filterType = 'bandpass',
      startHz = 1950,
      endHz = 1950,
      q = 2.8,
      durationSec = 0.045,
      peakGain = 0.12,
      delaySec = 0
    ) {
      if (this.muted || this.hidden || this.adPlaying || peakGain <= 0 || startHz <= 0) return;
      const ctx = this.initContext();
      if (!ctx) return;

      const start = ctx.currentTime + delaySec;
      const bufferSize = Math.max(64, Math.floor(ctx.sampleRate * durationSec));
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.36));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(Math.max(60, startHz), start);
      if (endHz && endHz !== startHz) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(60, endHz), start + durationSec * 0.9);
      }
      filter.Q.setValueAtTime(q, start);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(peakGain, start);
      noiseGain.gain.exponentialRampToValueAtTime(0.0006, start + durationSec);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.masterSfxGain || this.masterGain || ctx.destination);
      noise.onended = () => {
        try {
          noise.disconnect();
          filter.disconnect();
          noiseGain.disconnect();
        } catch (_e) {}
      };
      noise.start(start);
    }

    /**
     * Theme-aware UI button click
     */
    playUiClick() {
      this.triggerHaptic(5, 'Tap (5ms)');
      const { sfx, pitchMult } = this._getActiveSfxContext();
      const wave = (sfx.snap && sfx.snap.wave) || 'triangle';
      this._playTone(540 * pitchMult, 780 * pitchMult, 0.038, wave, 0.10, 0);
      this._playTone(1080 * pitchMult, 1320 * pitchMult, 0.025, 'sine', 0.05, 0.01);
    }

    /**
     * Theme-specific stack pickup from tray
     * (Bamboo lift, Urushi koto pluck, Plasma levitation, Raku teacup, Sandstone lift, Stained-glass chime, Brass ratchet, Lagoon bubble, Washi fold, 24K Bullion)
     */
    playPickup() {
      this.triggerHaptic(6, 'Lift (6ms)');
      if (this.muted) return;
      const { sfx, pitchMult } = this._getActiveSfxContext();
      const p = sfx.pickup || SERIES_SFX_PROFILES.classic.pickup;
      this._playTone(p.f1 * pitchMult, p.f2 * pitchMult, p.dur, p.wave || 'triangle', 0.15, 0);
      this._playTone(p.sub1 * pitchMult, p.sub2 * pitchMult, p.dur * 0.78, p.subWave || 'sine', 0.075, 0.01);
      if (p.noiseHz > 0 && p.noiseGain > 0) {
        this._playNoiseBurst('bandpass', p.noiseHz, p.noiseHz * 1.35, 2.5, 0.032, p.noiseGain, 0.004);
      }
    }

    /**
     * Theme-specific magnetic snap-to-hex socket hover tick
     */
    playSnap() {
      this.triggerHaptic(8, 'Snap (8ms)');
      if (this.muted) return;
      const { sfx, pitchMult } = this._getActiveSfxContext();
      const sn = sfx.snap || SERIES_SFX_PROFILES.classic.snap;
      this._playTone(sn.f1 * pitchMult, sn.f2 * pitchMult, sn.dur, sn.wave || 'sine', 0.085, 0);
      this._playTone(sn.ping1 * pitchMult, sn.ping2 * pitchMult, sn.dur * 0.85, sn.pingWave || 'triangle', 0.04, 0.005);
      if (sn.doubleTick) {
        // Double escapement / shrine clapper click for Clockwork & Kitsune themes
        this._playTone(sn.f1 * 1.25 * pitchMult, sn.f2 * 1.25 * pitchMult, sn.dur * 0.75, sn.wave || 'triangle', 0.055, 0.022);
      }
    }

    /**
     * Theme-specific stack placement impact onto the hexagonal board
     */
    playPlace() {
      this.triggerHaptic(10, 'Place (10ms)');
      if (this.muted) return;
      const { sfx, pitchMult } = this._getActiveSfxContext();
      const pl = sfx.place || SERIES_SFX_PROFILES.classic.place;
      this._playTone(pl.thump1 * pitchMult, pl.thump2, pl.thumpDur, pl.thumpWave || 'sine', 0.23, 0);
      this._playTone(pl.clack1 * pitchMult, pl.clack2 * pitchMult, 0.042, pl.clackWave || 'triangle', 0.11, 0.002);
      this._playTone(pl.ring1 * pitchMult, pl.ring2 * pitchMult, 0.055, pl.ringWave || 'sine', 0.065, 0.008);
      if (pl.noiseHz > 0 && pl.noiseGain > 0) {
        this._playNoiseBurst('bandpass', pl.noiseHz, pl.noiseHz * 0.65, 2.2, 0.036, pl.noiseGain, 0);
      }
    }

    /**
     * Theme-specific ascending disc-by-disc parabolic transfer chime
     * Climbs the equipped figurine's exact modal scale with the theme's acoustic synthesis model!
     */
    playTransferChime(stepIndex = 0) {
      this.triggerHaptic(12, 'Transfer (12ms)');
      if (this.muted) return;
      const { sfx, scaleFreqs } = this._getActiveSfxContext();
      const tr = sfx.transfer || SERIES_SFX_PROFILES.classic.transfer;
      const idx = Math.max(0, Math.min(scaleFreqs.length - 1, stepIndex));
      const freq = scaleFreqs[idx];
      const endFreq = freq * (tr.glide || 1.0);

      // 1. Theme fundamental tone (Marimba / Koto / Plasma Synth / Rhodes / Handpan / Celesta / Spinet / Steelpan / Glass / Carillon)
      this._playTone(freq, endFreq, tr.dur || 0.26, tr.wave || 'sine', tr.gain || 0.18, 0);
      // 2. Characteristic theme harmonic overtone
      this._playTone(
        freq * (tr.overRatio || 3.0),
        endFreq * (tr.overRatio || 3.0) * 0.99,
        tr.overDur || 0.07,
        tr.overWave || 'triangle',
        tr.overGain || 0.055,
        0.002
      );
      // 3. Octave / Fifth resonance shimmer
      this._playTone(
        freq * (tr.shimRatio || 2.0),
        freq * (tr.shimRatio || 2.0),
        (tr.dur || 0.26) * 0.65,
        tr.shimWave || 'sine',
        tr.shimGain || 0.045,
        0.012
      );
    }

    /**
     * Theme-specific rapid 20ms-per-disc top-to-bottom peel anticipation ticks before a 10+ burst
     */
    playDiscPopTick(discIndex = 0, totalDiscs = 10) {
      if (discIndex % 3 === 0) {
        this.triggerHaptic(6, `Peel ${discIndex + 1}/${totalDiscs}`);
      }
      if (this.muted) return;
      const { sfx, pitchMult } = this._getActiveSfxContext();
      const pe = sfx.peel || SERIES_SFX_PROFILES.classic.peel;
      const ratio = Math.min(1, discIndex / Math.max(1, totalDiscs - 1));
      const startFreq = (pe.baseHz + ratio * pe.spanHz) * pitchMult;
      const dur = pe.dur || 0.032;
      this._playTone(startFreq, startFreq * (pe.glide || 1.6), dur, pe.wave || 'sine', 0.14, 0);
      this._playTone(
        startFreq * (pe.overRatio || 1.5),
        startFreq * (pe.overRatio || 1.5) * 1.25,
        dur * 0.68,
        pe.overWave || 'triangle',
        0.05,
        0.004
      );
    }

    /**
     * Theme-specific 10-Disc Stack Burst Climax!
     * Combines theme impact + custom material shatter/pop transient + celebratory theme-scale chord arpeggio!
     */
    playBurst10(combo = 1) {
      this.triggerHaptic([25, 30, 45], `Burst10 (x${combo})`);
      if (this.muted) return;
      const ctx = this.initContext();
      if (!ctx) return;

      this.duckMusic(0.22, 0.28, 0.35);
      const { sfx, scaleFreqs, pitchMult } = this._getActiveSfxContext();
      const b = sfx.burst || SERIES_SFX_PROFILES.classic.burst;

      // 1. Theme-specific sub-bass impact + resonant material pop sweep
      this._playTone(b.boom1 * pitchMult, b.boom2, 0.13, b.boomWave || 'sine', 0.24, 0);
      this._playTone(b.pop1 * pitchMult, b.pop2 * pitchMult, b.popDur || 0.085, b.popWave || 'sine', 0.22, 0);

      // 2. Theme-specific filtered material burst transient (leaf rustle, lacquer snap, plasma sweep, raku glaze, sandstone, stained glass, steam valve, lagoon splash, washi crease, diamond dust)
      this._playNoiseBurst(
        b.filterType || 'bandpass',
        b.noiseHz1 || 1950,
        b.noiseHz2 || 1950,
        b.noiseQ || 3.0,
        b.noiseDur || 0.06,
        b.noiseGain || 0.16,
        0
      );

      // 3. Shimmering Theme-Scale Chord Arpeggio (ascending in pitch with combo multiplier!)
      const baseShift = Math.min(5, Math.max(0, combo - 1));
      const chordIndices = [0 + baseShift, 2 + baseShift, 4 + baseShift, 6 + baseShift, 7 + baseShift];
      const stagger = b.chordStagger || 0.03;
      chordIndices.forEach((scaleIdx, i) => {
        const freq = scaleFreqs[Math.min(scaleFreqs.length - 1, scaleIdx)];
        this._playTone(freq, freq, 0.38, b.chordWave || 'sine', 0.12, 0.025 + i * stagger);
        this._playTone(
          freq * 2,
          freq * 2,
          0.20,
          b.chordOverWave || 'triangle',
          0.04,
          0.03 + i * stagger
        );
      });
    }

    /**
     * Theme-aware Frozen Clay Tile crack / thaw sound when an adjacent 10-disc burst hits it
     */
    playClayCrack(thawed = false) {
      this.triggerHaptic(thawed ? [18, 20, 30] : 14, thawed ? 'ClayThaw' : 'ClayCrack');
      if (this.muted) return;
      const { sfx, scaleFreqs, pitchMult } = this._getActiveSfxContext();
      const wave = (sfx.transfer && sfx.transfer.wave) || 'triangle';
      if (thawed) {
        this._playNoiseBurst('bandpass', 2400 * pitchMult, 900 * pitchMult, 2.5, 0.05, 0.12, 0);
        this._playTone(980 * pitchMult, 420 * pitchMult, 0.055, 'triangle', 0.15, 0);
        this._playTone(scaleFreqs[5] || 1318.51, scaleFreqs[7] || 1567.98, 0.18, wave, 0.14, 0.03);
        this._playTone(scaleFreqs[9] || 2093.0, scaleFreqs[9] || 2093.0, 0.24, 'sine', 0.11, 0.06);
      } else {
        this._playNoiseBurst('bandpass', 1800 * pitchMult, 700 * pitchMult, 2.8, 0.035, 0.09, 0);
        this._playTone(680 * pitchMult, 310 * pitchMult, 0.045, 'triangle', 0.14, 0);
      }
    }

    /**
     * Theme-aware Booster: Mallet / Hammer smash sound
     */
    playHammerSmash() {
      this.triggerHaptic([35, 25, 55], 'HammerSmash');
      if (this.muted) return;
      this.duckMusic(0.22, 0.22, 0.28);
      const { sfx, scaleFreqs, pitchMult } = this._getActiveSfxContext();
      const b = sfx.burst || SERIES_SFX_PROFILES.classic.burst;
      this._playTone(150 * pitchMult, 46, 0.15, b.boomWave || 'sine', 0.28, 0);
      this._playNoiseBurst(b.filterType || 'bandpass', b.noiseHz1 || 2000, 600, 2.2, 0.065, 0.15, 0.005);
      this._playTone(880 * pitchMult, 290 * pitchMult, 0.075, 'sawtooth', 0.11, 0.01);
      this._playTone(scaleFreqs[4] || 1046.5, scaleFreqs[6] || 1318.5, 0.24, b.chordWave || 'triangle', 0.13, 0.04);
    }

    /**
     * Theme-aware Booster: Tray Swap refresh ripple in the equipped figurine's scale
     */
    playTraySwap() {
      this.triggerHaptic(18, 'TraySwap');
      if (this.muted) return;
      const { sfx, scaleFreqs } = this._getActiveSfxContext();
      const wave = (sfx.transfer && sfx.transfer.wave) || 'triangle';
      [0, 2, 4, 6].forEach((deg, idx) => {
        const f = scaleFreqs[deg] || 523.25;
        this._playTone(f, f * 1.08, 0.12, wave, 0.12, idx * 0.038);
      });
    }

    /**
     * Theme-aware Booster: Extra Staging Slot unlock chime in the equipped figurine's scale
     */
    playExtraSlotUnlock() {
      this.triggerHaptic([15, 20, 30], 'ExtraSlot');
      if (this.muted) return;
      const { sfx, scaleFreqs } = this._getActiveSfxContext();
      const wave = (sfx.transfer && sfx.transfer.wave) || 'sine';
      this._playTone(scaleFreqs[1] || 587.33, scaleFreqs[1] || 587.33, 0.14, wave, 0.14, 0);
      this._playTone(scaleFreqs[3] || 880.0, scaleFreqs[3] || 880.0, 0.24, wave, 0.15, 0.055);
      this._playTone(scaleFreqs[5] || 1174.66, scaleFreqs[5] || 1174.66, 0.28, 'triangle', 0.1, 0.11);
    }

    /**
     * Theme-aware Target Disc collected in Top Objective Counter
     */
    playObjectiveCollect() {
      if (this.muted) return;
      const { sfx, scaleFreqs } = this._getActiveSfxContext();
      const wave = (sfx.transfer && sfx.transfer.wave) || 'sine';
      const f1 = scaleFreqs[5] || 1046.5;
      const f2 = scaleFreqs[7] || 1318.51;
      const f3 = scaleFreqs[9] || 1567.98;
      this._playTone(f1, f2, 0.085, wave, 0.11, 0);
      this._playTone(f2, f3, 0.06, 'triangle', 0.05, 0.02);
    }

    /**
     * Key-Matched Round-to-Round Transition Swell ("Ready, Sculpt!")
     * Uses the equipped figurine's own scale & timbre and keeps the focus loop flowing!
     */
    playRoundTransition() {
      this.triggerHaptic([15, 25, 20], 'NextRound');
      if (this.muted) return;
      const ctx = this.initContext();
      if (!ctx) return;
      const { track, arch } = this._getActiveSfxContext();
      const chord = (track.chordBars && track.chordBars[0]) || [261.63, 329.63, 392.0, 523.25];
      chord.slice(0, 4).forEach((f, i) => {
        this._playTone(f * 2, f * 2.005, 0.26, arch.leadWave || 'triangle', 0.09, i * 0.048);
      });
    }

    /**
     * Theme-aware Level Complete 3-Star Studio Victory Fanfare
     */
    playLevelComplete(stars = 3) {
      this.triggerHaptic([30, 40, 30, 40, 80], 'LevelWin');
      if (this.muted) return;
      this.duckMusic(0.18, 0.55, 0.45);
      const { arch, scaleFreqs } = this._getActiveSfxContext();
      const indices = [0, 2, 4, 5, 7, 9, 11];
      const count = Math.max(5, Math.min(indices.length, stars + 4));
      for (let i = 0; i < count; i++) {
        const f = scaleFreqs[indices[i]] || 523.25;
        this._playTone(f, f, 0.42, arch.leadWave || 'sine', 0.15, i * 0.072);
        this._playTone(f * 0.5, f * 0.5, 0.38, 'triangle', 0.09, i * 0.072);
        this._playTone(f * 2, f * 2, 0.16, 'sine', 0.05, i * 0.072);
      }
    }

    /**
     * Symbolic Gacha Ball Roulette Shuffle (when picking a random capsule ball)
     */
    playCapsuleShuffle() {
      this.triggerHaptic([10, 14, 10, 14, 18], 'CapsuleShuffle');
      if (this.muted) return;
      const ctx = this.initContext();
      if (!ctx) return;
      const { scaleFreqs } = this._getActiveSfxContext();
      for (let i = 0; i < 5; i++) {
        const delay = i * 0.065;
        const f = (scaleFreqs[i % 5] || 523.25) * 0.75;
        this._playTone(f, f * 1.12, 0.045, 'triangle', 0.1, delay);
      }
      // Lock-in thock on the selected ball
      this._playTone(340, 680, 0.08, 'sine', 0.18, 0.34);
    }

    /**
     * 3-Second Vessel Roulette Tick (called at each decelerating step of the 3s vessel spin)
     */
    playRouletteTick(stepIdx = 0, totalSteps = 16, soundFamily = 'ceramic') {
      if (stepIdx % 2 === 0 || stepIdx >= totalSteps - 4) {
        this.triggerHaptic(8, 'RouletteTick');
      }
      if (this.muted) return;
      const ctx = this.initContext();
      if (!ctx) return;
      const { scaleFreqs } = this._getActiveSfxContext();
      const progress = Math.max(0, Math.min(1, stepIdx / Math.max(1, totalSteps - 1)));
      const deg = stepIdx % 5;
      const baseF = (scaleFreqs[deg] || 523.25) * (0.72 + progress * 0.28);

      // Subtle material-flavored wooden/ceramic roulette click
      if (soundFamily === 'metal') {
        this._playTone(baseF * 1.35, baseF * 1.1, 0.038, 'triangle', 0.09, 0);
        this._playNoiseBurst('bandpass', 3600, 1800, 4.0, 0.015, 0.05, 0);
      } else if (soundFamily === 'crystal') {
        this._playTone(baseF * 1.5, baseF * 1.52, 0.042, 'sine', 0.09, 0);
      } else {
        this._playTone(baseF, baseF * 0.88, 0.036, 'triangle', 0.1, 0);
        this._playNoiseBurst('bandpass', 2200, 1200, 3.2, 0.016, 0.06, 0);
      }
    }

    /**
     * 3-Second Vessel Roulette Final Lock-In Chime (when the chosen vessel lands at t = 3.0s)
     */
    playRouletteLockIn(soundFamily = 'ceramic', rarity = 'Common') {
      const rKey = String(rarity || 'Common').toLowerCase();
      const isSpecial = rKey !== 'common';
      this.triggerHaptic(isSpecial ? [18, 24, 32] : [16, 20], 'RouletteLockIn');
      if (this.muted) return;
      const ctx = this.initContext();
      if (!ctx) return;
      const { scaleFreqs } = this._getActiveSfxContext();
      const f0 = scaleFreqs[2] || 659.25;
      const f1 = scaleFreqs[4] || 783.99;
      const f2 = scaleFreqs[5] || 1046.5;

      // Tactile vessel settle thock + harmonic lock-in
      this._playTone(260, 520, 0.09, 'sine', 0.18, 0);
      this._playTone(f0, f1, 0.16, 'triangle', 0.14, 0.02);
      if (isSpecial) {
        // Extra celebratory sparkle chord when locking onto a Rare / Epic / Legendary / Mythic vessel!
        this._playTone(f1, f1, 0.24, 'sine', 0.13, 0.06);
        this._playTone(f2, f2 * 1.01, 0.32, 'sine', 0.15, 0.12);
        this._playTone(f2 * 1.5, f2 * 1.5, 0.28, 'triangle', 0.08, 0.16);
      }
    }

    /**
     * Progressive Material Vessel Tap Sound (Tap 1 & Tap 2 — material-matched percussion + rising harmonic)
     */
    playCapsuleTap(step = 1, soundFamily = 'ceramic') {
      this.triggerHaptic(step === 1 ? [18, 22] : [25, 20, 35], `CapsuleTap${step}`);
      if (this.muted) return;
      const ctx = this.initContext();
      if (!ctx) return;
      const { scaleFreqs } = this._getActiveSfxContext();
      const deg = step === 1 ? 2 : 5;
      const f = scaleFreqs[deg] || (step === 1 ? 659.25 : 987.77);

      if (soundFamily === 'metal') {
        // Forged brass / gold metallic strike + bell overtone
        this._playTone(880 * step, 440, 0.09, 'triangle', 0.18, 0);
        this._playTone(f * 2.0, f * 2.01, 0.28, 'sine', 0.14, 0.005);
        this._playTone(f * 2.76, f * 2.75, 0.22, 'sine', 0.08, 0.015);
        this._playNoiseBurst('bandpass', 4200 + step * 800, 2600, 6.0, 0.025, 0.1, 0);
      } else if (soundFamily === 'crystal') {
        // Shimmering crystal geode chime
        this._playTone(f * 1.5, f * 1.52, 0.26, 'sine', 0.15, 0);
        this._playTone(f * 3.0, f * 3.02, 0.22, 'sine', 0.09, 0.018);
        this._playNoiseBurst('highpass', 4800, 3200, 4.0, 0.03, 0.08, 0);
      } else if (soundFamily === 'clay') {
        // Warm hollow earthenware / stoneware knock
        this._playTone(185 * step, 92, 0.08, 'sine', 0.22, 0);
        this._playNoiseBurst('bandpass', 1450 + step * 400, 900, 3.0, 0.04, 0.12, 0);
        this._playTone(f * 0.75, f * 0.78, 0.16, 'triangle', 0.14, 0.015);
      } else {
        // Glazed ceramic / lacquerware clink + crackle
        this._playTone(320 * step, 160, 0.065, 'sine', 0.19, 0);
        this._playNoiseBurst('bandpass', 2600 + step * 650, 1500, 4.2, 0.032, 0.12, 0);
        this._playTone(f, f * 1.04, 0.2, 'triangle', 0.15, 0.012);
        this._playTone(f * 1.5, f * 1.5, 0.16, 'sine', 0.08, 0.025);
      }
    }

    /**
     * Final Capsule Pop & Rarity-Graded Figurine Reveal Shimmer
     */
    playFigurineUnbox(rarity = 'Rare') {
      this.triggerHaptic([20, 30, 20, 30, 75], 'UnboxFigurine');
      if (this.muted) return;
      const ctx = this.initContext();
      if (!ctx) return;
      this.duckMusic(0.16, 0.52, 0.42);

      // Crisp two-tone plastic capsule shell pop ("PON!")
      this._playNoiseBurst('bandpass', 2800, 1400, 3.4, 0.045, 0.16, 0);
      this._playTone(360, 1180, 0.075, 'sine', 0.22, 0);

      const { scaleFreqs } = this._getActiveSfxContext();
      const rKey = String(rarity || 'Rare').toLowerCase();
      const isUR = rKey === 'mythic';
      const isSSR = rKey === 'legendary';
      const isSR = rKey === 'epic';

      const noteCount = isUR ? 10 : isSSR ? 9 : isSR ? 8 : 6;
      const shimmer = scaleFreqs.slice(0, noteCount);
      shimmer.forEach((f, i) => {
        const d = 0.04 + i * (isUR || isSSR ? 0.038 : 0.045);
        this._playTone(f, f, isUR || isSSR ? 0.52 : 0.42, 'sine', 0.15, d);
        this._playTone(f * 1.5, f * 1.5, 0.26, 'triangle', 0.055, d + 0.014);
        if (isUR || isSSR) {
          this._playTone(f * 2, f * 2.01, 0.32, 'sine', 0.045, d + 0.022);
        }
      });
    }

    /**
     * Theme-aware warning when only 1 empty board slot remains
     */
    playDeadlockWarning() {
      this.triggerHaptic([15, 30, 15], 'LowSpaceWarn');
      if (this.muted) return;
      const { sfx, scaleFreqs } = this._getActiveSfxContext();
      const wave = (sfx.place && sfx.place.clackWave) || 'triangle';
      const hi = (scaleFreqs[2] || 659.25) * 0.5;
      const lo = (scaleFreqs[0] || 523.25) * 0.5;
      this._playTone(hi, lo, 0.09, wave, 0.12, 0);
      this._playTone(lo, lo * 0.88, 0.11, wave, 0.12, 0.1);
    }

    /**
     * Theme-aware descending notes when board reaches out-of-moves rescue state
     */
    playDeadlock() {
      this.triggerHaptic([40, 50, 70], 'OutOfMoves');
      if (this.muted) return;
      this.duckMusic(0.22, 0.35, 0.35);
      const { arch, scaleFreqs } = this._getActiveSfxContext();
      const freqs = [scaleFreqs[4], scaleFreqs[2], scaleFreqs[1], scaleFreqs[0]].map(
        (f) => (f || 523.25) * 0.5
      );
      freqs.forEach((f, idx) => {
        this._playTone(f, f, 0.24, arch.leadWave || 'triangle', 0.13, idx * 0.1);
      });
    }

    // =========================================================================
    // Dynamic 60-Figurine Long-Form Looping Focus Soundtrack Sequencer
    // ('board' = 16-Bar Themed Focus Loop | 'meta' = Subtle Lounge Wind-Chimes)
    // =========================================================================
    _scheduleMusicStep(stepIdx, rawTime) {
      if (!this.ctx || this.muted || !this.ambientEnabled || this.hidden || this.adPlaying) return;
      const dest = this.musicFilter || this.musicBusGain || this.masterGain || this.ctx.destination;
      const track = this.currentTrack || buildFigurineMusicTrack('classic');
      const arch = track.arch || SERIES_MUSIC_ARCHETYPES.classic;
      const style = track.style || FIGURINE_ARRANGEMENT_STYLES[0];
      const isMeta = this.musicContextMode === 'meta';

      // Dedicated ultra-subtle Studio Wind-Chime & Warm Lounge Pad when NOT in puzzle ('meta')
      if (isMeta) {
        const ms = stepIdx % 64;
        const metaChords = (track.chordBars && track.chordBars.slice(0, 4)) || [
          [220.0, 277.18, 329.63, 415.3],
          [196.0, 246.94, 293.66, 369.99],
          [174.61, 220.0, 261.63, 329.63],
          [196.0, 261.63, 329.63, 392.0]
        ];
        if (ms % 16 === 0) {
          const chord = metaChords[Math.floor(ms / 16) % metaChords.length];
          const dur = this.stepDurationSec * 16.2;
          chord.slice(0, 4).forEach((freq) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, rawTime);
            gain.gain.setValueAtTime(0.0004, rawTime);
            gain.gain.linearRampToValueAtTime(0.022, rawTime + 0.28);
            gain.gain.linearRampToValueAtTime(0.017, rawTime + dur * 0.78);
            gain.gain.exponentialRampToValueAtTime(0.0004, rawTime + dur);
            osc.connect(gain);
            gain.connect(dest);
            osc.onended = () => {
              try { osc.disconnect(); gain.disconnect(); } catch (e) {}
            };
            osc.start(rawTime);
            osc.stop(rawTime + dur + 0.03);
          });
        }
        if (ms % 16 === 2 || ms % 16 === 10) {
          const arpPool = (track.chordBars && track.chordBars[0]) || [261.63, 329.63, 392.0, 523.25];
          const cFreq = arpPool[Math.floor(ms / 4) % arpPool.length] * 2;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(cFreq, rawTime);
          gain.gain.setValueAtTime(0.0004, rawTime);
          gain.gain.linearRampToValueAtTime(0.024, rawTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0004, rawTime + this.stepDurationSec * 6.0);
          osc.connect(gain);
          gain.connect(dest);
          osc.onended = () => {
            try { osc.disconnect(); gain.disconnect(); } catch (e) {}
          };
          osc.start(rawTime);
          osc.stop(rawTime + this.stepDurationSec * 6.0 + 0.02);
        }
        return;
      }

      const totalSteps = (track.melodySteps && track.melodySteps.length) || 256;
      const s = stepIdx % totalSteps;
      const barIdx = Math.floor(s / 16);
      const stepInBar = s % 16;
      const time = rawTime + (stepInBar % 2 === 1 ? style.swing || 0 : 0);

      // 1. Continuous Sustained Warm Harmonic Pad (overlapping half-bar crossfades so pad NEVER drops out)
      if (stepInBar === 0 || stepInBar === 8) {
        const chordBars = track.chordBars || [];
        const chord = chordBars[barIdx % Math.max(1, chordBars.length)] || [261.63, 329.63, 392.0, 493.88];
        const dur = this.stepDurationSec * 9.0; // Overlaps into the next half-bar for zero gap
        const basePadGain = stepInBar === 0 ? 0.044 : 0.036;
        chord.slice(0, 4).forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = i === 0 ? arch.padWave || 'triangle' : 'sine';
          // Subtle warm analog detune across chord voices
          const detuneHz = (i - 1.5) * 0.45;
          osc.frequency.setValueAtTime(freq + detuneHz, time);

          gain.gain.setValueAtTime(0.0006, time);
          gain.gain.linearRampToValueAtTime(basePadGain, time + 0.16);
          // True ADSR Sustain Plateau held across 78% of the half-bar
          gain.gain.linearRampToValueAtTime(basePadGain * 0.84, time + dur * 0.78);
          gain.gain.exponentialRampToValueAtTime(0.0006, time + dur);

          osc.connect(gain);
          gain.connect(dest);
          osc.onended = () => {
            try { osc.disconnect(); gain.disconnect(); } catch (e) {}
          };
          osc.start(time);
          osc.stop(time + dur + 0.03);
        });
      }

      // 2. Continuous Hypnotic Focus Arpeggiator (`arpSteps` weaves through every bar)
      const arpFreq = (track.arpSteps && track.arpSteps[s]) || 0;
      if (arpFreq > 0) {
        const arpOsc = this.ctx.createOscillator();
        const arpGain = this.ctx.createGain();
        arpOsc.type = arch.leadWave === 'sawtooth' ? 'triangle' : 'sine';
        arpOsc.frequency.setValueAtTime(arpFreq, time);

        // Gently attenuate arpeggio on steps where the lead melody also attacks so both sit cleanly
        const hasLeadAttack = Boolean(track.melodySteps && track.melodySteps[s] > 0);
        const arpPeak = hasLeadAttack ? 0.030 : 0.046;
        const arpDur = this.stepDurationSec * 2.4;

        arpGain.gain.setValueAtTime(0.0005, time);
        arpGain.gain.linearRampToValueAtTime(arpPeak, time + 0.01);
        arpGain.gain.linearRampToValueAtTime(arpPeak * 0.62, time + arpDur * 0.55);
        arpGain.gain.exponentialRampToValueAtTime(0.0005, time + arpDur);

        arpOsc.connect(arpGain);
        arpGain.connect(dest);
        arpOsc.onended = () => {
          try { arpOsc.disconnect(); arpGain.disconnect(); } catch (e) {}
        };
        arpOsc.start(time);
        arpOsc.stop(time + arpDur + 0.02);
      }

      // 3. Deep Warm Sustained Bassline Foundation
      const bassBars = track.bassBars || [];
      const bassRow = bassBars[barIdx % Math.max(1, bassBars.length)] || [];
      const bassFreq = bassRow[stepInBar] || 0;
      if (bassFreq > 0) {
        const osc = this.ctx.createOscillator();
        const subOsc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = arch.bassWave === 'sawtooth' ? 'triangle' : arch.bassWave || 'triangle';
        subOsc.type = 'sine';
        osc.frequency.setValueAtTime(bassFreq, time);
        subOsc.frequency.setValueAtTime(bassFreq, time);

        const bassDur = this.stepDurationSec * 3.6;
        gain.gain.setValueAtTime(0.0008, time);
        gain.gain.linearRampToValueAtTime(0.068, time + 0.014);
        gain.gain.linearRampToValueAtTime(0.048, time + bassDur * 0.65);
        gain.gain.exponentialRampToValueAtTime(0.0008, time + bassDur);

        osc.connect(gain);
        subOsc.connect(gain);
        gain.connect(dest);
        osc.onended = () => {
          try { osc.disconnect(); subOsc.disconnect(); gain.disconnect(); } catch (e) {}
        };
        osc.start(time);
        subOsc.start(time);
        osc.stop(time + bassDur + 0.02);
        subOsc.stop(time + bassDur + 0.02);
      }

      // 4. Figurine Signature Singing Lead Instrument Melody (with true ADSR sustain & vibrato)
      const melFreq = (track.melodySteps && track.melodySteps[s]) || 0;
      if (melFreq > 0) {
        const durSteps = (track.melodyDurSteps && track.melodyDurSteps[s]) || 3;
        const osc = this.ctx.createOscillator();
        const overtone = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const overGain = this.ctx.createGain();
        let lfo = null;
        let lfoGain = null;

        osc.type = arch.leadWave || 'sine';
        osc.frequency.setValueAtTime(melFreq, time);
        overtone.type = arch.overWave || 'triangle';
        overtone.frequency.setValueAtTime(melFreq * (arch.overRatio || 2.0), time);

        const isBrightWave = arch.leadWave === 'square' || arch.leadWave === 'sawtooth';
        const peakLeadGain = isBrightWave ? 0.056 : 0.088;
        const leadAtt = Math.max(0.006, arch.leadAttack || 0.01);
        const leadDur = this.stepDurationSec * Math.max(2.4, durSteps * 0.96);

        // True ADSR Envelope: Attack -> Singing Sustain Plateau -> Smooth Release
        gain.gain.setValueAtTime(0.0008, time);
        gain.gain.linearRampToValueAtTime(peakLeadGain, time + leadAtt);
        gain.gain.linearRampToValueAtTime(peakLeadGain * 0.74, time + leadDur * 0.70);
        gain.gain.exponentialRampToValueAtTime(0.0007, time + leadDur);

        const overDur = Math.min(leadDur * 0.65, this.stepDurationSec * 2.2);
        overGain.gain.setValueAtTime(0.0005, time);
        overGain.gain.linearRampToValueAtTime(arch.overGain || 0.024, time + 0.006);
        overGain.gain.linearRampToValueAtTime((arch.overGain || 0.024) * 0.45, time + overDur * 0.5);
        overGain.gain.exponentialRampToValueAtTime(0.0004, time + overDur);

        // Gentle expressive vibrato on sustained melody notes (durSteps >= 4)
        if (durSteps >= 4) {
          try {
            lfo = this.ctx.createOscillator();
            lfoGain = this.ctx.createGain();
            lfo.type = 'sine';
            lfo.frequency.setValueAtTime(5.2, time);
            lfoGain.gain.setValueAtTime(0.1, time);
            lfoGain.gain.linearRampToValueAtTime(melFreq * 0.0045, time + leadDur * 0.35);
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            lfo.start(time);
            lfo.stop(time + leadDur + 0.02);
          } catch (_e) {}
        }

        osc.connect(gain);
        overtone.connect(overGain);
        gain.connect(dest);
        overGain.connect(dest);

        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
            overtone.disconnect();
            overGain.disconnect();
            if (lfo) lfo.disconnect();
            if (lfoGain) lfoGain.disconnect();
          } catch (e) {}
        };
        osc.start(time);
        overtone.start(time);
        osc.stop(time + leadDur + 0.025);
        overtone.stop(time + overDur + 0.02);
      }

      // 5. Warm Duet Counter-Harmony Voice
      const harmFreq = (track.harmonySteps && track.harmonySteps[s]) || 0;
      if (harmFreq > 0) {
        const hOsc = this.ctx.createOscillator();
        const hGain = this.ctx.createGain();
        hOsc.type = 'triangle';
        hOsc.frequency.setValueAtTime(harmFreq, time);
        const hDur = this.stepDurationSec * 2.8;
        hGain.gain.setValueAtTime(0.0004, time);
        hGain.gain.linearRampToValueAtTime(0.036, time + 0.012);
        hGain.gain.linearRampToValueAtTime(0.024, time + hDur * 0.65);
        hGain.gain.exponentialRampToValueAtTime(0.0004, time + hDur);
        hOsc.connect(hGain);
        hGain.connect(dest);
        hOsc.onended = () => {
          try { hOsc.disconnect(); hGain.disconnect(); } catch (e) {}
        };
        hOsc.start(time);
        hOsc.stop(time + hDur + 0.02);
      }

      // 6. Soft Tactile Focus Groove (1 = Warm Heartbeat Pulse, 2 = Soft Wood Rim, 3 = Gentle Brush Tick)
      const drumHit = (style.drumPattern && style.drumPattern[stepInBar]) || 0;
      if (drumHit > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        let stopOffset = 0.024;
        if (drumHit === 1) {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(118, time);
          osc.frequency.exponentialRampToValueAtTime(44, time + 0.065);
          gain.gain.setValueAtTime(0.0005, time);
          gain.gain.linearRampToValueAtTime(0.042, time + 0.004);
          gain.gain.exponentialRampToValueAtTime(0.0005, time + 0.07);
          stopOffset = 0.075;
        } else if (drumHit === 2) {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(arch.percPitchLow || 620, time);
          osc.frequency.exponentialRampToValueAtTime(210, time + 0.036);
          gain.gain.setValueAtTime(0.0005, time);
          gain.gain.linearRampToValueAtTime(0.030, time + 0.003);
          gain.gain.exponentialRampToValueAtTime(0.0005, time + 0.04);
          stopOffset = 0.045;
        } else {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(arch.percPitchHigh || 1180, time);
          osc.frequency.exponentialRampToValueAtTime(580, time + 0.018);
          gain.gain.setValueAtTime(0.0004, time);
          gain.gain.linearRampToValueAtTime(0.015, time + 0.002);
          gain.gain.exponentialRampToValueAtTime(0.0004, time + 0.02);
          stopOffset = 0.024;
        }
        osc.connect(gain);
        gain.connect(dest);
        osc.onended = () => {
          try { osc.disconnect(); gain.disconnect(); } catch (e) {}
        };
        osc.start(time);
        osc.stop(time + stopOffset);
      }
    }

    startStudioAmbient() {
      this.ambientEnabled = true;
      if (this.muted || this.hidden || this.adPlaying) return;
      if (this.musicTimer) {
        this.bgmPlaying = true;
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        return;
      }
      const ctx = this.initContext(true);
      if (!ctx || this.hidden || this.adPlaying) return;

      this.bgmPlaying = true;
      this.nextNoteTime = ctx.currentTime + 0.03;
      this.musicTimer = setInterval(() => {
        if (!this.ctx || this.muted || !this.ambientEnabled || this.hidden || this.adPlaying) return;
        if (this.ctx.state !== 'running') {
          if (this.hidden || this.adPlaying) return;
          this.ctx.resume().catch(() => {});
          return;
        }
        const now = this.ctx.currentTime;
        // Guard against clock drift or tab backgrounding so the loop never stalls or bursts stale steps
        if (this.nextNoteTime < now - 0.06 || this.nextNoteTime > now + 1.2) {
          this.nextNoteTime = now + 0.025;
        }
        const maxSteps =
          this.currentTrack && this.currentTrack.melodySteps
            ? this.currentTrack.melodySteps.length
            : 256;
        while (this.nextNoteTime < now + 0.22) {
          if (this.hidden || this.adPlaying) break;
          try {
            this._scheduleMusicStep(this.musicStep, this.nextNoteTime);
          } catch (_e) {}
          this.nextNoteTime += this.stepDurationSec;
          this.musicStep = (this.musicStep + 1) % maxSteps;
        }
      }, 50);
    }

    stopStudioAmbient(keepPreference = false) {
      if (!keepPreference) {
        this.ambientEnabled = false;
      }
      this.bgmPlaying = false;
      if (this.musicTimer) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
    }
  }

  window.PopStacksAudio = PopStacksAudio;
})();
