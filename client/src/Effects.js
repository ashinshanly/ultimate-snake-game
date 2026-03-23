// Particle effects — death explosions, boost trails, surge zones, power-up collection
import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.explosions = [];
    this.surgeZones = new Map();
    this.maxParticlesPerExplosion = 60;
  }

  createDeathExplosion(x, y, hue = 0) {
    const count = this.maxParticlesPerExplosion;
    const positions = new Float32Array(count * 3);
    const velocities = [];
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = 5;

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 2 + Math.random() * 6;
      velocities.push({
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.008 + Math.random() * 0.015,
      });

      const c = new THREE.Color().setHSL(hue / 360, 1, 0.5 + Math.random() * 0.3);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      sizes[i] = 4 + Math.random() * 8;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 8,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geo, mat);
    this.scene.add(points);

    this.explosions.push({
      points,
      velocities,
      positions: geo.attributes.position.array,
      material: mat,
      age: 0,
    });
  }

  addSurgeZone(zone) {
    // Create visual ring for surge zone
    const geo = new THREE.RingGeometry(zone.radius - 5, zone.radius, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffee00,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(zone.x, zone.y, -1);

    // Fill circle
    const fillGeo = new THREE.CircleGeometry(zone.radius, 64);
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.03,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const fill = new THREE.Mesh(fillGeo, fillMat);
    fill.position.set(zone.x, zone.y, -2);

    this.scene.add(mesh);
    this.scene.add(fill);
    this.surgeZones.set(zone.id, { ring: mesh, fill, material: mat, fillMat: fillMat });
  }

  removeSurgeZone(id) {
    const zone = this.surgeZones.get(id);
    if (zone) {
      this.scene.remove(zone.ring);
      this.scene.remove(zone.fill);
      zone.material.dispose();
      zone.fillMat.dispose();
      zone.ring.geometry.dispose();
      zone.fill.geometry.dispose();
      this.surgeZones.delete(id);
    }
  }

  update(time) {
    // Update explosions
    for (let e = this.explosions.length - 1; e >= 0; e--) {
      const explosion = this.explosions[e];
      explosion.age++;
      let allDead = true;

      for (let i = 0; i < explosion.velocities.length; i++) {
        const v = explosion.velocities[i];
        if (v.life <= 0) continue;
        allDead = false;

        explosion.positions[i * 3] += v.vx;
        explosion.positions[i * 3 + 1] += v.vy;
        v.vx *= 0.97;
        v.vy *= 0.97;
        v.life -= v.decay;
      }

      explosion.points.geometry.attributes.position.needsUpdate = true;
      explosion.material.opacity = Math.max(0, 1 - explosion.age / 80);

      if (allDead || explosion.age > 100) {
        this.scene.remove(explosion.points);
        explosion.points.geometry.dispose();
        explosion.material.dispose();
        this.explosions.splice(e, 1);
      }
    }

    // Pulse surge zones
    for (const [id, zone] of this.surgeZones) {
      const pulse = 0.1 + Math.sin(time * 0.003) * 0.05;
      zone.material.opacity = pulse;
      zone.fillMat.opacity = 0.02 + Math.sin(time * 0.004) * 0.01;
    }
  }
}
