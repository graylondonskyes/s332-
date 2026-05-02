(function () {
  const canvas = document.getElementById('skye3d');
  if (!canvas) return;

  function fallbackScene() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let width = 0;
    let height = 0;
    const points = Array.from({ length: 86 }, (_, index) => ({
      seed: index * 13.37,
      radius: 60 + (index % 9) * 28,
      speed: .00028 + (index % 7) * .00005,
      size: 1 + (index % 4),
    }));

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function frame(time) {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      const cx = width * .58;
      const cy = height * .48;
      points.forEach((point) => {
        const angle = time * point.speed + point.seed;
        const x = cx + Math.cos(angle * 1.7) * point.radius + Math.sin(angle * .6) * 120;
        const y = cy + Math.sin(angle * 1.2) * point.radius * .58;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, point.size * 14);
        glow.addColorStop(0, 'rgba(57,255,136,.7)');
        glow.addColorStop(.48, 'rgba(93,241,255,.22)');
        glow.addColorStop(1, 'rgba(255,79,216,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, point.size * 14, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';
      requestAnimationFrame(frame);
    }

    window.addEventListener('resize', resize);
    resize();
    requestAnimationFrame(frame);
  }

  async function threeScene() {
    const THREE = await import('https://unpkg.com/three@0.160.0/build/three.module.js');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, .1, 100);
    camera.position.set(0, 0, 8);

    const group = new THREE.Group();
    scene.add(group);

    const geometry = new THREE.IcosahedronGeometry(1.8, 2);
    const material = new THREE.MeshStandardMaterial({
      color: 0x39ff88,
      emissive: 0x0a7d42,
      emissiveIntensity: .72,
      metalness: .38,
      roughness: .24,
      wireframe: true,
    });
    const core = new THREE.Mesh(geometry, material);
    group.add(core);

    const shell = new THREE.Mesh(
      new THREE.TorusKnotGeometry(2.45, .035, 220, 12),
      new THREE.MeshBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: .88 })
    );
    group.add(shell);

    const particleGeometry = new THREE.BufferGeometry();
    const count = 900;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const radius = 3.2 + Math.random() * 4.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * .64;
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({ color: 0x5df1ff, size: .025, transparent: true, opacity: .72 })
    );
    group.add(particles);

    scene.add(new THREE.AmbientLight(0x9dffd0, 1.6));
    const green = new THREE.PointLight(0x39ff88, 9, 18);
    green.position.set(-3, 2, 4);
    scene.add(green);
    const pink = new THREE.PointLight(0xff4fd8, 7, 18);
    pink.position.set(3, -1, 4);
    scene.add(pink);

    function resize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      group.position.x = width > 1000 ? 2.5 : .6;
      group.scale.setScalar(width > 680 ? 1 : .72);
    }

    function animate(time) {
      const t = time * .001;
      core.rotation.x = t * .34;
      core.rotation.y = t * .48;
      shell.rotation.x = -t * .2;
      shell.rotation.z = t * .42;
      particles.rotation.y = t * .05;
      group.rotation.y = Math.sin(t * .35) * .16;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);
    resize();
    requestAnimationFrame(animate);
  }

  threeScene().catch(fallbackScene);
})();
