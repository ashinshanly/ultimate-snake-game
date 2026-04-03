// Snake rendering — optimized with instanced meshes and aggressive LOD
import * as THREE from 'three';

export class SnakeRenderer {
  constructor(scene) {
    this.scene = scene;
    this.snakes = new Map(); // id -> snake data
    this.lastUpdateTime = performance.now();
    this.arenaSize = 6000;

    // Shared geometries — lower poly counts
    this.segmentGeo = new THREE.SphereGeometry(1, 6, 4); // reduced from 8,6
    this.headGeo = new THREE.SphereGeometry(1, 8, 6);     // reduced from 12,8
    this.eyeGeo = new THREE.SphereGeometry(1, 4, 3);      // reduced from 6,4

    // Shared eye material (one for all snakes)
    this.sharedEyeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2,
    });
  }

  setArenaSize(arenaSize) {
    this.arenaSize = arenaSize || this.arenaSize;
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
        targetSegments: [],
        renderSegments: [],
        headRadius: 12,
        dir: null,
        targetDir: 0,
        boosting: 0,
        targetBoosting: false,
        phaseActive: false,
        score: 0,
        isSelf,
      };

      // Create head
      group.headMesh = new THREE.Mesh(this.headGeo, group.headMaterial);
      group.container.add(group.headMesh);

      // Create eyes — use shared material
      for (let i = 0; i < 2; i++) {
        const eye = new THREE.Mesh(this.eyeGeo, this.sharedEyeMat);
        group.eyes.push(eye);
        group.container.add(eye);
      }

      // Name label
      if (data.name) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;  // Reduced from 512
        canvas.height = 64;  // Reduced from 128
        const ctx = canvas.getContext('2d');

        ctx.font = 'bold 28px "Rajdhani", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const nameStr = data.name.substring(0, 16);

        ctx.lineWidth = 4;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(nameStr, 128, 32);

        ctx.fillStyle = isSelf ? '#00f0ff' : '#ffffff';
        ctx.fillText(nameStr, 128, 32);

        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false; // Avoid mipmap generation
        const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 1.0 });
        group.nameMesh = new THREE.Sprite(spriteMat);
        group.nameMesh.scale.set(120, 30, 1);
        group.container.add(group.nameMesh);
      }

      this.scene.add(group.container);
      this.snakes.set(id, group);
    }

    const segCount = segments.length;

    // Only create meshes up to a max visible count (LOD)
    const maxVisible = isSelf ? 200 : 100;
    const displayCount = Math.min(segCount, maxVisible);
    const segStep = segCount > maxVisible ? segCount / maxVisible : 1;

    // Ensure enough body meshes
    while (group.bodyMeshes.length < displayCount) {
      const mesh = new THREE.Mesh(this.segmentGeo, group.material);
      group.bodyMeshes.push(mesh);
      group.container.add(mesh);
    }

    // Build target segments with LOD
    group.targetSegments.length = displayCount;
    group.renderSegments.length = displayCount;

    for (let i = 0; i < displayCount; i++) {
      const srcIdx = segStep === 1 ? i : Math.min(Math.round(i * segStep), segCount - 1);
      const seg = segments[srcIdx];
      const sx = Array.isArray(seg) ? seg[0] : seg.x;
      const sy = Array.isArray(seg) ? seg[1] : seg.y;

      if (!group.targetSegments[i]) {
        group.targetSegments[i] = { x: sx, y: sy };
      } else {
        group.targetSegments[i].x = sx;
        group.targetSegments[i].y = sy;
      }

      if (!group.renderSegments[i]) {
        group.renderSegments[i] = { x: sx, y: sy };
      }
    }

    // Hide excess meshes
    for (let i = displayCount; i < group.bodyMeshes.length; i++) {
      group.bodyMeshes[i].visible = false;
    }

    group.headRadius = headRadius;
    group.score = score;
    group.targetDir = data.dir || data.direction || 0;
    if (group.dir === null) {
      group.dir = group.targetDir;
    }
    group.targetBoosting = boosting;
    group.phaseActive = (data.pu || 0) === 2;

    this._applySnakeVisuals(group);
  }

  update(time = performance.now()) {
    const dt = Math.min(0.05, (time - this.lastUpdateTime) / 1000 || 0.016);
    this.lastUpdateTime = time;
    const blend = 1 - Math.exp(-dt * 14);
    const boostBlend = 1 - Math.exp(-dt * 10);

    for (const group of this.snakes.values()) {
      const segLen = group.targetSegments.length;
      if (!segLen) continue;

      for (let i = 0; i < segLen; i++) {
        const render = group.renderSegments[i];
        const target = group.targetSegments[i];
        render.x = this._interpolateWrapped(render.x, target.x, blend);
        render.y = this._interpolateWrapped(render.y, target.y, blend);
      }

      group.dir = this._lerpAngle(group.dir, group.targetDir, blend);
      const boostValue = group.targetBoosting ? 1 : 0;
      group.boosting += (boostValue - group.boosting) * boostBlend;

      this._applySnakeVisuals(group);
    }
  }

  _applySnakeVisuals(group) {
    const segCount = group.targetSegments.length;
    if (segCount === 0) return;

    const evolution = Math.min(group.score * 0.01, 1);
    const baseSize = group.headRadius * (0.8 + evolution * 0.4);
    const head = group.renderSegments[0];

    group.headMesh.position.set(head.x, head.y, 5);
    group.headMesh.scale.setScalar(baseSize);

    const cosDir = Math.cos(group.dir);
    const sinDir = Math.sin(group.dir);
    const eyeOffsetX = cosDir * baseSize * 0.5;
    const eyeOffsetY = sinDir * baseSize * 0.5;
    const eyeSide = baseSize * 0.35;

    group.eyes[0].position.set(
      head.x + eyeOffsetX - sinDir * eyeSide,
      head.y + eyeOffsetY + cosDir * eyeSide,
      8
    );
    group.eyes[1].position.set(
      head.x + eyeOffsetX + sinDir * eyeSide,
      head.y + eyeOffsetY - cosDir * eyeSide,
      8
    );
    group.eyes[0].scale.setScalar(baseSize * 0.25);
    group.eyes[1].scale.setScalar(baseSize * 0.25);

    if (group.nameMesh) {
      group.nameMesh.position.set(head.x, head.y + baseSize + 25, 10);
    }

    const invSegCount = 1 / Math.max(1, segCount - 1);
    for (let i = 0; i < segCount; i++) {
      const mesh = group.bodyMeshes[i];
      const render = group.renderSegments[i];
      mesh.visible = true;
      mesh.position.set(render.x, render.y, 2);

      const t = i * invSegCount;
      const segSize = baseSize * (1 - t * 0.5);
      mesh.scale.setScalar(segSize * 0.85);
    }

    // Only update material properties occasionally or on change
    group.material.emissiveIntensity = 0.8 + group.boosting * 0.8;
    group.headMaterial.emissiveIntensity = 1.2 + group.boosting * 0.8;

    if (group.phaseActive) {
      if (!group.material.transparent) {
        group.material.opacity = 0.4;
        group.material.transparent = true;
      }
    } else if (group.material.transparent) {
      group.material.opacity = 1;
      group.material.transparent = false;
      group.headMaterial.emissive.setHSL(group.hue / 360, 1, 0.4);
    }
  }

  _lerpAngle(from, to, alpha) {
    let diff = to - from;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return from + diff * alpha;
  }

  _interpolateWrapped(from, to, alpha) {
    const delta = this._getWrappedDelta(from, to);
    return this._normalizeWrappedCoord(from + delta * alpha);
  }

  _getWrappedDelta(from, to) {
    const size = this.arenaSize;
    if (!size) return to - from;
    let delta = to - from;
    const half = size / 2;
    if (delta > half) delta -= size;
    if (delta < -half) delta += size;
    return delta;
  }

  _normalizeWrappedCoord(value) {
    const size = this.arenaSize;
    if (!size) return value;
    const half = size / 2;
    if (value > half) return value - size;
    if (value < -half) return value + size;
    return value;
  }

  removeSnake(id) {
    const group = this.snakes.get(id);
    if (group) {
      this.scene.remove(group.container);

      if (group.material) group.material.dispose();
      if (group.headMaterial) group.headMaterial.dispose();
      if (group.nameMesh) {
        if (group.nameMesh.material?.map) group.nameMesh.material.map.dispose();
        if (group.nameMesh.material) group.nameMesh.material.dispose();
      }
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
