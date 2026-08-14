import * as THREE from 'three';
import { MeshToonNodeMaterial } from 'three/webgpu';
import { 
    Fn, vec2, vec3, vec4, float, sin, cos, dot, mix, clamp, pow, 
    reflect, normalize, positionWorld, positionLocal, positionGeometry, 
    normalWorld, cameraPosition, modelWorldMatrix, 
    attribute, max, min, smoothstep, fract
} from 'three/tsl';
import { windSwayNode } from './WindSwayNode.js';

export const createTreeMaterial = (uTime, uSunDir, uTreeScale, gradientMap) => {
    const matTree = new MeshToonNodeMaterial({
        vertexColors: false,
        gradientMap: gradientMap,
        side: THREE.DoubleSide,
        dithering: true
    });

    const aIsBark = attribute('aIsBark', 'float');

    matTree.positionNode = windSwayNode(uTime, uTreeScale);

    matTree.colorNode = Fn(() => {
        // Local vertical height normalized to ~22m tree height
        const localY = clamp(positionLocal.y.div(22.0), 0.0, 1.0);
        // Radial distance from tree center trunk
        const radDist = clamp(positionLocal.xz.length().div(5.5), 0.0, 1.0);

        // Instance hash for per-tree natural color variation
        const globalPos = modelWorldMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0));
        const instHash = fract(sin(globalPos.x.mul(12.9898).add(globalPos.z.mul(78.233))).mul(43758.5453));

        // Deep rich Ghibli pine palette tiers (lush mountain evergreen, NO neon green!)
        const colDeepShadow = vec3(0.040, 0.135, 0.065); // Deep alpine spruce shadow (#0a2311)
        const colMidPine    = vec3(0.090, 0.310, 0.120); // Rich evergreen body (#174f1f)
        const colSunlitTip  = vec3(0.220, 0.540, 0.170); // Sunlit mountain pine (#388a2b)
        const colGoldenCrest= vec3(0.360, 0.680, 0.220); // Warm sun-kissed crown tips (#5cad38)

        // Blend along vertical height
        const leafGrad1 = mix(colDeepShadow, colMidPine, smoothstep(float(0.03), float(0.38), localY));
        const leafGrad2 = mix(leafGrad1, colSunlitTip, smoothstep(float(0.32), float(0.78), localY));
        
        // Add radial tip and crown highlight
        const tipHighlight = radDist.mul(0.28).add(smoothstep(float(0.72), float(1.0), localY).mul(0.40));
        const leafFinal = mix(leafGrad2, colGoldenCrest, tipHighlight);

        // Per-tree instance tint variation (subtle warm pine vs cool spruce tone)
        const tintWarm = vec3(1.10, 1.05, 0.88); // Warm sunlit pine
        const tintCool = vec3(0.88, 1.02, 1.12); // Cool spruce / alpine teal
        const instTint = mix(tintCool, tintWarm, instHash);
        const variedLeafColor = leafFinal.mul(instTint);

        // Warm rich cedar bark color gradient
        const colBarkBase = vec3(0.18, 0.10, 0.06); // Ground contact shadow (#2e1a0f)
        const colBarkMid  = vec3(0.30, 0.18, 0.11); // Warm cedar trunk (#4d2e1c)
        const colBarkHigh = vec3(0.40, 0.24, 0.15); // Upper sun-warmed bark (#663d26)
        const barkGrad1 = mix(colBarkBase, colBarkMid, smoothstep(float(0.0), float(0.28), localY));
        const barkFinal = mix(barkGrad1, colBarkHigh, smoothstep(float(0.28), float(0.70), localY));

        return mix(variedLeafColor, barkFinal, aIsBark);
    })();

    matTree.emissiveNode = Fn(() => {
        const viewDir = normalize(cameraPosition.sub(positionWorld));
        const lightDir = normalize(uSunDir);
        const norm = normalize(normalWorld);

        // Subsurface scattering when looking toward the sun through needle canopy
        const backDot = clamp(dot(viewDir.negate(), lightDir), 0.0, 1.0);
        const foliageRim = pow(float(1.0).sub(clamp(dot(norm, viewDir), 0.0, 1.0)), 2.8);
        const sunSubsurface = pow(backDot, 3.2).mul(foliageRim.mul(1.4).add(0.18)).mul(vec3(0.25, 0.45, 0.10));
        
        // Soft atmospheric sky bounce on upward surfaces
        const skyBounce = clamp(norm.y.mul(0.5).add(0.5), 0.0, 1.0).mul(vec3(0.02, 0.04, 0.07));

        return sunSubsurface.add(skyBounce).mul(float(1.0).sub(aIsBark));
    })();

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
