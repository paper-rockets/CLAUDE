import * as THREE from 'three';
import { MeshToonNodeMaterial } from 'three/webgpu';
import { windSwayNode } from './WindSwayNode.js';

export const createTreeMaterial = (gradientMap, uTime, uTreeScale) => {
    const matTree = new MeshToonNodeMaterial({
        vertexColors: true,
        gradientMap: gradientMap,
        dithering: true
    });

    matTree.positionNode = windSwayNode(uTime, uTreeScale);

    return matTree;
};

export const createBillboardMaterial = (tex, uTime, uTreeScale) => {
    const billboardMat = new MeshToonNodeMaterial({
        map: tex,
        alphaTest: 0.25,
        side: THREE.DoubleSide,
        transparent: true
    });

    billboardMat.positionNode = windSwayNode(uTime, uTreeScale);

    return billboardMat;
};
