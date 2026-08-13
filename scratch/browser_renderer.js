import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

async function main() {
    try {
        console.log('Rendering snapshot of painted sunflowers...');
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb); // Sky blue background

        const camera = new THREE.PerspectiveCamera(45, 800 / 600, 0.1, 100);
        camera.position.set(0, 1.2, 5.0);
        camera.lookAt(0, 1.0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(800, 600);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        document.body.appendChild(renderer.domElement);

        // Ambient & Directional Sun Light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xfffaed, 1.8);
        dirLight.position.set(5, 10, 7);
        scene.add(dirLight);

        const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x335511, 0.6);
        scene.add(hemiLight);

        // Ground plane
        const groundGeo = new THREE.PlaneGeometry(20, 20);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x557a2b, roughness: 0.8 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        const loader = new GLTFLoader();
        const gltf = await new Promise((resolve, reject) => {
            loader.load('/assets/gltf_Sunflowers/gltf_Sunflowers.glb', resolve, undefined, reject);
        });

        const meshes = [];
        gltf.scene.traverse(c => {
            if (c.isMesh) meshes.push(c);
        });

        // Arrange 5 sunflowers in a row
        const spacing = 1.2;
        const startX = -((meshes.length - 1) * spacing) / 2;

        meshes.forEach((mesh, idx) => {
            const clone = mesh.clone();
            clone.position.set(startX + idx * spacing, 0, 0);
            scene.add(clone);
        });

        renderer.render(scene, camera);

        const dataUrl = renderer.domElement.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        window.onPaintComplete(base64, { rendered: true });

    } catch (err) {
        console.error(err);
        window.onPaintError(err.toString());
    }
}

main();
