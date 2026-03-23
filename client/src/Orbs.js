// Orb rendering — instanced mesh with pulsing glow
import * as THREE from 'three';

export class OrbRenderer {
  constructor(scene) {
    this.scene = scene;
    this.orbs = new Map(); // id -> position index
    this.maxOrbs = 2000;
    this.orbCount = 0;

    // Instanced mesh for performance
    const geo = new THREE.SphereGeometry(3, 6, 4);
    this.normalMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00ff44,
      emissiveIntensity: 1.0,
      roughness: 0.3,
      metalness: 0.5,
      transparent: true,
      opacity: 0.9,
    });

    this.specialMaterial = new THREE.MeshStandardMaterial({
      color: 0xffee00,
      emissive: 0xffaa00,
      emissiveIntensity: 1.5,
      roughness: 0.2,
      metalness: 0.6,
      transparent: true,
      opacity: 0.9,
    });

    this.normalMesh = new THREE.InstancedMesh(geo, this.normalMaterial, this.maxOrbs);
    this.normalMesh.count = 0;
    this.normalMesh.frustumCulled = false;
    this.scene.add(this.normalMesh);

    this.specialMesh = new THREE.InstancedMesh(geo, this.specialMaterial, 200);
    this.specialMesh.count = 0;
    this.specialMesh.frustumCulled = false;
    this.scene.add(this.specialMesh);

    this.dummy = new THREE.Object3D();
    this.normalPositions = [];
    this.specialPositions = [];
  }

  updateOrbs(orbData) {
    if (!orbData || !Array.isArray(orbData)) return;

    this.normalPositions = [];
    this.specialPositions = [];

    for (const orb of orbData) {
      // orb format: [id, x, y, value, isSpecial]
      const x = Array.isArray(orb) ? orb[1] : orb.x;
      const y = Array.isArray(orb) ? orb[2] : orb.y;
      const value = Array.isArray(orb) ? orb[3] : (orb.value || 1);
      const isSpecial = Array.isArray(orb) ? orb[4] : (orb.type === 'special');

      if (isSpecial) {
        this.specialPositions.push({ x, y, value });
      } else {
        this.normalPositions.push({ x, y, value });
      }
    }

    // Update normal orbs
    this.normalMesh.count = Math.min(this.normalPositions.length, this.maxOrbs);
    for (let i = 0; i < this.normalMesh.count; i++) {
      const p = this.normalPositions[i];
      const scale = 1.5 + p.value * 1;
      this.dummy.position.set(p.x, p.y, 0);
      this.dummy.scale.setScalar(scale);
      this.dummy.updateMatrix();
      this.normalMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.normalMesh.instanceMatrix.needsUpdate = true;

    // Update special orbs
    this.specialMesh.count = Math.min(this.specialPositions.length, 200);
    for (let i = 0; i < this.specialMesh.count; i++) {
      const p = this.specialPositions[i];
      const scale = 2.5 + p.value * 1.5;
      this.dummy.position.set(p.x, p.y, 2);
      this.dummy.scale.setScalar(scale);
      this.dummy.updateMatrix();
      this.specialMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.specialMesh.instanceMatrix.needsUpdate = true;
  }

  update(time) {
    // Pulsing animation
    const pulse = 0.8 + Math.sin(time * 0.003) * 0.2;
    this.normalMaterial.emissiveIntensity = pulse;
    this.specialMaterial.emissiveIntensity = 1.0 + Math.sin(time * 0.005) * 0.5;
  }
}
