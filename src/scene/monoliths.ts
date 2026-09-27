import {
  BoxGeometry,
  Color,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
} from "three";
import type { ScenePalette } from "./palette.ts";

const COUNT = 30;

/**
 * Tall slabs standing far out in the fog, each with a thin lit edge.
 * They exist for scale: without them the floor is a plane, with them
 * it is a place.
 */
export function createMonoliths(palette: ScenePalette) {
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.translate(0, 0.5, 0);
  const slabMaterial = new MeshStandardMaterial({
    roughness: 0.55,
    metalness: 0.4,
  });
  const edgeMaterial = new MeshBasicMaterial({ color: new Color() });
  const slabs = new InstancedMesh(geometry, slabMaterial, COUNT);
  const edges = new InstancedMesh(geometry, edgeMaterial, COUNT);

  const dummy = new Object3D();
  for (let i = 0; i < COUNT; i++) {
    // Evenly around the ring with jitter, kept clear of the sightline
    // straight ahead (north, -z) where the light shaft stands.
    let angle = (i / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.18;
    const ahead = angle - Math.PI * 1.5;
    if (Math.abs(ahead) < 0.22) angle += Math.sign(ahead || 1) * 0.3;
    const radius = 85 + Math.random() * 70;
    const height = 18 + Math.random() * 38;
    const width = 2.5 + Math.random() * 4;
    const depth = 2 + Math.random() * 3;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const turn = -angle + (Math.random() - 0.5) * 0.4;

    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, turn, 0);
    dummy.scale.set(width, height, depth);
    dummy.updateMatrix();
    slabs.setMatrixAt(i, dummy.matrix);

    // The lit edge: a hairline along one vertical corner.
    dummy.scale.set(0.09, height * 0.94, 0.09);
    dummy.position.set(
      x + Math.cos(turn) * (width / 2),
      0,
      z - Math.sin(turn) * (width / 2),
    );
    dummy.updateMatrix();
    edges.setMatrixAt(i, dummy.matrix);
  }

  function setPalette(p: ScenePalette) {
    slabMaterial.color.copy(p.pillar);
    edgeMaterial.color.copy(p.pillarEdge);
  }
  setPalette(palette);

  return {
    meshes: [slabs, edges] as const,
    setPalette,
    dispose() {
      geometry.dispose();
      slabMaterial.dispose();
      edgeMaterial.dispose();
      slabs.dispose();
      edges.dispose();
    },
  };
}
