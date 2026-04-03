// Orb rendering — instanced mesh with pulsing glow
import * as THREE from 'three';

export class OrbRenderer {
  constructor(scene) {
    this.scene = scene;
    this.maxOrbs = 1500; // reduced from 2000

    // Lower poly orb geometry
    const geo = new THREE.SphereGeometry(3, 4, 3); // reduced from 6,4

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

    this.specialMesh = new THREE.InstancedMesh(geo, this.specialMaterial, 100); // reduced from 200
    this.specialMesh.count = 0;
    this.specialMesh.frustumCulled = false;
    this.scene.add(this.specialMesh);

    this.dummy = new THREE.Object3D();
    this._pulseFrame = 0;
  }

  updateOrbs(orbData) {
    if (!orbData || !Array.isArray(orbData)) return;

    let normalCount = 0;
    let specialCount = 0;

    for (let i = 0; i < orbData.length; i++) {
      const orb = orbData[i];
      const x = Array.isArray(orb) ? orb[1] : orb.x;
      const y = Array.isArray(orb) ? orb[2] : orb.y;
      const value = Array.isArray(orb) ? orb[3] : (orb.value || 1);
      const isSpecial = Array.isArray(orb) ? orb[4] : (orb.type === 'special');

      if (isSpecial) {
        if (specialCount < 100) {
          const scale = 2.5 + value * 1.5;
          this.dummy.position.set(x, y, 2);
          this.dummy.scale.setScalar(scale);
          this.dummy.updateMatrix();
          this.specialMesh.setMatrixAt(specialCount, this.dummy.matrix);
          specialCount++;
        }
      } else {
        if (normalCount < this.maxOrbs) {
          const scale = 1.5 + value;
          this.dummy.position.set(x, y, 0);
          this.dummy.scale.setScalar(scale);
          this.dummy.updateMatrix();
          this.normalMesh.setMatrixAt(normalCount, this.dummy.matrix);
          normalCount++;
        }
      }
    }

    this.normalMesh.count = normalCount;
    if (normalCount > 0) this.normalMesh.instanceMatrix.needsUpdate = true;

    this.specialMesh.count = specialCount;
    if (specialCount > 0) this.specialMesh.instanceMatrix.needsUpdate = true;
  }

  update(time) {
    // Update pulse every 4th frame
    this._pulseFrame++;
    if (this._pulseFrame % 4 === 0) {
      const pulse = 0.8 + Math.sin(time * 0.003) * 0.2;
      this.normalMaterial.emissiveIntensity = pulse;
      this.specialMaterial.emissiveIntensity = 1.0 + Math.sin(time * 0.005) * 0.5;
    }
  }
}
