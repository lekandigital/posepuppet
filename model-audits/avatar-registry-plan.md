# Avatar registry plan

Documentation only. Do not modify `src/rig/avatarRegistry.ts` until explicitly asked.

| Avatar | Profile | Warning | Add now | Required before enable | Spec |
|---|---|---|---:|---|---|
| Woody | humanoid | experimental | false | convert_to_vrm, load_test, orientation_test | `model-audits/woody/avatar-adapter-spec.json` |
| Darth Vader | humanoid | conversion-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/darth-vader/avatar-adapter-spec.json` |
| Fortnite Batman | humanoid | conversion-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/fortnite-batman/avatar-adapter-spec.json` |
| Iron Man | humanoid | conversion-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/iron-man/avatar-adapter-spec.json` |
| Shrek | humanoid | conversion-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/shrek/avatar-adapter-spec.json` |
| Spider-Man No Way Home | humanoid | conversion-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/spider-man-no-way-home/avatar-adapter-spec.json` |
| Spider-Man PlayStation | humanoid | conversion-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/spider-man-playstation/avatar-adapter-spec.json` |
| The Amazing Spider-Man 2 | humanoid | conversion-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/amazing-spider-man-2/avatar-adapter-spec.json` |
| Terminator T-800 | humanoid | conversion-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/terminator-t-800/avatar-adapter-spec.json` |
| Jack Sparrow | humanoid_with_offsets | conversion-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/jack-sparrow/avatar-adapter-spec.json` |
| Elsa | humanoid_with_offsets | cleanup-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/elsa/avatar-adapter-spec.json` |
| Grogu | creature | creature-profile-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/grogu/avatar-adapter-spec.json` |
| King Kong | creature | creature-profile-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/king-kong/avatar-adapter-spec.json` |
| Olaf | creature | creature-profile-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/olaf/avatar-adapter-spec.json` |
| Godzilla | creature | creature-profile-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/godzilla/avatar-adapter-spec.json` |
| Xenomorph | creature | creature-profile-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/xenomorph/avatar-adapter-spec.json` |
| Rigged Hand | hand_only | hand-only | false | convert_to_vrm, load_test, orientation_test | `model-audits/rigged-hand/avatar-adapter-spec.json` |
| Teal v2 | humanoid_with_offsets | cleanup-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/teal-v2/avatar-adapter-spec.json` |
| Buzz Lightyear | humanoid_with_offsets | cleanup-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/buzz-lightyear/avatar-adapter-spec.json` |
| Baby Yoda | creature | creature-profile-needed | false | convert_to_vrm, load_test, orientation_test | `model-audits/baby-yoda/avatar-adapter-spec.json` |

## Buckets

- Safe to add to registry now: none.
- Safe behind feature flag after conversion/load/orientation tests: Woody, Darth Vader, Fortnite Batman, Iron Man, Shrek, Spider-Man variants, Terminator.
- Convert first: all humanoid candidates without completed conversion diff.
- Cleanup first: Elsa, Buzz Lightyear, Teal v2, Jack Sparrow if offsets/clothing fail.
- Custom profile first: Godzilla, King Kong, Xenomorph, Grogu, Olaf, Baby Yoda.
- Ignore for now: none hard-blocked, but low-scoring models should stay out of UI until improved.
