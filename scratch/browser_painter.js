import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

async function main() {
    try {
        console.log('Loading Sunflower GLB...');
        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        loader.setDRACOLoader(dracoLoader);

        const gltf = await new Promise((resolve, reject) => {
            loader.load('/assets/gltf_Sunflowers/gltf_Sunflowers.glb', resolve, undefined, reject);
        });

        console.log('GLB loaded! Scene children count:', gltf.scene.children.length);

        const meshes = [];
        gltf.scene.traverse(child => {
            if (child.isMesh) meshes.push(child);
        });

        console.log('Found meshes:', meshes.length);

        // Analyze and paint each sunflower mesh
        meshes.forEach((mesh, meshIdx) => {
            const geo = mesh.geometry;
            const posAttr = geo.getAttribute('position');
            const normAttr = geo.getAttribute('normal');
            const uvAttr = geo.getAttribute('TEXCOORD_0') || geo.getAttribute('uv');

            console.log(`\nMesh ${meshIdx} (${mesh.name}): ${posAttr.count} vertices`);

            geo.computeBoundingBox();
            const bbox = geo.boundingBox;
            const minY = bbox.min.y;
            const maxY = bbox.max.y;
            const height = maxY - minY;

            console.log(`MinY: ${minY.toFixed(3)}, MaxY: ${maxY.toFixed(3)}, Height: ${height.toFixed(3)}`);

            // Find top-most region center (the flower head location)
            let topXSum = 0, topZSum = 0, topCount = 0;
            const topThreshold = maxY - height * 0.25;

            for (let i = 0; i < posAttr.count; i++) {
                const y = posAttr.getY(i);
                if (y > topThreshold) {
                    topXSum += posAttr.getX(i);
                    topZSum += posAttr.getZ(i);
                    topCount++;
                }
            }

            const headCenterX = topCount > 0 ? topXSum / topCount : (bbox.min.x + bbox.max.x) / 2;
            const headCenterZ = topCount > 0 ? topZSum / topCount : (bbox.min.z + bbox.max.z) / 2;
            const headCenterY = maxY - height * 0.10;

            console.log(`Estimated Head Center: (${headCenterX.toFixed(3)}, ${headCenterY.toFixed(3)}, ${headCenterZ.toFixed(3)})`);

            // Create Vertex Colors Attribute
            const colors = new Float32Array(posAttr.count * 3);

            // Natural, organic Ghibli sunflower palette (in linear RGB space)
            const cStemDark = new THREE.Color(0x2d6323);   // Warm stem green
            const cStemLight = new THREE.Color(0x3f8a32);  // Rich stem green
            const cLeafGreen = new THREE.Color(0x4ca336);  // Natural Ghibli leaf green
            const cLeafHighlight = new THREE.Color(0x6ec450); // Leaf edge highlight
            const cReceptacle = new THREE.Color(0x38782a); // Flower back calyx green
            
            const cDiskCenter = new THREE.Color(0x28160a); // Deep rich chocolate seed disk
            const cDiskOuter = new THREE.Color(0x5a340e);  // Warm amber disk florets
            const cDiskGoldBorder = new THREE.Color(0xa86812); // Gold border transition

            const cPetalBase = new THREE.Color(0xe68c04);  // Warm golden amber petal base
            const cPetalMid = new THREE.Color(0xfab800);   // Rich golden sunflower yellow mid petal
            const cPetalTip = new THREE.Color(0xffda1a);   // Soft sunlit yellow petal tip

            const tempColor = new THREE.Color();

            for (let i = 0; i < posAttr.count; i++) {
                const vx = posAttr.getX(i);
                const vy = posAttr.getY(i);
                const vz = posAttr.getZ(i);

                const nx = normAttr ? normAttr.getX(i) : 0;
                const ny = normAttr ? normAttr.getY(i) : 1;
                const nz = normAttr ? normAttr.getZ(i) : 0;

                // Distance from flower head center
                const dx = vx - headCenterX;
                const dy = vy - headCenterY;
                const dz = vz - headCenterZ;
                const distFromHeadCenter = Math.sqrt(dx * dx + dy * dy + dz * dz);
                const radialDistHead = Math.sqrt(dx * dx + dz * dz);

                // Normalized height on plant (0 at bottom, 1 at top)
                const normY = (vy - minY) / height;

                if (normY < 0.72) {
                    // STEM AND LEAVES (lower & middle part of plant)
                    const stemDist = Math.sqrt(vx * vx + vz * vz);
                    if (stemDist > 0.075 || Math.abs(ny) < 0.4) {
                        // Leaf surface
                        const leafFactor = Math.min(1.0, Math.max(0.0, (stemDist - 0.05) / 0.25));
                        tempColor.copy(cLeafGreen).lerp(cLeafHighlight, leafFactor * 0.5 + Math.random() * 0.1);
                    } else {
                        // Main vertical stem
                        tempColor.copy(cStemDark).lerp(cStemLight, normY);
                    }
                } else {
                    // FLOWER HEAD REGION (top part of plant)
                    if (ny < -0.3 && normY < 0.88) {
                        // Underneath of flower head (sepal / calyx / green back casing)
                        tempColor.copy(cReceptacle).lerp(cLeafGreen, 0.4);
                    } else if (radialDistHead < 0.09) {
                        // CENTER DISK (Seeds / Florets)
                        const centerFactor = radialDistHead / 0.09; // 0 at absolute center, 1 at disk edge
                        if (centerFactor < 0.5) {
                            tempColor.copy(cDiskCenter).lerp(cDiskOuter, centerFactor * 2.0);
                        } else {
                            tempColor.copy(cDiskOuter).lerp(cDiskGoldBorder, (centerFactor - 0.5) * 2.0);
                        }
                    } else {
                        // PETALS (Ray florets) - Luminous sunlit golden yellow
                        const petalDist = (radialDistHead - 0.08) / 0.25; // 0 near disk edge, 1 at petal tip
                        const clampedPetal = Math.min(1.0, Math.max(0.0, petalDist));

                        if (clampedPetal < 0.35) {
                            tempColor.copy(cPetalBase).lerp(cPetalMid, clampedPetal / 0.35);
                        } else {
                            tempColor.copy(cPetalMid).lerp(cPetalTip, (clampedPetal - 0.35) / 0.65);
                        }
                    }
                }

                colors[i * 3 + 0] = tempColor.r;
                colors[i * 3 + 1] = tempColor.g;
                colors[i * 3 + 2] = tempColor.b;
            }

            geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            
            // Create double-sided vibrant material with vertex colors
            mesh.material = new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.6,
                metalness: 0.1,
                side: THREE.DoubleSide
            });
        });

        console.log('Finished painting all meshes! Exporting to GLB...');

        const exporter = new GLTFExporter();
        exporter.parse(
            gltf.scene,
            (result) => {
                const blob = new Blob([result], { type: 'application/octet-stream' });
                const reader = new FileReader();
                reader.onload = () => {
                    const base64 = reader.result.split(',')[1];
                    window.onPaintComplete(base64, {
                        meshCount: meshes.length,
                        totalBytes: result.byteLength
                    });
                };
                reader.readAsDataURL(blob);
            },
            (error) => {
                console.error('Exporter error:', error);
                window.onPaintError(error);
            },
            { binary: true }
        );

    } catch (err) {
        console.error('Main error:', err);
        window.onPaintError(err.toString());
    }
}

main();
