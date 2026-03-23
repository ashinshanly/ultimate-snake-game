// Three.js scene, camera, renderer, and post-processing
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060610);
    this.scene.fog = new THREE.FogExp2(0x060610, 0.00015);

    // Camera - orthographic-ish perspective for 2D feel with depth
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
    this.camera.position.set(0, 0, 800);
    this.camera.lookAt(0, 0, 0);

    // Target camera values for smooth transitions
    this.cameraTarget = { x: 0, y: 0, z: 800 };
    // Increased smoothing down to essentially instantly follow, making mouse 
    // steering perfectly 1:1 since player remains precisely at screen center.
    this.cameraSmoothing = 0.5;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // Post-processing — bloom for neon glow
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5,  // strength
      0.4,  // radius
      0.85  // threshold
    );
    this.composer.addPass(this.bloomPass);

    // Ambient light
    this.scene.add(new THREE.AmbientLight(0x222244, 0.5));

    // Handle resize
    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloomPass.resolution.set(w, h);
  }

  setCameraTarget(x, y, snakeLength) {
    this.cameraTarget.x = x;
    this.cameraTarget.y = y;
    // Zoom out as snake grows
    this.cameraTarget.z = 800 + Math.min(snakeLength * 2, 600);
  }

  updateCamera() {
    const s = this.cameraSmoothing;
    this.camera.position.x += (this.cameraTarget.x - this.camera.position.x) * s;
    this.camera.position.y += (this.cameraTarget.y - this.camera.position.y) * s;
    this.camera.position.z += (this.cameraTarget.z - this.camera.position.z) * s * 0.5;
    this.camera.lookAt(
      this.camera.position.x,
      this.camera.position.y,
      0
    );
  }

  render() {
    this.updateCamera();
    this.composer.render();
  }

  getScene() {
    return this.scene;
  }
}
