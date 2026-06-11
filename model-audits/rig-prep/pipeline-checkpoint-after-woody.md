# Pipeline checkpoint after Woody

- Tools created: `tools/rig_prep_model.py`, `tools/rig_prep_all_models.py`, `tools/convert_avatar_to_vrm.py`, `tools/convert_all_avatars_to_vrm.py`, `tools/validate_vrm_candidate.py`, `tools/rig_prep_pipeline.py`, `tools/export_source_to_vrm.py`
- Woody dry-run status: `pass` from prior server checkpoint context
- Woody inspect status: `pass` from prior server checkpoint context
- Woody conversion status: `pass` from prior server checkpoint context
- Woody validation status: `pass` from prior server checkpoint context
- Generated VRM path: `/home/o/posepuppet-working/generated-vrms/woody.vrm`
- Runtime smoke status: `not_attempted`
- Known blockers: Node 22 required explicit `nvm` sourcing in noninteractive shells; runtime browser smoke still not attempted; user-reported `validate_model_audits.py` baseline issue for `amazing-spider-man-2` remains a preexisting server-side blocker if reproduced
- Dirty git status summary: `85` modified entries, `283` untracked entries, `0` staged entries in this local checkout
- Node 22 issue and fix: repo now pins `.nvmrc` to `22`, docs call out explicit `nvm` sourcing, and `scripts/setup-ubuntu-rigging-env.sh` now forces repo Node selection before npm commands
- Large files staged: `no`
- Next recommended model: `darth-vader`

This checkpoint relies on the user-provided Woody server status for the completed Woody pass and on the current local checkout for the Node/documentation stabilization.
