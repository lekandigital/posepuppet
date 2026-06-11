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
};

/** Look up a generated avatar by slug. Returns undefined for unknown slugs. */
export function getGeneratedAvatarDef(slug: string): GeneratedAvatarDef | undefined {
  return GENERATED_AVATARS[slug];
}
