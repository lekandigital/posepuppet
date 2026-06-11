# Spider-Man No Way Home VRM conversion run

- Status: `pass`
- Selected source path: `OtherSpiderman/spider-man_no_way_home_rigged.glb`
- Materialized source path: `/home/o/posepuppet-assets/ModelsForAnimation/OtherSpiderman/spider-man_no_way_home_rigged.glb`
- Candidate VRM path: `/home/o/posepuppet-working/generated-vrms/spider-man-no-way-home.vrm`
- Candidate VRM exists: `true`
- Candidate VRM size bytes: `15974984`
- Manual bone map path: `/home/o/Dev/posepuppet/model-audits/spider-man-no-way-home/suggested-bone-map.json`
- Runtime browser smoke: `not_attempted`
- Public avatar written: `false`

## Command

```sh
/home/o/posepuppet-tools/blender-versions/blender-5.1.2-linux-x64/blender -b --python /home/o/Dev/posepuppet/tools/export_source_to_vrm.py -- /home/o/posepuppet-assets/ModelsForAnimation/OtherSpiderman/spider-man_no_way_home_rigged.glb /home/o/posepuppet-working/generated-vrms/spider-man-no-way-home.vrm --mapping /home/o/Dev/posepuppet/model-audits/spider-man-no-way-home/suggested-bone-map.json
```
