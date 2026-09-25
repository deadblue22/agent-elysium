// The wooden table under the book: the baked, tileable wood from the legacy board.
// The warm tint keeps the wood brown under the cool window light.
import { Color, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import type { Art } from '../assets';

export function createTable(art: Art) {
  const W = 64, D = 40;
  const tex = art.table.texture;
  tex.repeat.set(W / art.table.world[0], D / art.table.world[1]);
  tex.offset.set(0.13, 0.42);
  const mesh = new Mesh(new PlaneGeometry(W, D), new MeshStandardMaterial({ map: tex, color: new Color(1.3, 0.98, 0.74), roughness: 0.72, metalness: 0 }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0, 3);
  mesh.receiveShadow = true;
  mesh.name = 'table';
  return mesh;
}
