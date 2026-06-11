# Ubuntu Setup Report

- SSH target: `o@192.168.86.152`
- OS/kernel: `Ubuntu 22.04.5 LTS` / `6.8.0-124-generic`
- CPU: `Intel(R) Xeon(R) W-3245 CPU @ 3.20GHz`
- GPU: `NVIDIA GeForce RTX 3090 Ti` (24564 MiB)
- NVIDIA/CUDA: driver `580.159.03`, CUDA shown by nvidia-smi `13.0`
- Blender: `Blender 5.1.2`
- VRM add-on: `available`; export ops `['vrm', 'vrma']`
- Python: `Python 3.10.12`
- Node/npm: `v22.22.3` / `10.9.8`
- Models: `1.1G	/home/o/posepuppet-assets/ModelsForAnimation`
- Woody: `16M	/home/o/posepuppet-assets/woody`

## Checks
- `base_packages`: `pass`
- `npm_install`: `pass`
- `npm_build`: `pass`
- `npm_test`: `fail`
- `audit_self_test`: `pass`
- `generate_model_audit_v2`: `pass`
- `audit_validation`: `pass`
- `audit_staleness`: `pass`
- `blender_headless`: `pass`
- `blender_model_inspection`: `pass`
- `vrm_export_possible`: `pass`
- `rig_prep_dry_run`: `missing`
- `convert_dry_run`: `missing`

## Blockers
- npm test has 6 Playwright timeouts around fake camera/video readiness; 19 unit/browser tests passed.
- tools/rig_prep_all_models.py is missing; rig-prep dry run was not attempted.
- tools/convert_all_avatars_to_vrm.py is missing; conversion dry run was not attempted.
- Node 22 is available through `nvm`, but noninteractive shells must explicitly source `"$HOME/.nvm/nvm.sh"` before `nvm use 22` and `npm` commands.

## Logs
- `environment_initial`: `/home/o/posepuppet-working/logs/environment-initial.txt`
- `apt_base_install`: `/home/o/posepuppet-working/logs/apt-base-install.txt`
- `npm_install`: `/home/o/posepuppet-working/logs/npm-install.txt`
- `npm_build`: `/home/o/posepuppet-working/logs/npm-build.txt`
- `npm_test`: `/home/o/posepuppet-working/logs/npm-test.txt`
- `vrm_addon`: `/home/o/posepuppet-working/logs/blender-vrm-addon-check.txt`
- `pipeline_status`: `/home/o/posepuppet-working/logs/pipeline-status.tsv`

## Next Commands
- `source ~/posepuppet-working/posepuppet-env.sh`
- `python3 tools/audit_model.py --self-test`
- `python3 tools/validate_model_audits.py model-audits`
- `python3 tools/check_audit_staleness.py ModelsForAnimation model-audits --warn-only`
- `python3 tools/audit_models.py ModelsForAnimation model-audits --blender /home/o/.local/bin/blender --woody-dir /home/o/posepuppet-assets/woody --limit 1 --timeout 300`
