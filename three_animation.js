// three_animation.js

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('three-bg');

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const globeRadius = 5; // Define a radius for the globe

    // Adjusted camera position for Tron-style grid view
    camera.position.set(0, 10, 20); // Higher Y, further Z
    camera.lookAt(0, 0, 0);

    // Function to convert lat/lon to 3D Cartesian coordinates
    function latLonToCartesian(lat, lon, radius) {
        const phi = (90 - lat) * Math.PI / 180; // Latitude to polar
        const theta = (lon + 180) * Math.PI / 180; // Longitude to azimuthal

        const x = -(radius * Math.sin(phi) * Math.cos(theta));
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);

        return new THREE.Vector3(x, y, z);
    }

    // Function to load and process world map data
    async function loadWorldMap() {
        try {
            const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
            const topojsonRes = await response.json();

            // Use topojson.feature to convert to GeoJSON features
            const countries = topojson.feature(topojsonRes, topojsonRes.objects.land);

            const mapPoints = [];
            countries.features.forEach(feature => {
                if (feature.geometry.type === 'Polygon') {
                    feature.geometry.coordinates.forEach(polygon => {
                        polygon.forEach(coord => {
                            mapPoints.push(latLonToCartesian(coord[1], coord[0], globeRadius));
                        });
                    });
                } else if (feature.geometry.type === 'MultiPolygon') {
                    feature.geometry.coordinates.forEach(multiPolygon => {
                        multiPolygon.forEach(polygon => {
                            polygon.forEach(coord => {
                                mapPoints.push(latLonToCartesian(coord[1], coord[0], globeRadius));
                            });
                        });
                    });
                }
            });

            // Create BufferGeometry for the world map points
            const geometry = new THREE.BufferGeometry().setFromPoints(mapPoints);

            // Create PointsMaterial for glowing dots
            const material = new THREE.PointsMaterial({
                color: new THREE.Color(0x00FFFF), // Cyan, more vibrant
                size: 0.07, // Slightly increased dot size
                transparent: true,
                blending: THREE.AdditiveBlending // For glowing effect
            });

            const worldMap = new THREE.Points(geometry, material);
            scene.add(worldMap);

            // Add rotation to the world map
            gsap.to(worldMap.rotation, {
                duration: 600, // Slowed down rotation further
                y: Math.PI * 2,
                repeat: -1,
                ease: "none"
            });

        } catch (error) {
            console.error("Error loading or processing world map:", error);
        }
    }

    // Global Network Visualization (remains largely the same)
    const cities = [
        { name: "London", lat: 51.5, lon: -0.1 },
        { name: "New York", lat: 40.7, lon: -74.0 },
        { name: "Tokyo", lat: 35.6, lon: 139.6 },
        { name: "Sydney", lat: -33.8, lon: 151.2 },
        { name: "Cape Town", lat: -33.9, lon: 18.4 },
        { name: "Rio de Janeiro", lat: -22.9, lon: -43.1 },
        { name: "Dubai", lat: 25.2, lon: 55.2 },
        { name: "Singapore", lat: 1.3, lon: 103.8 }
    ];

    const nodes = [];
    cities.forEach(city => {
        const pos = latLonToCartesian(city.lat, city.lon, globeRadius);
        nodes.push({ name: city.name, position: pos });

        // Add small point for each city
        const cityGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const cityMaterial = new THREE.MeshBasicMaterial({ color: 0xFFD700 }); // Gold color
        const cityMesh = new THREE.Mesh(cityGeometry, cityMaterial);
        cityMesh.position.copy(pos);
        scene.add(cityMesh);
    });

    const linkVertexShader = `
        uniform float uTime;
        attribute float lineDistance;
        varying float vLineDistance;
        void main() {
            vLineDistance = lineDistance;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const linkFragmentShader = `
        uniform float uTime;
        uniform vec3 color;
        varying float vLineDistance;
        void main() {
            float speed = 1.0;
            float flow = fract(vLineDistance * 2.0 - uTime * speed);
            float alpha = smoothstep(0.0, 0.5, flow) * smoothstep(1.0, 0.5, flow);
            gl_FragColor = vec4(color, alpha);
        }
    `;

    const links = [
        ["London", "New York"],
        ["New York", "Rio de Janeiro"],
        ["London", "Dubai"],
        ["Dubai", "Singapore"],
        ["Singapore", "Sydney"],
        ["Sydney", "Tokyo"],
        ["Tokyo", "New York"],
        ["Cape Town", "London"]
    ];

    links.forEach(link => {
        const startNode = nodes.find(node => node.name === link[0]);
        const endNode = nodes.find(node => node.name === link[1]);

        if (startNode && endNode) {
            const start = startNode.position;
            const end = endNode.position;

            // Calculate mid-point and elevate it for a curve
            const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
            midPoint.normalize().multiplyScalar(globeRadius + 0.5); // Elevate above the globe

            const curve = new THREE.QuadraticBezierCurve3(start, midPoint, end);
            const points = curve.getPoints(50); // Get 50 points along the curve

            const geometry = new THREE.BufferGeometry().setFromPoints(points);

            // Add an attribute for line distance for shader animation
            const distances = [];
            let totalDistance = 0;
            for (let i = 0; i < points.length - 1; i++) {
                totalDistance += points[i].distanceTo(points[i+1]);
            }
            let currentDistance = 0;
            for (let i = 0; i < points.length; i++) {
                distances.push(currentDistance / totalDistance);
                if (i < points.length - 1) {
                    currentDistance += points[i].distanceTo(points[i+1]);
                }
            }
            geometry.setAttribute('lineDistance', new THREE.BufferAttribute(new Float32Array(distances), 1));

            const material = new THREE.ShaderMaterial({
                vertexShader: linkVertexShader,
                fragmentShader: linkFragmentShader,
                uniforms: {
                    uTime: { value: 0 },
                    color: { value: new THREE.Color(0xFFFFFF) } // White for links
                },
                transparent: true,
                blending: THREE.AdditiveBlending
            });

            const line = new THREE.Line(geometry, material);
            scene.add(line);
        }
    });

    // Tron-style Grid Implementation
    const tronGridVertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const tronGridFragmentShader = `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uGridSize; // Size of the grid cells
        uniform float uGridWidth; // Thickness of the grid lines
        uniform float uScrollSpeed; // How fast the grid scrolls

        varying vec2 vUv;

        void main() {
            vec2 uv = vUv;
            uv.y -= uTime * uScrollSpeed; // Scroll effect

            vec2 grid = fract(uv * uGridSize); // Repeating grid pattern

            float lineX = smoothstep(0.0, uGridWidth, grid.x) - smoothstep(uGridWidth, 1.0, grid.x);
            float lineY = smoothstep(0.0, uGridWidth, grid.y) - smoothstep(uGridWidth, 1.0, grid.y);
            
            // Glowing effect
            float glow = max(lineX, lineY);
            glow = pow(glow, 0.5); // Soften the glow

            // Color and fade based on glow
            gl_FragColor = vec4(uColor * glow, glow);
        }
    `;

    const tronGridUniforms = {
        uTime: { value: 0.0 },
        uColor: { value: new THREE.Color(0x00FFFF) }, // Cyan for Tron lines
        uGridSize: { value: 50.0 }, // How many grid lines
        uGridWidth: { value: 0.02 }, // Thickness of grid lines
        uScrollSpeed: { value: 0.1 } // Speed of scrolling
    };

    const tronGridGeometry = new THREE.PlaneGeometry(200, 200, 1, 1); // Large flat plane
    const tronGridMaterial = new THREE.ShaderMaterial({
        vertexShader: tronGridVertexShader,
        fragmentShader: tronGridFragmentShader,
        uniforms: tronGridUniforms,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });

    const tronGrid = new THREE.Mesh(tronGridGeometry, tronGridMaterial);
    tronGrid.rotation.x = -Math.PI / 2; // Lay flat on XZ plane
    tronGrid.position.y = -globeRadius - 0.5; // Place below the globe
    scene.add(tronGrid);

    // Call loadWorldMap
    loadWorldMap();

    // Animation loop
    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);

        const elapsedTime = clock.getElapsedTime();
        
        // Update uTime for all shaders
        tronGridUniforms.uTime.value = elapsedTime;

        scene.children.forEach(child => {
            if (child.material && child.material.uniforms) {
                if (child.material.uniforms.uTime) {
                    child.material.uniforms.uTime.value = elapsedTime;
                }
            }
        });

        renderer.render(scene, camera);
    }
    animate();

    // Handle window resizing
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
});