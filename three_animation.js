// three_animation.js

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('three-bg');

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);

    // Grid Shader Material
    const vertexShader = `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vPosition;

        void main() {
            vUv = uv;
            vec3 newPosition = position;

            // Simple wave effect for the grid
            newPosition.z += sin(newPosition.x * 0.5 + uTime * 0.5) * 0.5;
            newPosition.y += cos(newPosition.z * 0.5 + uTime * 0.5) * 0.5;

            vPosition = newPosition;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
    `;

    const fragmentShader = `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec2 vUv;
        varying vec3 vPosition;

        void main() {
            float strength = 0.0;
            
            // Grid lines on XZ plane
            float gridX = smoothstep(0.05, 0.1, abs(sin(vPosition.x * 3.0)));
            float gridZ = smoothstep(0.05, 0.1, abs(sin(vPosition.z * 3.0)));
            strength = max(gridX, gridZ);

            // Add some animation to the grid lines
            strength *= sin(uTime * 0.1 + vPosition.x * 0.1 + vPosition.z * 0.1) * 0.5 + 0.5;

            // Fade out towards the edges
            float dist = length(vUv - 0.5) * 2.0; // 0 at center, 1 at edges
            strength *= (1.0 - dist * 0.8); // Fade out

            gl_FragColor = vec4(uColor, strength);
        }
    `;

    const uniforms = {
        uTime: { value: 0.0 },
        uColor: { value: new THREE.Color(0xA259FF) } // Primary color from CSS
    };

    const geometry = new THREE.PlaneGeometry(100, 100, 100, 100); // Large plane, many segments for detailed waves
    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        transparent: true,
        side: THREE.DoubleSide
    });

    const grid = new THREE.Mesh(geometry, material);
    grid.rotation.x = Math.PI / 2; // Rotate to lie on the XZ plane
    scene.add(grid);

    // Animation loop
    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);

        uniforms.uTime.value = clock.getElapsedTime();

        renderer.render(scene, camera);
    }
    animate();

    // Handle window resizing
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Optional: GSAP animation for camera (example)
    // gsap.to(camera.position, {
    //     duration: 20,
    //     y: 10,
    //     z: 20,
    //     repeat: -1,
    //     yoyo: true,
    //     ease: "power1.inOut"
    // });
});