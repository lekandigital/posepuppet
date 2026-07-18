// Legacy water renderer — wraps the original WaterMaterial pipeline.
// Kept as a thin module so WaterSystem can reference the legacy path explicitly.

export { createWaterMaterial, createInfiniteWaterMaterial, rebuildWaterShaderSource } from '../terrain/WaterMaterial.js';
