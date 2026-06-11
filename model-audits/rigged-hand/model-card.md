# Avatar audit: Rigged Hand

## Verdict

Label: conversion_ready
Overall score: 32
Recommended runtime profile: hand_only
One-sentence recommendation: Use only for hand/finger experiments; it is not a full avatar.

## What to tell another LLM

Rigged Hand should use profile `hand_only` with action `hand_test_only`. Convert or test `rigged-hand.zip!/source/handRig_02.fbx` to `public/avatars/rigged-hand.vrm`, enable fingers, hands, and disable arms, face_touch, facial_expressions, feet, head, legs, root_motion, toes, torso, upper_body until runtime tests pass.

## Adapter spec

Read `model-audits/rigged-hand/avatar-adapter-spec.json` first.
