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

    camera.position.set(0, 0, globeRadius * 3); // Adjust camera position for the globe
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
            const topojson = await response.json();

            // Simplified TopoJSON parsing (manual feature extraction from arcs)
            const land = topojson.objects.land;
            const arcs = topojson.arcs;

            const mapPoints = [];

            // A helper to decode TopoJSON arcs
            // This is a simplified version; a full topojson-client library would be more robust.
            function decodeArc(arc, scale, translate) {
                const coordinates = [];
                let x = 0, y = 0;
                for (let i = 0; i < arc.length; i++) {
                    const dx = arc[i][0];
                    const dy = arc[i][1];
                    x += dx;
                    y += dy;
                    coordinates.push([x * scale[0] + translate[0], y * scale[1] + translate[1]]);
                }
                return coordinates;
            }

            land.geometries.forEach(geometry => {
                geometry.arcs.forEach(arcIndexes => {
                    arcIndexes.forEach(arcIndex => {
                        const actualArc = arcs[arcIndex < 0 ? ~arcIndex : arcIndex];
                        const coordinates = decodeArc(
                            arcIndex < 0 ? [...actualArc].reverse() : actualArc,
                            topojson.transform.scale,
                            topojson.transform.translate
                        );

                        coordinates.forEach(coord => {
                            mapPoints.push(latLonToCartesian(coord[1], coord[0], globeRadius));
                        });
                    });
                });
            });


            // Create BufferGeometry for the world map points
            const geometry = new THREE.BufferGeometry().setFromPoints(mapPoints);

            // Create PointsMaterial for glowing dots
            const material = new THREE.PointsMaterial({
                color: new THREE.Color(0x4FC3F7), // Secondary color from CSS
                size: 0.05,
                transparent: true,
                blending: THREE.AdditiveBlending // For glowing effect
            });

            const worldMap = new THREE.Points(geometry, material);
            scene.add(worldMap);

            // Add rotation to the world map
            gsap.to(worldMap.rotation, {
                duration: 200,
                y: Math.PI * 2,
                repeat: -1,
                ease: "none"
            });

        } catch (error) {
            console.error("Error loading or processing world map:", error);
        }
    }

    // Global Network Visualization
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

    // Create connections (simplified for demonstration)
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


    // Grid Shader Material (existing code)
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

    // Call loadWorldMap
    loadWorldMap();

    // Animation loop
    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);

        const elapsedTime = clock.getElapsedTime();
        uniforms.uTime.value = elapsedTime;

        // Update uTime for link shaders
        scene.children.forEach(child => {
            if (child.material && child.material.uniforms && child.material.uniforms.uTime) {
                child.material.uniforms.uTime.value = elapsedTime;
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