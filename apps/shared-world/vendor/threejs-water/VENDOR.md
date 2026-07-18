# VENDOR.md — jeantimex/threejs-water (pristine vendored copy)

Provenance record required by Checkpoint 00 (§3, §6.2, §6.4) of the BodyArcade
shared-world ladder. This file is the ONLY non-upstream file in this directory.
Every other file under `apps/shared-world/vendor/threejs-water/` is a
byte-for-byte copy of the upstream repository and MUST NEVER be edited —
adaptation happens later in app-owned copies/wrappers per the sanctioned
minimal-edit family (Implementation Master §4.2).

## Provenance

- **Clone URL:** `https://github.com/jeantimex/threejs-water`
- **Upstream HEAD SHA:** `09d3c41b87afe6465dc9814839c87c44e67d85dc`
- **HEAD commit:** `2026-06-27 16:34:22 -0700` — "allow to zoom in more"
- **Clone date (UTC):** `2026-07-18T04:43:29Z`
- **License:** MIT — "Original work Copyright (c) 2011 Evan Wallace / Modified
  work Copyright (c) 2026 Yong Su" (full text in `LICENSE`, vendored). This
  matches Track B's "Verified sources and licenses" expectation exactly.
- **Copied:** entire upstream tree excluding `.git/` and `node_modules/`
  (none present): 78 files — source (`src/`), shaders, `public/` assets
  (sky cubemap, tiles, duck model), `index.html`, `package.json`,
  `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `LICENSE`,
  `README.md`, dotfiles (`.gitignore`, `.prettierignore`, `.prettierrc`).
- **Not a git submodule.** Plain files, committed.
- **`vite-plugin-glsl` version in vendored `package.json`:** `^1.3.0` —
  matches the Checkpoint 00 §6.1 expectation (no difference to record).
- Upstream deps (vendored `package.json`): `three ^0.184.0`,
  `lil-gui ^0.21.0`, dev `vite ^6.4.3`, `typescript ^5.4.0`,
  `vite-plugin-glsl ^1.3.0` — internal name `webgl-water-threejs`, as
  Track B recorded.

## Integrity manifest

Method: from `apps/shared-world/vendor/threejs-water/`, per-file SHA-256 over
every file except this `VENDOR.md`, paths prefixed `./`, sorted in C-locale
(byte) order, two-space separator (`shasum -a 256` format); the **aggregate
hash** is the SHA-256 of that manifest text. Reproduce with:

```
find . -type f ! -name 'VENDOR.md' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256
```

- **Aggregate manifest SHA-256:** `e8783a829b280411ed894f0388adaada81c575e2265fea6ece5d73aca770f1bd`
- **File count:** 78

The automated guard `apps/shared-world/tests/scaffold.spec.ts` recomputes this
aggregate on every suite run and fails on any byte drift.

<details>
<summary>Full per-file manifest (78 entries)</summary>

```
07746f98301fd604a6fac29e2ec619cfb05c6c9b0b4d7be94a5919cdf9321ab3  ./.gitignore
e7380afd43c526b1b6d94ce0b5858f4ec914f2d4b0960a5e7b40340c66f65d21  ./.prettierignore
318a8eeccd0825d06ee95e9377f560c95ef6552c7d0abf58003be50071d582b2  ./.prettierrc
f50bbc0f2cbca1fb64d0e6133329a309a88bd6bfd92b80fcb103119aca3e0e1c  ./LICENSE
5c2c8010462ef2b8e0b1f9073d1af94d195b63a00fc21b8c582f3cb7820389ef  ./README.md
4b1df21f30314057a77c6d67f0417f1959da90896c6954c84818269939df8cb3  ./index.html
3635636b6789307a3e3d48dc45f59e34572d5f444006e6fc26a7bd37d25311e8  ./package-lock.json
ffe4c7da6ff381c2f5c30ac25ace558e0826b1ddaa01e180a1dfcafc4b22287a  ./package.json
98009069c87b165df92dbc8213d7c2b4f296074097ad2ec4efddf3dbc50cdcb0  ./public/models/duck/Duck.gltf
4c851f5909095ecf77e66e0968c31d5354f17a49b62e1fad0c341e1635145ee9  ./public/models/duck/Duck0.bin
8aedb428cbb815dffea650fe75bff032ea240f00ccad2f64dc8f62a0c5e30313  ./public/models/duck/DuckCM.png
da7dbbe829553807fd72fc66514765d8af26b0c326b6664c4ac3be57271c2f69  ./public/tiles.jpg
185a3f41c7abd381454d7d3938bb1b885ceca760b0292cc30a04435ffc2b25db  ./public/xneg.jpg
80a126350786e8a1f61e3ec8b825003faf00498d9ebebd7173afa2c1ace1f764  ./public/xpos.jpg
e973e3033fb2a3c2f80a8a10cddc78e808f70a93a868fa8ac3cf41b8e822ddb4  ./public/ypos.jpg
6c2fbb8af830820b6c980494d9d6f16e99e51a11d16f21c14853c6df535c03e6  ./public/zneg.jpg
a54e18536d0957188108fd95d39669ec88a338a519a174598b90afb4abefb0b1  ./public/zpos.jpg
a6a796abe312ef5f55b8c05cd6b6b7827d840c1c302177bec2ac7b8593efb342  ./src/Renderer.ts
f38b59e48ca4d584560ebfaee5987e4b5803165b18b6ed322afd9b97cfbcf685  ./src/Water.ts
c6a1819c4eeb5736a37fad3d71fa638aff1a2f7ff4ed86d3c88a20d64471e8f0  ./src/app/InteractionController.ts
c3f2006f65f3f269b4dccbd194d9f4c129cf35127e6c6c86a0347d762f72972e  ./src/app/LoadSceneAssets.ts
b68c401ea974780fdeec8b2c90c88598e205884cd4c6bee048111788fe23a0e8  ./src/app/SimulationControls.ts
96d63c81f5ecd2d320a34f4b2248bb93f40e58c254d81ce292666757e65cfef4  ./src/app/WaterApp.ts
a91b1e391904f9b2b6697d143686589610463a13f43b03b7f5f98d128174aa4c  ./src/camera/CameraController.ts
3dea397644ba7eab136d90fc3639d0972a47f0f9bf0c79df7ec0f04dd6ed8689  ./src/main.ts
66dc7091e07b53fe539d0a479439c195f708392962816abed40da9e961a164b5  ./src/objects/CreateSimulationObjects.ts
9a7eb4b0674e6018e1d23ce078215484ac0b49cf1216bb6488c68a930b218ffc  ./src/objects/CubeObject.ts
e48346bd648c77282d892b9e74de4320885091c5f00a7a775431eb4b1541a391  ./src/objects/DuckObject.ts
c4e1f53b38b9cfdb97148ebc802565d5d83e097ea43c65a1a41d14c399c0b932  ./src/objects/SimulationObject.ts
d315c6736344b0bc6bf63d317f9a5def7892c3d856a568ab451addd9660928e0  ./src/objects/SimulationObjectRegistry.ts
d80249c2e6d12184189fb324b5d72c42003ea054bdd8128604fb906379c63343  ./src/objects/SimulationObjectUtils.ts
f9d85a54725564b959bc12a071e0912aeab871ad8a24f9d45e36f81282f80ee6  ./src/objects/SphereObject.ts
212d6298cefb016e13190ac4189c396aa033ba8c753508255db3c9f96a2d1788  ./src/objects/TorusKnotObject.ts
45a47b98bfe8e0de750f7cc963f64130aa913671141834ac5571a4d719b5da58  ./src/rendering/CausticsPass.ts
556f0ca8f9d688b387e7e519690c41c1dfeb64feb4d77008b0c4ff231f639653  ./src/rendering/CreateRoundedBoxPoolGeometry.ts
17917120f3c1ad2b95336738e05a60e6e446bb513bc4486fb1f2850cfd451074  ./src/rendering/ObjectTexturePass.ts
70b2461c4bb9f9c264178a2126ad3d5246d78dfb8b82f359b59704596e0f3dfe  ./src/rendering/PoolPass.ts
a4dc71ab521fb8adda219d9d73954527e9ac65863cd2c09b6e8810a31634d255  ./src/rendering/SimulationObjectRendering.ts
653a2705b464451b17fa78834227d1f26d70ae1a67b6c1da4c7d01f4b0758a01  ./src/rendering/WaterOpticsState.ts
dfcb7c825bc368f5bd8e27bc1e9d0fb3495aa0d90c93db2dd99fa19deee611dd  ./src/rendering/WaterSurfacePass.ts
0427342939107d9ef5ee0650e181059aad537c4072ef2db6b15a1845de97d705  ./src/shaders/BoxDisplacement.frag
e4a4345c87f78709dd34ae02366fc6e39ad697b241bc0af169e14bd798a88dce  ./src/shaders/Caustics.frag
cf82bcaf25755cc287db713de6891cb7e7824d1dbd96613578e85d459005fc19  ./src/shaders/Caustics.vert
88a6bdb8545d2b857d89ede00d186028456affd8036a3b83892434962cafaa82  ./src/shaders/Cube.frag
fa3bf3d1c36c318e26a071c54d9c2206f6d030d617743d20418040324bf97981  ./src/shaders/Cube.vert
e53cf333f0f6fa2992ca96d8dff64d8d2aa73a8338c2ea091ff9a56bf2245397  ./src/shaders/DuckRender.frag
47588c3e8c96acc50175666a94de98bdbaf543f09416c87b2bc56926dc6f7bfe  ./src/shaders/DuckRender.vert
2774a5dca558b4221fc79177b9f1887e805feddff33fcefa7c4e0e31fd12f284  ./src/shaders/ObjectCubeRender.frag
0cadf30d0687294560fe2e00f732e7a67fd3ef7bc84cb348135031541052bcb3  ./src/shaders/ObjectCubeRender.vert
067f7d7ca9c9f45260f441d2262a74d92eeced07c080417deea578a2446ae351  ./src/shaders/RoundedBox.frag
d6b826aa1f6d794f4baf2a084eb0fccb54f3d79ed0e0d73f34a1a4b4aa267ef3  ./src/shaders/RoundedBox.vert
0186023d125921df3f663511e60780d1e702ae3721551bdf61ba53009ef33f45  ./src/shaders/RoundedBoxCaustics.frag
37392f4242755dcf17ce62b8b46755ec92ba1d70eb94623bd10bb5dba7fe450d  ./src/shaders/RoundedBoxCaustics.vert
f57be072cc3558c1ea7e3d9e015b0fb4820ff189b32c5b66b71ab2547fa4fe41  ./src/shaders/RoundedBoxWater.vert
adaca278856aef5462445121105da7822c4d3ef447aa1005385a776bc439d57d  ./src/shaders/RoundedBoxWaterAbove.frag
6898032ddddab1cfa4812d5fadcd0502bf557e829da3d9db97fd98fdb384064e  ./src/shaders/RoundedBoxWaterBelow.frag
87897bbb0db1235643861fa34721ecaccd0e09bb06652914e778527c0d18b50a  ./src/shaders/Sphere.frag
d64091c3b08be3533acf3decfbd1a2e6bac1487ded02e9d0630bfe6bbb188a9d  ./src/shaders/Sphere.vert
7d3e30b1d06cf31151349800f33e50036df824a0df69b8397a6357442bc51f84  ./src/shaders/SphereRender.frag
7ba939319d037ffad1d249ad42ad0fb649f2976f3b6c21777c020b1d47b1844d  ./src/shaders/SphereRender.vert
74666a1ba72e869c06ffc2f75c5e8f506cd58d1ac588ebfb1eed4f2fd6482780  ./src/shaders/TorusKnotRender.frag
ba3f52fe74236671ca984034e0519cd1814f6497558d0648d93f66c117496c43  ./src/shaders/TorusKnotRender.vert
4c427891d09f8ed637fc65a9238e144d7c056e614634b509e21e51dabe8db3d1  ./src/shaders/WaterAbove.frag
361edcae4dfa147028a9209aab9691b11e6ad3524138b3781a11ca6b336512fd  ./src/shaders/WaterAbove.vert
caa977b868f7d32a4e84369b9892f4bee34984df2ad99db7175db558790d3094  ./src/shaders/WaterBelow.frag
0189824317701bdec1d1789d22146bfcccd5dbf7cfc337ac459bc62bfa346597  ./src/shaders/WaterBelow.vert
e35a1685aa8e37b0856207861b8d4add2f50473825e8c427c270dcdc205883cc  ./src/shaders/WaterNormal.frag
dc2b7267fd5a8e257378a1f60d4b81ff7e25f2c6b87584be73223d9151218167  ./src/shaders/WaterNormal.vert
5483fd36eb0e7bb52e60abcbe871985def4e61d39940179df834a40c5d389aea  ./src/shaders/WaterRipple.frag
d5d2a3f84ff8df3e1f1a61611e1c28085f752cebe51cb2a9bd785d54578f1d10  ./src/shaders/WaterRipple.vert
3c933cf631428edd0ce731580e537840e5b1434ec54ceffd4a4664f85e897823  ./src/shaders/WaveSimulation.frag
d5d2a3f84ff8df3e1f1a61611e1c28085f752cebe51cb2a9bd785d54578f1d10  ./src/shaders/WaveSimulation.vert
a90b1658831ac217bf0b734a4c4eea1a37b2022f3689a560c596adce547951d7  ./src/styles.css
deb5a4d023fd63139a0829a3807cece7e19d96d50f4967c7df948b2b42299271  ./src/vite-env.d.ts
c9042e7429aa02e6a34e19eb3e88223c92aa3ee1b50228acf95d77b17ec7f448  ./src/water/WaterDisplacement.ts
11968018dd034d1865ea25d16383ed17885b742d5da0125f848e42602d41a13d  ./src/water/WaterOptics.ts
08316fe7b2133d3aaacdfd5eb393b0d7cb49c0fc9d69eb839c7d1bea81a9a61f  ./tsconfig.json
67867c3f666619b1e4e13a75a95d23a1fce71a4de4469202f44b35f3533c91dd  ./vite.config.ts
```

</details>

## Assumption-site confirmation (Checkpoint 00 §6.4 vs Track B Table 1)

All eight sites grep-confirmed in the vendored source at HEAD
`09d3c41`. **Result: 8/8 MATCH, 0 DRIFT.** Track B Table 1's expectations
(derived from Evan Wallace's original `renderer.js`, since jeantimex's blobs
were robots-blocked to the Track B fetcher) hold at this HEAD. Structural
notes below are location/layout observations, not semantic drift; none
requires adaptation.

### 1. `intersectCube` + cube bounds — **MATCH**

Present with the exact expected signature and bounds in the classic
(rectangular "Box" pool) shader set:

- `vec2 intersectCube(vec3 origin, vec3 ray, vec3 cubeMin, vec3 cubeMax)` —
  `src/shaders/WaterAbove.frag:56`, `src/shaders/WaterBelow.frag:38`,
  `src/shaders/Cube.frag:49`, `src/shaders/Caustics.frag:57`,
  `src/shaders/Caustics.vert:31`, `src/shaders/RoundedBoxWaterAbove.frag:240`,
  `src/shaders/RoundedBoxWaterBelow.frag:237`.
- Exact expected bounds `vec3(-1.0, -poolHeight, -1.0)` /
  `vec3(1.0, 2.0, 1.0)`: `WaterAbove.frag:366,475,480`,
  `WaterBelow.frag:270,357,361`, `Cube.frag:161`, `Caustics.frag:435`,
  `Caustics.vert:59`.

Structural note: the port also carries a parallel **rounded-box** shader set
(`RoundedBoxWaterAbove/Below.frag`, `RoundedBoxCaustics.*`, `RoundedBox.*`)
in which the pool is parameterized (`intersectRoundedBox(origin, ray, R)` at
`RoundedBoxWaterAbove.frag:174`, bounds from `cubeCenter ± cubeHalfSize`,
uniform pool dimensions). Track B Table 1 anticipated the two-set structure
(its confirmed file list includes both sets). The classic Box set is the
Wallace-original geometry the container swap (Master §4.2) targets.

### 2. `poolHeight` — **MATCH**

- Classic set: `const float poolHeight = 1.0;` exactly as expected —
  `src/shaders/WaterAbove.frag:24`, `src/shaders/WaterBelow.frag:7`,
  `src/shaders/Cube.frag:22`, `src/shaders/Caustics.frag:20`.
- Rounded set: `uniform float poolHeight;` (`RoundedBox.frag:51`,
  `RoundedBoxWaterBelow.frag:60`, `RoundedBoxCaustics.vert:28`, `.frag:45`,
  `SphereRender.frag:32`, `TorusKnotRender.frag:33`), driven by lil-gui
  (`src/app/SimulationControls.ts:32,46,158-162`; default 1.0, slider
  0.3–2.0) and forced to `1.0` whenever `poolShape === 'Box'`
  (`src/app/WaterApp.ts:83` et al., `src/app/InteractionController.ts:155`).

Track B expected "`const float poolHeight = 1.0;` or a uniform" — both forms
exist, const in the classic set, uniform in the rounded set. Pool-phase
mount work (Master §7.7) assumes the Box pool: bounds 2×2×1 confirmed
(x,z ∈ [−1,1], y ∈ [−poolHeight, 2] with poolHeight = 1.0).

### 3. Wave-sim resolution (`src/Water.ts`) — **MATCH**

`const size = 256; // Resolution of the wave height simulation grid` —
`src/Water.ts:55`; double-buffered ping-pong render targets
(`textureA`/`textureB`) as expected. Track B's 256² inference (from the
sibling `webgpu-water`) is confirmed in this repo's source.

### 4. Render-target resolutions — **MATCH** (values), location note

- Caustics: **1024×1024** — `src/rendering/CausticsPass.ts:50`
  (`new THREE.WebGLRenderTarget(1024, 1024, …)`). Matches the expected 1024².
- Additional object-texture targets (additive; port features):
  `src/rendering/ObjectTexturePass.ts:85-88` — reflection 512²,
  clipped-reflection 512², refraction 512², shadow 1024²; dynamic scaling
  capped at 1024 max dimension (`ObjectTexturePass.ts:123-129`).

Location note: Checkpoint 00 §6.4 said "render-target resolutions in
`src/Renderer.ts`" — at this HEAD the targets live in
`src/rendering/{CausticsPass,ObjectTexturePass}.ts`; `src/Renderer.ts`
orchestrates the passes. Same pipeline, more modular file layout.

### 5. Drop/displacement entry points and object uniforms — **MATCH**

Exact recorded names:

- `Water.addDrop(x, y, radius, strength, poolWidth = 1.0, poolLength = 1.0)`
  — `src/Water.ts:181`; drop uniforms `center`, `radius`, `strength`.
- `Water.moveSphere(oldCenter, newCenter, radius, displacementScale = 1.0,
  poolWidth, poolLength)` — `src/Water.ts:209`; uniforms
  `oldCenter`/`newCenter`/`radius`/`displacementScale`.
- `Water.moveCube(oldCenter, newCenter, halfSize, poolWidth, poolLength)` —
  `src/Water.ts:238`.
- Object uniforms `sphereCenter`/`sphereRadius` present as expected —
  `src/objects/SphereObject.ts:52-53,164-165`,
  `src/rendering/WaterOpticsState.ts:20-22,86`, shader uniforms at
  `RoundedBoxWaterBelow.frag:31-32` (and peers). Additive port uniforms:
  `cubeCenter`/`cubeHalfSize`, `torusKnotCenter`, `meshCenter`/
  `meshBoundingRadius`/`meshShadowRadius` (+ `*Enabled` flags).
- Object factory: `src/objects/CreateSimulationObjects.ts` (Track B listed
  the filename without path; it sits under `src/objects/`).

### 6. `getWallColor` / `getSurfaceRayColor` — **MATCH**

- `getWallColor`: `src/shaders/Cube.frag`, `RoundedBox.frag`,
  `WaterAbove.frag`, `WaterBelow.frag`, `RoundedBoxWaterBelow.frag`.
- `getSurfaceRayColor`: `src/shaders/WaterAbove.frag`, `WaterBelow.frag`,
  `RoundedBoxWaterAbove.frag`, `RoundedBoxWaterBelow.frag`.

Both compositing functions present in both shader families; these are the
functions the later container swap must keep byte-identical in consumption.

### 7. `Renderer.ts` pass switch — **MATCH**

`Renderer.setPoolShape(shape, cornerRadius, poolWidth, poolHeight,
poolLength)` — `src/Renderer.ts:126-139` — selects between the classic
`'Box'` shader set and the rounded-box set, delegating to `PoolPass`,
`CausticsPass`, and `WaterSurfacePass` (`this.pool/caustics/waterSurface
.setPoolShape(…)`). This is the "rectangular vs rounded pool" selection
Track B expected, and the seam where a "region" pool type is added later
(Master §4.2, checkpoint 04B — not now).

### 8. Sky/environment asset — **MATCH** (paths recorded)

Reflections sample a cubemap loaded by `THREE.CubeTextureLoader` in
`src/app/LoadSceneAssets.ts:31-38` from (relative to
`import.meta.env.BASE_URL`):

- `public/xpos.jpg`, `public/xneg.jpg`, `public/ypos.jpg` (used for **both**
  +Y and −Y faces), `public/zpos.jpg`, `public/zneg.jpg`

with `flipY = true`, `NoColorSpace`, `LinearFilter` min/mag. Also recorded:
pool tile texture `public/tiles.jpg`, duck model
`public/models/duck/{Duck.gltf,Duck0.bin,DuckCM.png}`. Per R11 / the
fidelity hierarchy, this sky ships unchanged through the slice.
