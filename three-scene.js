/**
 * UNIS JOURNALISM - 3D HOLOGRAPHIC NEWS GLOBE & CONSTELLATION
 * Powered by Three.js with robust 3D Canvas Fallback
 */

(function init3DGlobe() {
  const container = document.getElementById('globe-container');
  if (!container) return;

  // Global bureau coordinates [lat, lon, name]
  const BUREAUS = [
    { name: "Geneva Bureau (Cyber & UN)", lat: 46.2044, lon: 6.1432, color: "#00f59b" },
    { name: "London Bureau (Financial Times/Reuters)", lat: 51.5074, lon: -0.1278, color: "#00d2ff" },
    { name: "New York HQ (Global Desk)", lat: 40.7128, lon: -74.0060, color: "#38bdf8" },
    { name: "Cupertino / Silicon Valley (Tech Desk)", lat: 37.3230, lon: -122.0322, color: "#00f59b" },
    { name: "Tokyo Bureau (East Asia Desk)", lat: 35.6762, lon: 139.6503, color: "#34d399" },
    { name: "Paris Bureau (ITER / Climate)", lat: 48.8566, lon: 2.3522, color: "#60a5fa" }
  ];

  // Check for Three.js availability
  if (typeof THREE !== 'undefined') {
    try {
      initThreeJS(container, BUREAUS);
      return;
    } catch (e) {
      console.warn("Three.js WebGL initialization failed, falling back to Canvas 3D:", e);
    }
  }

  // Fallback: 3D Holographic Canvas Sphere
  initCanvas3D(container, BUREAUS);
})();

function initThreeJS(container, bureaus) {
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 360;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.z = 240;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // Master Group
  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  // 1. Inner Dark Sphere
  const sphereGeo = new THREE.SphereGeometry(78, 36, 36);
  const sphereMat = new THREE.MeshBasicMaterial({
    color: 0x071539,
    transparent: true,
    opacity: 0.85
  });
  const innerSphere = new THREE.Mesh(sphereGeo, sphereMat);
  globeGroup.add(innerSphere);

  // 2. Wireframe / Longitude-Latitude Grid
  const wireGeo = new THREE.WireframeGeometry(new THREE.SphereGeometry(78.5, 20, 20));
  const wireMat = new THREE.LineBasicMaterial({
    color: 0x00d2ff,
    transparent: true,
    opacity: 0.35
  });
  const wireMesh = new THREE.LineSegments(wireGeo, wireMat);
  globeGroup.add(wireMesh);

  // 3. Coordinate Glowing Rings
  const ringGeo = new THREE.RingGeometry(86, 88, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00f59b,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.4
  });
  const ring1 = new THREE.Mesh(ringGeo, ringMat);
  ring1.rotation.x = Math.PI / 2.2;
  globeGroup.add(ring1);

  const ring2 = new THREE.Mesh(new THREE.RingGeometry(94, 95, 64), new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.25
  }));
  ring2.rotation.y = Math.PI / 3;
  globeGroup.add(ring2);

  // 4. News Constellation Particles
  const particleCount = 450;
  const particleGeo = new THREE.BufferGeometry();
  const particlePositions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    const rad = 82 + Math.random() * 8;

    particlePositions[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
    particlePositions[i * 3 + 1] = rad * Math.sin(phi) * Math.sin(theta);
    particlePositions[i * 3 + 2] = rad * Math.cos(phi);
  }

  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particleMat = new THREE.PointsMaterial({
    color: 0x00f59b,
    size: 2.2,
    transparent: true,
    opacity: 0.8
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  globeGroup.add(particles);

  // 5. Bureau Beacons (3D coordinate projection)
  bureaus.forEach(b => {
    const phi = (90 - b.lat) * (Math.PI / 180);
    const theta = (b.lon + 180) * (Math.PI / 180);
    const r = 80;

    const x = -(r * Math.sin(phi) * Math.cos(theta));
    const z = r * Math.sin(phi) * Math.sin(theta);
    const y = r * Math.cos(phi);

    // Glowing Node
    const nodeGeo = new THREE.SphereGeometry(2.4, 12, 12);
    const nodeMat = new THREE.MeshBasicMaterial({ color: b.color === "#00f59b" ? 0x00f59b : 0x00d2ff });
    const node = new THREE.Mesh(nodeGeo, nodeMat);
    node.position.set(x, y, z);
    globeGroup.add(node);

    // Radiating Pulse Ring
    const beaconRingGeo = new THREE.RingGeometry(2.8, 4.2, 16);
    const beaconRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f59b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    const beaconRing = new THREE.Mesh(beaconRingGeo, beaconRingMat);
    beaconRing.position.set(x, y, z);
    beaconRing.lookAt(0, 0, 0);
    globeGroup.add(beaconRing);
  });

  // Interaction State
  let isDragging = false;
  let prevMouseX = 0;
  let prevMouseY = 0;
  let targetRotY = 0;
  let targetRotX = 0;

  renderer.domElement.addEventListener('mousedown', e => {
    isDragging = true;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  window.addEventListener('mousemove', e => {
    if (!isDragging) {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / width - 0.5;
      const y = (e.clientY - rect.top) / height - 0.5;
      targetRotX = y * 0.4;
      targetRotY = x * 0.6;
    } else {
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      globeGroup.rotation.y += deltaX * 0.008;
      globeGroup.rotation.x += deltaY * 0.008;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    }
  });

  // Animation Loop
  let clock = 0;
  function animate() {
    requestAnimationFrame(animate);
    clock += 0.01;

    if (!isDragging) {
      globeGroup.rotation.y += 0.004;
      globeGroup.rotation.x += (targetRotX - globeGroup.rotation.x) * 0.05;
    }

    ring1.rotation.z += 0.006;
    ring2.rotation.z -= 0.004;
    particles.rotation.y += 0.002;

    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
}

// --------------------------------------------------------------------------
// 3D Canvas Fallback (Ultra Lightweight, zero dependencies)
// --------------------------------------------------------------------------
function initCanvas3D(container, bureaus) {
  const canvas = document.createElement('canvas');
  canvas.id = 'three-globe-canvas';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let width = (canvas.width = container.clientWidth || 380);
  let height = (canvas.height = container.clientHeight || 340);

  let rotY = 0;
  let rotX = 0.2;
  const radius = Math.min(width, height) * 0.36;

  // Generate sphere points
  const points = [];
  for (let lat = -80; lat <= 80; lat += 15) {
    const phi = (lat * Math.PI) / 180;
    const rAtLat = Math.cos(phi);
    const y = Math.sin(phi);
    for (let lon = 0; lon < 360; lon += 18) {
      const theta = (lon * Math.PI) / 180;
      points.push({
        x: rAtLat * Math.sin(theta),
        y: y,
        z: rAtLat * Math.cos(theta)
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    // Glowing outer halo
    const grad = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius * 1.3);
    grad.addColorStop(0, 'rgba(0, 210, 255, 0.08)');
    grad.addColorStop(0.8, 'rgba(0, 245, 155, 0.12)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.25, 0, Math.PI * 2);
    ctx.fill();

    // Render 3D rotated points
    points.forEach(p => {
      // Rotate around Y
      let x1 = p.x * Math.cos(rotY) + p.z * Math.sin(rotY);
      let z1 = -p.x * Math.sin(rotY) + p.z * Math.cos(rotY);

      // Rotate around X
      let y2 = p.y * Math.cos(rotX) - z1 * Math.sin(rotX);
      let z2 = p.y * Math.sin(rotX) + z1 * Math.cos(rotX);

      // Perspective projection
      const scale = (radius * 1.4) / (z2 + 2.5);
      const px = cx + x1 * scale * radius;
      const py = cy - y2 * scale * radius;

      if (z2 > -0.2) {
        const alpha = Math.max(0.1, (z2 + 1) / 2);
        ctx.fillStyle = z2 > 0.4 ? `rgba(0, 245, 155, ${alpha})` : `rgba(0, 210, 255, ${alpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(px, py, z2 > 0.4 ? 2 : 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    rotY += 0.008;
    requestAnimationFrame(draw);
  }

  draw();
}
