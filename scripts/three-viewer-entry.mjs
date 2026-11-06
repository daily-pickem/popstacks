import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

class PopStacksGLBViewer {
  constructor() {
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.envMap = null;
    this.loader = new GLTFLoader();
    this.modelCache = new Map();
    this.currentRoot = null;
    this.currentContainer = null;
    this.currentFig = null;
    this.currentVesselSeriesIdx = null;
    this.isLocked = false;
    this.rafId = null;
    this.resumeRotateTimer = null;
    this.isUserInteracting = false;
    this.lastLoadStatus = 'idle';
    this.resizeObserver = null;
    this.tapImpulse = null;
  }

  initRenderer() {
    if (this.renderer) return;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping || THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    this.renderer.domElement.className = 'glb-viewer-canvas';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.cursor = 'grab';

    this.scene = new THREE.Scene();

    // Studio environment map for crisp specular clearcoat/metallic reflections without washing out base albedo
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    this.envMap = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    this.scene.environment = this.envMap;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Balanced lighting: preserves rich baked colors while providing 3D specular & rim highlights
    const hemi = new THREE.HemisphereLight(0xffffff, 0xe8dfd1, 1.55);
    this.scene.add(hemi);

    this.keyLight = new THREE.DirectionalLight(0xfffdf8, 0.95);
    this.keyLight.position.set(2.0, 2.8, 3.2);
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0xffe8c2, 0.75);
    this.rimLight.position.set(-2.2, 1.8, -2.6);
    this.scene.add(this.rimLight);

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 25);
    this.camera.position.set(0, 0.12, 2.75);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.enableZoom = true;
    this.controls.minDistance = 1.65;
    this.controls.maxDistance = 3.6;
    this.controls.minPolarAngle = Math.PI * 0.24;
    this.controls.maxPolarAngle = Math.PI * 0.65;
    this.controls.target.set(0, 0.0, 0);
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 2.2;

    this.controls.addEventListener('start', () => {
      this.isUserInteracting = true;
      this.controls.autoRotate = false;
      this.renderer.domElement.style.cursor = 'grabbing';
      if (this.resumeRotateTimer) clearTimeout(this.resumeRotateTimer);
    });

    this.controls.addEventListener('end', () => {
      this.isUserInteracting = false;
      this.renderer.domElement.style.cursor = 'grab';
      if (this.resumeRotateTimer) clearTimeout(this.resumeRotateTimer);
      this.resumeRotateTimer = setTimeout(() => {
        if (!this.isUserInteracting && this.controls) {
          this.controls.autoRotate = true;
        }
      }, 1400);
    });

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.syncSize());
    }
  }

  syncSize() {
    if (!this.renderer || !this.currentContainer || !this.camera) return;
    const rect = this.currentContainer.getBoundingClientRect();
    const w = Math.max(180, Math.round(rect.width) || 240);
    const h = Math.max(180, Math.round(rect.height) || 250);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  computeSmoothPositionNormals(geometry) {
    if (!geometry || !geometry.attributes || !geometry.attributes.position) return;
    geometry.computeVertexNormals();
    const posAttr = geometry.attributes.position;
    const normAttr = geometry.attributes.normal;
    if (!normAttr) return;
    const count = posAttr.count;
    const accum = new Map();

    for (let i = 0; i < count; i++) {
      const kx = Math.round(posAttr.getX(i) * 10000);
      const ky = Math.round(posAttr.getY(i) * 10000);
      const kz = Math.round(posAttr.getZ(i) * 10000);
      const key = `${kx},${ky},${kz}`;
      let entry = accum.get(key);
      if (!entry) {
        entry = [0, 0, 0];
        accum.set(key, entry);
      }
      entry[0] += normAttr.getX(i);
      entry[1] += normAttr.getY(i);
      entry[2] += normAttr.getZ(i);
    }

    for (let i = 0; i < count; i++) {
      const kx = Math.round(posAttr.getX(i) * 10000);
      const ky = Math.round(posAttr.getY(i) * 10000);
      const kz = Math.round(posAttr.getZ(i) * 10000);
      const entry = accum.get(`${kx},${ky},${kz}`);
      const len = Math.hypot(entry[0], entry[1], entry[2]) || 1;
      normAttr.setXYZ(i, entry[0] / len, entry[1] / len, entry[2] / len);
    }
    normAttr.needsUpdate = true;
  }

  applyRarityMaterials(root, fig, locked = false) {
    const rarity = String((fig && fig.rarity) || 'Common').toLowerCase();

    root.traverse((child) => {
      if (!child.isMesh) return;
      if (child.geometry && !child.geometry.userData?.normalsSmoothed) {
        this.computeSmoothPositionNormals(child.geometry);
        child.geometry.userData = { ...(child.geometry.userData || {}), normalsSmoothed: true };
      }
      const oldMat = child.material;

      if (locked) {
        child.material = new THREE.MeshPhysicalMaterial({
          color: 0x181326,
          roughness: 0.26,
          metalness: 0.22,
          clearcoat: 0.85,
          clearcoatRoughness: 0.12,
          envMapIntensity: 0.9,
          side: THREE.DoubleSide
        });
        return;
      }

      const map = oldMat && oldMat.map ? oldMat.map : null;
      const normalMap = oldMat && oldMat.normalMap ? oldMat.normalMap : null;
      const roughnessMap = oldMat && oldMat.roughnessMap ? oldMat.roughnessMap : null;
      const metalnessMap = oldMat && oldMat.metalnessMap ? oldMat.metalnessMap : null;
      const hasVertexColors = Boolean(
        child.geometry && child.geometry.attributes && child.geometry.attributes.color
      );

      if (map) {
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = 4;
      }

      const sharedMaps = {
        map,
        normalMap,
        roughnessMap,
        metalnessMap,
        vertexColors: hasVertexColors && !map,
        color: 0xffffff,
        side: THREE.DoubleSide
      };

      // Figurine PBR Material by Rarity Tier (keeps rich baseColor saturation while adding physical surface response)
      if (rarity === 'mythic') {
        child.material = new THREE.MeshPhysicalMaterial({
          ...sharedMaps,
          roughness: 0.14,
          metalness: 0.08,
          clearcoat: 1.0,
          clearcoatRoughness: 0.05,
          iridescence: 0.85,
          iridescenceIOR: 1.45,
          envMapIntensity: 0.55
        });
      } else if (rarity === 'legendary') {
        child.material = new THREE.MeshPhysicalMaterial({
          ...sharedMaps,
          roughness: 0.18,
          metalness: 0.16,
          clearcoat: 0.95,
          clearcoatRoughness: 0.06,
          envMapIntensity: 0.5
        });
      } else if (rarity === 'epic') {
        child.material = new THREE.MeshPhysicalMaterial({
          ...sharedMaps,
          roughness: 0.24,
          metalness: 0.08,
          clearcoat: 0.78,
          clearcoatRoughness: 0.08,
          iridescence: 0.55,
          iridescenceIOR: 1.35,
          envMapIntensity: 0.42
        });
      } else if (rarity === 'rare') {
        child.material = new THREE.MeshPhysicalMaterial({
          ...sharedMaps,
          roughness: 0.16,
          metalness: 0.03,
          clearcoat: 0.95,
          clearcoatRoughness: 0.05,
          envMapIntensity: 0.4
        });
      } else {
        // Common = soft-touch matte vinyl
        child.material = new THREE.MeshPhysicalMaterial({
          ...sharedMaps,
          roughness: 0.76,
          metalness: 0.01,
          clearcoat: 0.06,
          envMapIntensity: 0.22
        });
      }
    });
  }

  getVesselMaterialProfile(fig) {
    const seriesIdx = Number(fig?.seriesIndex) || Number(String(fig?.seriesId || 'series-1').replace(/\D+/g, '')) || 1;
    const rarity = String(fig?.rarity || 'Common').toLowerCase();
    const sil = String(fig?.silhouetteType || '').toLowerCase();
    const primaryHex = fig?.primaryColor || '#E06D53';
    const accentHex = fig?.accentColor || '#F4B942';

    // Blend white with the figurine's primary shade so the 3D vessel takes on the item's hue/shade
    // while keeping its baked Hunyuan3D surface detail crisp
    const tint = new THREE.Color(0xffffff).lerp(new THREE.Color(primaryHex), 0.10);
    const emissive = new THREE.Color(0xF4B942).lerp(new THREE.Color(accentHex), 0.35);

    // Metal / Clockwork Brass / Forged Gold / Automaton items
    if (seriesIdx === 7 || sil === 'robo' || rarity === 'legendary') {
      return {
        family: 'forged-metal',
        roughness: 0.2,
        metalness: 0.78,
        clearcoat: 0.85,
        clearcoatRoughness: 0.08,
        iridescence: 0.15,
        envMapIntensity: 1.05,
        tintColor: tint,
        emissiveColor: emissive
      };
    }
    // 24K Gold & Translucent Crystal Vault (Series 10 / Mythic)
    if (seriesIdx === 10 || rarity === 'mythic') {
      return {
        family: 'gold-crystal',
        roughness: 0.14,
        metalness: 0.64,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        iridescence: 0.9,
        iridescenceIOR: 1.48,
        envMapIntensity: 1.1,
        tintColor: tint,
        emissiveColor: emissive
      };
    }
    // Anodized Titanium & Nebula Geode (Series 3)
    if (seriesIdx === 3) {
      return {
        family: 'anodized-geode',
        roughness: 0.24,
        metalness: 0.56,
        clearcoat: 0.9,
        clearcoatRoughness: 0.06,
        iridescence: 0.75,
        iridescenceIOR: 1.42,
        envMapIntensity: 0.92,
        tintColor: tint,
        emissiveColor: emissive
      };
    }
    // Iridescent Mother-of-Pearl Shell (Series 8)
    if (seriesIdx === 8) {
      return {
        family: 'mother-of-pearl',
        roughness: 0.16,
        metalness: 0.14,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        iridescence: 0.95,
        iridescenceIOR: 1.5,
        envMapIntensity: 0.82,
        tintColor: tint,
        emissiveColor: emissive
      };
    }
    // High-Gloss Kiln Lacquer & Raku Crackle Glaze (Series 2, Series 4, or Rare)
    if (seriesIdx === 2 || seriesIdx === 4 || rarity === 'rare') {
      return {
        family: 'kiln-glaze',
        roughness: 0.15,
        metalness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        iridescence: 0.2,
        envMapIntensity: 0.76,
        tintColor: tint,
        emissiveColor: emissive
      };
    }
    // Flocked Velvet & Antique Bronze Filigree (Series 6 or Epic)
    if (seriesIdx === 6 || rarity === 'epic') {
      return {
        family: 'velvet-bronze',
        roughness: 0.36,
        metalness: 0.28,
        clearcoat: 0.65,
        clearcoatRoughness: 0.12,
        iridescence: 0.48,
        envMapIntensity: 0.68,
        tintColor: tint,
        emissiveColor: emissive
      };
    }
    // Washi Porcelain Polyhedron (Series 9) or Carved Stoneware/Terracotta (Series 1, 5)
    return {
      family: 'sculpted-stoneware',
      roughness: 0.52,
      metalness: 0.08,
      clearcoat: 0.32,
      clearcoatRoughness: 0.14,
      iridescence: 0.1,
      envMapIntensity: 0.5,
      tintColor: tint,
      emissiveColor: emissive
    };
  }

  applyVesselMaterials(root, fig, tapStep = 0) {
    const prof = this.getVesselMaterialProfile(fig);
    const emissiveStrength = tapStep === 0 ? 0.0 : tapStep === 1 ? 0.05 : 0.11;

    root.traverse((child) => {
      if (!child.isMesh) return;
      if (child.geometry && !child.geometry.userData?.normalsSmoothed) {
        this.computeSmoothPositionNormals(child.geometry);
        child.geometry.userData = { ...(child.geometry.userData || {}), normalsSmoothed: true };
      }
      const oldMat = child.material;
      const map = oldMat && oldMat.map ? oldMat.map : null;
      const normalMap = oldMat && oldMat.normalMap ? oldMat.normalMap : null;
      const roughnessMap = oldMat && oldMat.roughnessMap ? oldMat.roughnessMap : null;
      const metalnessMap = oldMat && oldMat.metalnessMap ? oldMat.metalnessMap : null;
      const hasVertexColors = Boolean(
        child.geometry && child.geometry.attributes && child.geometry.attributes.color
      );

      if (map) {
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = 4;
      }

      child.material = new THREE.MeshPhysicalMaterial({
        map,
        normalMap,
        roughnessMap,
        metalnessMap,
        vertexColors: hasVertexColors && !map,
        color: prof.tintColor,
        roughness: Math.max(0.08, prof.roughness - tapStep * 0.04),
        metalness: prof.metalness,
        clearcoat: prof.clearcoat,
        clearcoatRoughness: prof.clearcoatRoughness || 0.06,
        iridescence: prof.iridescence || 0.0,
        iridescenceIOR: prof.iridescenceIOR || 1.38,
        emissive: prof.emissiveColor,
        emissiveIntensity: emissiveStrength,
        envMapIntensity: prof.envMapIntensity + tapStep * 0.22,
        side: THREE.DoubleSide
      });
    });
  }

  async mountVessel(containerEl, fig, options = {}) {
    if (!containerEl || !fig) return;
    this.initRenderer();

    this.mountReqId = (this.mountReqId || 0) + 1;
    const reqId = this.mountReqId;

    const seriesIdx =
      Number(fig.seriesIndex) ||
      Number(String(fig.seriesId || 'series-1').replace(/\D+/g, '')) ||
      1;
    const clampedIdx = Math.max(1, Math.min(10, seriesIdx));
    const vesselId = `vessel-${String(clampedIdx).padStart(2, '0')}`;
    const glbUrl = `assets/models/${vesselId}.glb`;

    this.currentFig = fig;
    this.currentVesselSeriesIdx = clampedIdx;
    this.isLocked = false;
    this.tapImpulse = null;

    if (this.currentRoot) {
      this.scene.remove(this.currentRoot);
      this.currentRoot = null;
    }
    containerEl.classList.remove('has-3d-glb');
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.style.opacity = '0';
      this.renderer.clear();
    }

    if (this.currentContainer !== containerEl) {
      if (this.resizeObserver && this.currentContainer) {
        this.resizeObserver.unobserve(this.currentContainer);
      }
      this.currentContainer = containerEl;
      if (this.resizeObserver) {
        this.resizeObserver.observe(containerEl);
      }
    }

    let slot = containerEl.querySelector('.glb-stage-slot');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'glb-stage-slot';
      containerEl.appendChild(slot);
    }
    if (this.renderer.domElement.parentElement !== slot) {
      slot.appendChild(this.renderer.domElement);
    }

    this.syncSize();
    this.lastLoadStatus = 'loading';

    try {
      const modelRoot = await this.loadModel(glbUrl);
      if (this.mountReqId !== reqId) return;

      if (this.currentRoot) {
        this.scene.remove(this.currentRoot);
        this.currentRoot = null;
      }

      this.applyVesselMaterials(modelRoot, fig, 0);

      const box = new THREE.Box3().setFromObject(modelRoot);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      modelRoot.position.sub(center);

      const maxDim = Math.max(size.x, size.y, size.z) || 1.5;
      const scale = 1.44 / maxDim;
      this.baseModelScale = scale;
      modelRoot.scale.setScalar(scale);

      this.currentRoot = modelRoot;
      this.scene.add(modelRoot);

      this.controls.reset();
      this.camera.position.set(0.18, 0.14, 2.65);
      this.controls.target.set(0, 0.0, 0);
      this.controls.autoRotate = !options.disableAutoRotate;
      this.controls.autoRotateSpeed = 3.2;
      this.controls.update();

      this.renderer.render(this.scene, this.camera);
      containerEl.classList.add('has-3d-glb');
      this.renderer.domElement.style.opacity = '1';
      this.lastLoadStatus = 'loaded';
      this.startLoop();
    } catch (err) {
      console.warn('[PopStacks3DViewer] Fallback to 2D vessel cutout for', glbUrl, err);
      containerEl.classList.remove('has-3d-glb');
      if (this.renderer && this.renderer.domElement) {
        this.renderer.domElement.style.opacity = '0';
      }
      this.lastLoadStatus = 'error';
    }
  }

  pulseVesselTap(step = 1, fig = null) {
    const activeFig = fig || this.currentFig;
    if (this.currentRoot && activeFig) {
      this.applyVesselMaterials(this.currentRoot, activeFig, step);
    }
    if (this.controls) {
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = step === 1 ? 6.5 : 11.5;
    }
    this.tapImpulse = {
      startTime: performance.now(),
      duration: 380,
      step,
      baseScale: this.baseModelScale || 1
    };
  }

  async loadModel(glbUrl) {
    if (this.modelCache.has(glbUrl)) {
      return this.modelCache.get(glbUrl).clone(true);
    }
    return new Promise((resolve, reject) => {
      this.loader.load(
        glbUrl,
        (gltf) => {
          this.modelCache.set(glbUrl, gltf.scene);
          resolve(gltf.scene.clone(true));
        },
        undefined,
        (err) => reject(err)
      );
    });
  }

  async preloadFigurine(fig) {
    if (!fig || !fig.id) return null;
    this.initRenderer();
    const glbUrl = `assets/models/${fig.id}.glb`;
    try {
      return await this.loadModel(glbUrl);
    } catch (_e) {
      return null;
    }
  }

  async mount(containerEl, fig, options = {}) {
    if (!containerEl || !fig) return;
    this.initRenderer();

    this.mountReqId = (this.mountReqId || 0) + 1;
    const reqId = this.mountReqId;

    this.currentFig = fig;
    this.isLocked = !!options.locked;
    const glbUrl = `assets/models/${fig.id}.glb`;

    // Immediately clear any previously mounted 3D model so it never overlaps while loading
    if (this.currentRoot) {
      this.scene.remove(this.currentRoot);
      this.currentRoot = null;
    }
    containerEl.classList.remove('has-3d-glb', 'glb-fallback-2d');
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.style.opacity = '0';
      this.renderer.clear();
    }

    if (this.currentContainer !== containerEl) {
      if (this.resizeObserver && this.currentContainer) {
        this.resizeObserver.unobserve(this.currentContainer);
      }
      this.currentContainer = containerEl;
      if (this.resizeObserver) {
        this.resizeObserver.observe(containerEl);
      }
    }

    let slot = containerEl.querySelector('.glb-stage-slot');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'glb-stage-slot';
      containerEl.appendChild(slot);
    }
    if (this.renderer.domElement.parentElement !== slot) {
      slot.appendChild(this.renderer.domElement);
    }

    this.syncSize();
    this.lastLoadStatus = 'loading';

    try {
      const modelRoot = await this.loadModel(glbUrl);
      if (this.mountReqId !== reqId || this.currentFig.id !== fig.id) return;

      if (this.currentRoot) {
        this.scene.remove(this.currentRoot);
        this.currentRoot = null;
      }

      this.applyRarityMaterials(modelRoot, fig, this.isLocked);

      const box = new THREE.Box3().setFromObject(modelRoot);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      modelRoot.position.sub(center);

      const maxDim = Math.max(size.x, size.y, size.z) || 1.5;
      const scale = 1.36 / maxDim;
      this.baseModelScale = scale;
      this.currentVesselSeriesIdx = null;
      this.tapImpulse = null;
      modelRoot.scale.setScalar(scale);

      this.currentRoot = modelRoot;
      this.scene.add(modelRoot);

      this.controls.reset();
      this.camera.position.set(0.24, 0.12, 2.72);
      this.controls.target.set(0, 0.0, 0);
      this.controls.autoRotate = !options.disableAutoRotate;
      this.controls.autoRotateSpeed = 2.2;
      this.controls.update();

      this.renderer.render(this.scene, this.camera);
      containerEl.classList.add('has-3d-glb');
      this.renderer.domElement.style.opacity = '1';
      this.lastLoadStatus = 'loaded';
      this.startLoop();
    } catch (err) {
      console.warn('[PopStacks3DViewer] Fallback to 2D cutout for', glbUrl, err);
      containerEl.classList.remove('has-3d-glb');
      containerEl.classList.add('glb-fallback-2d');
      if (this.renderer && this.renderer.domElement) {
        this.renderer.domElement.style.opacity = '0';
      }
      this.lastLoadStatus = 'error';
    }
  }

  setAzimuthAngle(radians) {
    if (!this.camera || !this.controls) return;
    this.controls.autoRotate = false;
    const radius = 2.72;
    const y = 0.12;
    this.camera.position.set(
      Math.sin(radians) * radius,
      y,
      Math.cos(radians) * radius
    );
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    if (this.renderer && this.scene) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  startLoop() {
    if (this.rafId) return;
    const animate = () => {
      if (!this.currentContainer || !document.body.contains(this.currentContainer)) {
        this.stopLoop();
        return;
      }
      this.rafId = requestAnimationFrame(animate);

      if (this.tapImpulse && this.currentRoot) {
        const elapsed = performance.now() - this.tapImpulse.startTime;
        const dur = this.tapImpulse.duration || 380;
        const base = this.tapImpulse.baseScale || 1;
        if (elapsed >= dur) {
          this.currentRoot.scale.setScalar(base);
          this.currentRoot.rotation.x = 0;
          this.currentRoot.rotation.z = 0;
          if (this.controls) {
            this.controls.autoRotateSpeed = this.tapImpulse.step === 2 ? 5.2 : 3.8;
          }
          this.tapImpulse = null;
        } else {
          const t = elapsed / dur;
          const decay = Math.pow(1 - t, 1.8);
          const amp = (this.tapImpulse.step === 2 ? 0.22 : 0.15) * decay;
          const wave = Math.sin(t * Math.PI * 3.5);
          const sx = base * (1 + amp * wave);
          const sy = base * (1 - amp * 0.85 * wave);
          const sz = base * (1 + amp * wave);
          this.currentRoot.scale.set(sx, sy, sz);
          this.currentRoot.rotation.z = wave * 0.16 * decay;
          this.currentRoot.rotation.x = Math.cos(t * Math.PI * 2.5) * 0.1 * decay;
        }
      }

      if (this.controls) this.controls.update();
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    this.rafId = requestAnimationFrame(animate);
  }

  stopLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  getState() {
    return {
      status: this.lastLoadStatus,
      figurineId: this.currentFig ? this.currentFig.id : null,
      vesselSeriesIdx: this.currentVesselSeriesIdx || null,
      rarity: this.currentFig ? this.currentFig.rarity : null,
      locked: this.isLocked,
      cachedCount: this.modelCache.size,
      cameraPos: this.camera
        ? {
            x: Number(this.camera.position.x.toFixed(2)),
            y: Number(this.camera.position.y.toFixed(2)),
            z: Number(this.camera.position.z.toFixed(2))
          }
        : null
    };
  }
}

window.PopStacks3DViewer = new PopStacksGLBViewer();
