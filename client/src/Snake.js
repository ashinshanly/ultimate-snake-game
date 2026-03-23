// Snake rendering — spline body with glow, gradient, and evolution visuals
import * as THREE from 'three';

export class SnakeRenderer {
  constructor(scene) {
    this.scene = scene;
    this.snakes = new Map(); // id -> mesh group
    this.bodyMaterial = null;
    this._initMaterials();
  }

  _initMaterials() {
    // Reusable segment geometry
    this.segmentGeo = new THREE.SphereGeometry(1, 8, 6);
    this.headGeo = new THREE.SphereGeometry(1, 12, 8);
    this.eyeGeo = new THREE.SphereGeometry(1, 6, 4);
  }

  _createSnakeMaterial(hue) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(hue / 360, 1, 0.5),
      emissive: new THREE.Color().setHSL(hue / 360, 1, 0.3),
      emissiveIntensity: 0.8,
      roughness: 0.3,
      metalness: 0.7,
    });
  }

  _createHeadMaterial(hue) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(hue / 360, 1, 0.6),
      emissive: new THREE.Color().setHSL(hue / 360, 1, 0.4),
      emissiveIntensity: 1.2,
      roughness: 0.2,
      metalness: 0.8,
    });
  }

  updateSnake(data, isSelf = false) {
    const id = data.id;
    const segments = data.segs || data.segments || [];
    if (segments.length === 0) return;

    const hue = data.hue || 0;
    const headRadius = data.hr || data.headRadius || 12;
    const boosting = data.bst || data.boosting || false;
    const score = data.sc || data.score || 0;

    let group = this.snakes.get(id);

    if (!group) {
      group = {
        container: new THREE.Group(),
        bodyMeshes: [],
        headMesh: null,
        eyes: [],
        nameMesh: null,
        hue,
        material: this._createSnakeMaterial(hue),
        headMaterial: this._createHeadMaterial(hue),
      };

      // Create head
      group.headMesh = new THREE.Mesh(this.headGeo, group.headMaterial);
      group.container.add(group.headMesh);

      // Create eyes
      const eyeMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 2,
      });
      for (let i = 0; i < 2; i++) {
        const eye = new THREE.Mesh(this.eyeGeo, eyeMat);
        group.eyes.push(eye);
        group.container.add(eye);
      }

      // Name label (using sprite)
      if (data.name) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'transparent';
        ctx.fillRect(0, 0, 512, 128);
        
        ctx.font = 'bold 50px "Rajdhani", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const nameStr = data.name.substring(0, 16);
        
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(nameStr, 256, 64);
        
        ctx.fillStyle = isSelf ? '#00f0ff' : '#ffffff';
        ctx.fillText(nameStr, 256, 64);

        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 1.0 });
        group.nameMesh = new THREE.Sprite(spriteMat);
        group.nameMesh.scale.set(120, 30, 1);
        group.container.add(group.nameMesh);
      }

      this.scene.add(group.container);
      this.snakes.set(id, group);
    }

    // --- Update positions ---
    const segCount = segments.length;

    // Ensure enough body meshes
    while (group.bodyMeshes.length < segCount) {
      const mesh = new THREE.Mesh(this.segmentGeo, group.material);
      group.bodyMeshes.push(mesh);
      group.container.add(mesh);
    }
    // Hide excess
    for (let i = segCount; i < group.bodyMeshes.length; i++) {
      group.bodyMeshes[i].visible = false;
    }

    // Evolution: size scaling based on score
    const evolution = Math.min(score / 100, 1); // 0-1
    const baseSize = headRadius * (0.8 + evolution * 0.4);

    // Update head position
    const hx = Array.isArray(segments[0]) ? segments[0][0] : segments[0].x;
    const hy = Array.isArray(segments[0]) ? segments[0][1] : segments[0].y;

    group.headMesh.position.set(hx, hy, 5);
    group.headMesh.scale.setScalar(baseSize);

    // Eyes
    const dir = data.dir || data.direction || 0;
    const eyeOffsetX = Math.cos(dir) * baseSize * 0.5;
    const eyeOffsetY = Math.sin(dir) * baseSize * 0.5;
    const eyeSide = baseSize * 0.35;

    group.eyes[0].position.set(
      hx + eyeOffsetX - Math.sin(dir) * eyeSide,
      hy + eyeOffsetY + Math.cos(dir) * eyeSide,
      8
    );
    group.eyes[1].position.set(
      hx + eyeOffsetX + Math.sin(dir) * eyeSide,
      hy + eyeOffsetY - Math.cos(dir) * eyeSide,
      8
    );
    group.eyes[0].scale.setScalar(baseSize * 0.25);
    group.eyes[1].scale.setScalar(baseSize * 0.25);

    // Name position
    if (group.nameMesh) {
      group.nameMesh.position.set(hx, hy + baseSize + 25, 10);
    }

    // Update body segments with gradient
    for (let i = 0; i < segCount; i++) {
      const mesh = group.bodyMeshes[i];
      mesh.visible = true;

      const sx = Array.isArray(segments[i]) ? segments[i][0] : segments[i].x;
      const sy = Array.isArray(segments[i]) ? segments[i][1] : segments[i].y;

      mesh.position.set(sx, sy, 2);

      // Taper toward tail
      const t = i / Math.max(1, segCount - 1);
      const segSize = baseSize * (1 - t * 0.5);
      mesh.scale.setScalar(segSize * 0.85);

      // Gradient effect via material color shift
      if (i % 3 === 0) {
        const gradientHue = ((hue + t * 60) % 360) / 360;
        mesh.material = group.material;
      }
    }

    // Boost visual — increase emissive intensity
    const intensity = boosting ? 1.6 : 0.8;
    group.material.emissiveIntensity = intensity;
    group.headMaterial.emissiveIntensity = boosting ? 2.0 : 1.2;

    // Power-up visual (phase = transparent)
    const puState = data.pu || 0;
    if (puState === 2) {
      // Phase
      group.material.opacity = 0.4;
      group.material.transparent = true;
    } else {
      group.material.opacity = 1;
      group.material.transparent = false;
      group.headMaterial.emissive.setHSL(hue / 360, 1, 0.4);
    }
  }

  removeSnake(id) {
    const group = this.snakes.get(id);
    if (group) {
      this.scene.remove(group.container);
      // Dispose geometries from this group
      group.bodyMeshes.forEach(m => {
        if (m.geometry !== this.segmentGeo) m.geometry.dispose();
      });
      if (group.material) group.material.dispose();
      if (group.headMaterial) group.headMaterial.dispose();
      this.snakes.delete(id);
    }
  }

  getActiveIds() {
    return new Set(this.snakes.keys());
  }

  clear() {
    for (const [id] of this.snakes) {
      this.removeSnake(id);
    }
  }
}
