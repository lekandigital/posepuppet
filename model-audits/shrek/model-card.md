# Avatar audit: Shrek

## Verdict

Label: conversion_ready
Overall score: 86
Recommended runtime profile: humanoid
One-sentence recommendation: Convert to VRM and run load/orientation tests.

## What to tell another LLM

Shrek should use profile `humanoid` with action `convert_then_test`. Convert or test `shrek-rig.zip!/source/shrek 4.zip!/source/Dying.fbx` to `public/avatars/shrek.vrm`, enable arms, feet, hands, head, legs, root_motion, upper_body, and disable face_touch, facial_expressions, fingers, toes until runtime tests pass.

## Adapter spec

Read `model-audits/shrek/avatar-adapter-spec.json` first.
