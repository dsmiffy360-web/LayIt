// Ceiling tiles and floor tiles are different products with different
// typical sizes — sharing one pair of fields between them meant switching
// project type left the previous type's dimensions showing under the new
// one. Ceiling is always materialType "tile" (see SetupStep's
// handleProjectTypeChange), so projectType alone is enough to pick the
// right pair; plank has no ceiling equivalent.
export function getActiveDimensions(job) {
  if (job.projectType === "ceiling") return { length: job.ceilingTileLength, width: job.ceilingTileWidth };
  if (job.materialType === "tile") return { length: job.tileLength, width: job.tileWidth };
  return { length: job.plankLength, width: job.plankWidth };
}
