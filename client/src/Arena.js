// Arena rendering — neon grid, ambient particles, boundary
import * as THREE from 'three';

export class Arena {
  constructor(scene, arenaSize = 6000) {
    this.scene = scene;
    this.arenaSize = arenaSize;
    this.particles = null;
    this.particlePositions = null;
    this.particleCount = 0;

    this._createGrid();
    this._createBoundary();
    this._createAmbientParticles();
  }

  _createGrid() {
    const half = this.arenaSize / 2;
    // Increase grid spacing to reduce line count (200 instead of 100)
    const gridSpacing = 200;
    const material = new THREE.LineBasicMaterial({
      color: 0x1a2a44,
      transparent: true,
      opacity: 0.5,
    });

    const points = [];
    for (let x = -half; x <= half; x += gridSpacing) {
      points.push(new THREE.Vector3(x, -half, 0));
      points.push(new THREE.Vector3(x, half, 0));
    }
    for (let y = -half; y <= half; y += gridSpacing) {
      points.push(new THREE.Vector3(-half, y, 0));
      points.push(new THREE.Vector3(half, y, 0));
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const lines = new THREE.LineSegments(geo, material);
    lines.position.z = -5;
    lines.frustumCulled = false;
    this.scene.add(lines);

    // Major grid lines (brighter) — increased spacing from 500 to 1000
    const majorMat = new THREE.LineBasicMaterial({
      color: 0x1a3860,
      transparent: true,
      opacity: 0.7,
    });
    const majorPoints = [];
    const majorSpacing = 1000;
    for (let x = -half; x <= half; x += majorSpacing) {
      majorPoints.push(new THREE.Vector3(x, -half, 0));
      majorPoints.push(new THREE.Vector3(x, half, 0));
    }
    for (let y = -half; y <= half; y += majorSpacing) {
      majorPoints.push(new THREE.Vector3(-half, y, 0));
      majorPoints.push(new THREE.Vector3(half, y, 0));
    }
    const majorGeo = new THREE.BufferGeometry().setFromPoints(majorPoints);
    const majorLines = new THREE.LineSegments(majorGeo, majorMat);
    majorLines.position.z = -4;
    majorLines.frustumCulled = false;
    this.scene.add(majorLines);
  }

  _createBoundary() {
    const half = this.arenaSize / 2;
    const mat = new THREE.LineBasicMaterial({
      color: 0xff0066,
      transparent: true,
      opacity: 0.5,
    });

    const points = [
      new THREE.Vector3(-half, -half, 0),
      new THREE.Vector3(half, -half, 0),
      new THREE.Vector3(half, half, 0),
      new THREE.Vector3(-half, half, 0),
      new THREE.Vector3(-half, -half, 0),
    ];

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const boundary = new THREE.Line(geo, mat);
    boundary.position.z = -3;
    this.scene.add(boundary);

    // Glow boundary
    const glowMat = new THREE.LineBasicMaterial({
      color: 0xff0066,
      transparent: true,
      opacity: 0.15,
      linewidth: 2,
    });
    const glowBoundary = new THREE.Line(geo.clone(), glowMat);
    glowBoundary.position.z = -2;
    glowBoundary.scale.setScalar(1.002);
    this.scene.add(glowBoundary);
  }

  _createAmbientParticles() {
    // Reduced from 500 to 200 particles
    const count = 200;
    this.particleCount = count;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * this.arenaSize;
      positions[i * 3 + 1] = (Math.random() - 0.5) * this.arenaSize;
      positions[i * 3 + 2] = -10 + Math.random() * 20;

      const r = Math.random();
      if (r < 0.33) {
        colors[i * 3] = 0; colors[i * 3 + 1] = 0.94; colors[i * 3 + 2] = 1;
      } else if (r < 0.66) {
        colors[i * 3] = 1; colors[i * 3 + 1] = 0; colors[i * 3 + 2] = 0.67;
      } else {
        colors[i * 3] = 0.67; colors[i * 3 + 1] = 0; colors[i * 3 + 2] = 1;
      }
    }

    this.particlePositions = positions;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 3,
      vertexColors: true,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  update(time) {
    // Update particles every 3rd frame to reduce CPU load
    if (this.particlePositions && (time | 0) % 3 === 0) {
      const positions = this.particlePositions;
      const t1 = time * 0.0005;
      const t2 = time * 0.0003;
      for (let i = 0; i < this.particleCount; i++) {
        positions[i * 3 + 1] += Math.sin(t1 + i) * 0.1;
        positions[i * 3] += Math.cos(t2 + i * 0.7) * 0.05;
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }
  }
}
