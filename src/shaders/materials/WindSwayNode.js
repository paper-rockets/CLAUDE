import { Fn, vec4, sin, cos, positionLocal, max, positionGeometry, modelWorldMatrix } from 'three/tsl';

export const windSwayNode = Fn(([uTime, scale]) => {
    let transformed = positionLocal.toVar();
    transformed.mulAssign(scale);

    // Get the global origin of the current instance
    const globalPos = modelWorldMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0));
    
    const sway = sin(uTime.mul(2.0).add(globalPos.x.mul(0.05)).add(globalPos.z.mul(0.05))).mul(0.08);
    const secondarySway = cos(uTime.mul(3.5).add(globalPos.x.mul(0.1))).mul(0.03);
    const totalSway = sway.add(secondarySway).mul(max(0.0, positionGeometry.y));

    transformed.x.addAssign(totalSway);
    transformed.z.addAssign(totalSway);

    return transformed;
});
