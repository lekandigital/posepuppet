// Test-only registry for generated candidate VRM avatars.
// These do NOT appear in the normal public UI cycling; they can only be loaded
// via the ?generatedAvatar=<slug> query parameter for browser smoke testing.

export interface GeneratedAvatarDef {
  id: string;
  label: string;
  url: string;
  /** Never true — generated avatars are test/dev only. */
  enabledInUi: false;
  warningLabel: 'experimental';
  profile: 'humanoid' | 'creature' | 'hand_only';
  source: 'generated-vrm-smoke-test';
  loader?: 'vrm' | 'raw-gltf';
  /** Query-param-only display normalization for generated candidate QA. */
  stageProfile?: {
    targetSize?: number;
    rootRotation?: [number, number, number];
    rootPosition?: [number, number, number];
  };
}

/**
 * Registered generated avatar candidates.
 * Add new entries here as conversion succeeds; they remain invisible to
 * the public UI until explicitly promoted to avatarRegistry.ts.
 */
export const GENERATED_AVATARS: Record<string, GeneratedAvatarDef> = {
  woody: {
    id: 'woody',
    label: 'Woody Candidate VRM',
    url: '/avatars/generated/woody.vrm',
    enabledInUi: false,
    warningLabel: 'experimental',
    profile: 'humanoid',
    source: 'generated-vrm-smoke-test',
  },
  'darth-vader': {
    id: 'darth-vader',
    label: 'Darth Vader Candidate VRM',
    url: '/avatars/generated/darth-vader.vrm',
    enabledInUi: false,
    warningLabel: 'experimental',
    profile: 'humanoid',
    source: 'generated-vrm-smoke-test',
  },
  'fortnite-batman': {
    id: 'fortnite-batman',
    label: 'Fortnite Batman Candidate VRM',
    url: '/avatars/generated/fortnite-batman.vrm',
    enabledInUi: false,
    warningLabel: 'experimental',
    profile: 'humanoid',
    source: 'generated-vrm-smoke-test',
  },
  'iron-man': {
    id: 'iron-man',
    label: 'Iron Man Candidate VRM',
    url: '/avatars/generated/iron-man.vrm',
    enabledInUi: false,
    warningLabel: 'experimental',
    profile: 'humanoid',
    source: 'generated-vrm-smoke-test',
  },
  shrek: {
    id: 'shrek',
    label: 'Shrek Candidate VRM',
    url: '/avatars/generated/shrek.vrm',
    enabledInUi: false,
    warningLabel: 'experimental',
    profile: 'humanoid',
    source: 'generated-vrm-smoke-test',
  },
  'amazing-spider-man-2': {
    id: 'amazing-spider-man-2',
    label: 'Amazing Spider-Man 2 Candidate VRM',
    url: '/avatars/generated/amazing-spider-man-2.vrm',
    enabledInUi: false,
    warningLabel: 'experimental',
    profile: 'humanoid',
    source: 'generated-vrm-smoke-test',
  },
  'terminator-t-800': {
    id: 'terminator-t-800',
    label: 'Terminator T-800 Candidate VRM',
    url: '/avatars/generated/terminator-t-800.vrm',
    enabledInUi: false,
    warningLabel: 'experimental',
    profile: 'humanoid',
    source: 'generated-vrm-smoke-test',
  },
  'spider-man-no-way-home': {
    id: 'spider-man-no-way-home',
    label: 'Spider-Man No Way Home Candidate VRM',
    url: '/avatars/generated/spider-man-no-way-home.vrm',
    enabledInUi: false,
    warningLabel: 'experimental',
    profile: 'humanoid',
    source: 'generated-vrm-smoke-test',
  },
  'spider-man-playstation': {
    id: 'spider-man-playstation',
    label: 'Spider-Man PlayStation Candidate VRM',
    url: '/avatars/generated/spider-man-playstation.vrm',
    enabledInUi: false,
    warningLabel: 'experimental',
    profile: 'humanoid',
    source: 'generated-vrm-smoke-test',
  },
  'jack-sparrow': {
    id: 'jack-sparrow',
    label: 'Jack Sparrow Candidate VRM',
    url: '/avatars/generated/jack-sparrow.vrm',
    enabledInUi: false,
    warningLabel: 'experimental',
    profile: 'humanoid',
    source: 'generated-vrm-smoke-test',
  },
  elsa: {
    id: 'elsa',
    label: 'Elsa Candidate VRM',
    url: '/avatars/generated/elsa.vrm',
    enabledInUi: false,
    warningLabel: 'experimental',
    profile: 'humanoid',
    source: 'generated-vrm-smoke-test',
    loader: 'raw-gltf',
  },
  'buzz-lightyear': {
    id: 'buzz-lightyear',
    label: 'Buzz Lightyear Candidate VRM',
    url: '/avatars/generated/buzz-lightyear.vrm',
    enabledInUi: false,
    warningLabel: 'experimental',
    profile: 'humanoid',
    source: 'generated-vrm-smoke-test',
  },
  'teal-v2': {
    id: 'teal-v2',
    label: 'Teal v2 Candidate VRM',
    url: '/avatars/generated/teal-v2.vrm',
    enabledInUi: false,
    warningLabel: 'experimental',
    profile: 'humanoid',
    source: 'generated-vrm-smoke-test',
  },
};

/** Look up a generated avatar by slug. Returns undefined for unknown slugs. */
export function getGeneratedAvatarDef(slug: string): GeneratedAvatarDef | undefined {
  return GENERATED_AVATARS[slug];
}
