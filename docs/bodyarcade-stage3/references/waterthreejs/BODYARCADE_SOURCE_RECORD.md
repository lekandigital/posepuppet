# WaterThreeJS Source Record

- Project: **WaterThreeJS** — fully procedural real-time Three.js ocean
  (Gerstner surface, analytic atmosphere, underwater volumetrics, HDR post).
- Author: mohamedachrefelouafi (per the upstream MIT `LICENSE`, © 2026).
- License: MIT (`LICENSE` in this directory — preserved verbatim).
- Acquired: **2026-08-08** from the local checkout
  `/Users/lekan/Dev/WaterThreeJS-main` (a `-main` archive download; **not** a
  git checkout — no upstream commit SHA is available, so provenance is pinned
  by the per-file SHA-256 table below instead).
- Imported as a **read-only porting source and fidelity reference** for
  BodyArcade Checkpoint 05C (see
  `../../decisions/POST_CP05B_OCEAN_REPLACEMENT_AMENDMENTS.md`).
- Do not treat this directory as BodyArcade runtime source and do not edit it.
  The runtime port lives in app-owned code at `apps/shared-world/src/ocean/`
  with the upstream license shipped alongside
  (`WATERTHREEJS_LICENSE.txt`).
- `node_modules` is not imported; `package-lock.json` is retained because it
  pins the dependency versions the reference was authored against
  (three 0.185.1, lil-gui 0.20.x, vite 6.4.3).

## Pinned content (SHA-256)

```text
fa655f413edefb7d5416d743714e4cdd7899134b2fb4003732b2ef9eecac4fd4  LICENSE
d6ea07b693491d7fab068e50d1c9cc628babdcb15a58a566c9cbf65935fe2470  README.md
48bfe467ae6a3972beff942e076741b068636fd9716d21177de1363a98ddd178  index.html
41f5b62d4b8e6ef9fa1b8a7235e726a28ff2b69f83534cebc3d12e6ac2deb0d8  package.json
2548f3a13041d2c5096f9a8771f5b29a61752861e132bf89e982394f9d78c5dc  package-lock.json
90f9f552ec9b09ce78e0bf9c7b4324ad5bd448c85ae48fec14aeacf55564419e  vite.config.js
7bf3886afa81a3f6db727cb4242a8ece495078d7f50cb9a8fd7b35ea2283836f  src/main.js
dcd2928647fe2dbc345d48939daf5cb6ff67258f771ffa2067bc6afd3a01b16c  src/Ocean.js
a172e9aae87ce56a93d9285a7c4f449e62b730a26553af0ab7dee6966b9db78c  src/Sky.js
5bb257902a7e7e2e1ca8fb2faf10c77ca5712a3964dc2f9408df8b70bda9774b  src/Floor.js
c61493eb26840383d29900dbe884d952d366b214c1a7b3e4e4d28f93cf034168  src/Island.js
4d722e571220e89b0f0644eed28abe3fa9ab514aac5a44358d8b880552c4145c  src/FloatingBodies.js
76c2c659b1bd461bfba9fade8ef571aa62d8ffe48cddb9ade50bbfb688c23152  src/Particles.js
d13d759a8bb199a120f594a81e06dca4f9a5faf53d0bac51cd05fe3fa2869a5a  src/Clouds.js
e908b6e2fb8bbb870266e88e3969cb99d931b846ae4aa8226467e77bd7d9f552  src/Post.js
cfd4ec0c6f913f67b1e8c156f40d9a5cab893656aa23473774e0dd7f963d017c  src/shaders/common.js
```
