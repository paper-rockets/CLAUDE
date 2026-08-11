import * as THREE from 'three';
import { getWorldHeight } from '../world/TerrainGenerator.js';

export class PlayerPhysics {
    constructor(characterGroup) {
        this.character = characterGroup;
        
        this.currentYaw = 0;   
        this.currentPitch = 0; 
        this.currentRoll = 0;
        this.turnVelocity = 0;
        this.maxTurnSpeed = 1.0; 
        this.turnAcceleration = 2.0; 
        this.maxBankAngle = Math.PI / 6; 
        this.maxPitchAngle = Math.PI / 10; 
        this.velocity = 18.0; 

        // Shared Temps
        this.eulerRotation = new THREE.Euler(0, 0, 0, 'YXZ');
        this.targetQuaternion = new THREE.Quaternion();
        this.tempVec1 = new THREE.Vector3();
    }

    update(delta, inputState, isBraking, isBoosting, isFlightPaused, treeGrid) {
        if (isFlightPaused) return;

        // Accelerate/Decelerate
        const targetSpeed = isBraking ? 0.0 : (isBoosting ? 250.0 : 18.0);
        this.velocity += (targetSpeed - this.velocity) * delta * (isBraking ? 3.0 : (isBoosting ? 1.5 : 1.0));

        // Steering
        const decaySteer = 1.0 - Math.exp(-3.5 * delta);
        const decayRoll = 1.0 - Math.exp(-1.5 * delta);
        const decayPitch = 1.0 - Math.exp(-1.5 * delta);
        const decayCharacterQuat = 1.0 - Math.exp(-5.0 * delta);

        if (inputState.left) {
            this.turnVelocity += this.turnAcceleration * delta;
        } else if (inputState.right) {
            this.turnVelocity -= this.turnAcceleration * delta;
        } else {
            this.turnVelocity = THREE.MathUtils.lerp(this.turnVelocity, 0, decaySteer); 
        }
        
        this.turnVelocity = Math.max(-this.maxTurnSpeed, Math.min(this.maxTurnSpeed, this.turnVelocity));
        this.currentYaw += this.turnVelocity * delta;

        // Banking
        let targetRoll = (this.turnVelocity / this.maxTurnSpeed) * this.maxBankAngle;
        this.currentRoll = THREE.MathUtils.lerp(this.currentRoll, targetRoll, decayRoll); 

        // Altitude Control
        let targetPitch = -0.18; // Default
        if (inputState.up) { 
            targetPitch = this.maxPitchAngle; 
        } else if (inputState.down) {
            targetPitch = -this.maxPitchAngle; 
        }
        this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, targetPitch, decayPitch);

        // Apply Rotations
        this.eulerRotation.set(this.currentPitch, this.currentYaw, this.currentRoll, 'YXZ');
        this.targetQuaternion.setFromEuler(this.eulerRotation);
        
        // Soft camera auto-leveling
        if (!inputState.left && !inputState.right && !inputState.up && !inputState.down) {
            this.character.quaternion.slerp(this.targetQuaternion, 1.0 - Math.exp(-1.2 * delta)); 
        } else {
            this.character.quaternion.slerp(this.targetQuaternion, decayCharacterQuat); 
        }

        // Forward Flight
        this.tempVec1.set(0, 0, -1); 
        this.tempVec1.applyQuaternion(this.character.quaternion);
        
        this.character.position.add(this.tempVec1.multiplyScalar(this.velocity * delta));

        // Anti-Clipping Floor Constraint
        const groundY = getWorldHeight(this.character.position.x, this.character.position.z);
        const minimumFlightHeight = 18;
        
        // Auto-swoop to avoid terrain collisions
        const targetMinY = groundY + 55; 
        if (this.character.position.y < targetMinY) {
            const depth = targetMinY - this.character.position.y;
            const swoopPitch = Math.min(Math.PI / 4, depth / 40.0);
            this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, swoopPitch, 1.0 - Math.exp(-3.0 * delta));
            this.character.rotation.set(this.currentPitch, this.currentYaw, 0, 'YXZ');
            
            if (this.character.position.y < groundY + 15) {
                this.character.position.y += (groundY + 15 - this.character.position.y) * (1.0 - Math.exp(-5.0 * delta));
            }
        }
        
        this.character.position.y = Math.min(Math.max(this.character.position.y, minimumFlightHeight), 3500);

        // Tree Collisions (Soft sliding physics)
        if (treeGrid) {
            const px = this.character.position.x;
            const pz = this.character.position.z;
            const py = this.character.position.y;
            
            const TREE_CELL_SIZE = 15;
            const cx = (Math.floor(px / TREE_CELL_SIZE) + 32768) & 0xFFFF;
            const cz = (Math.floor(pz / TREE_CELL_SIZE) + 32768) & 0xFFFF;
            
            // Check 3x3 neighbor cells
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const ncx = (cx + dx) & 0xFFFF;
                    const ncz = (cz + dz) & 0xFFFF;
                    const cellKey = (ncx << 16) | ncz;
                    const tree = treeGrid.get(cellKey);
                    
                    if (tree) {
                        const tx = tree.x;
                        const tz = tree.z;
                        const ty = getWorldHeight(tx, tz);
                        
                        // We sink jungle trees by 7.0m
                        // Max tree height is around 36.0m
                        const treeBottom = ty - 8.0;
                        const treeTop = ty + 28.5;
                        
                        if (py >= treeBottom && py <= treeTop) {
                            const dX = px - tx;
                            const dZ = pz - tz;
                            const distSq = dX * dX + dZ * dZ;
                            const dist = Math.sqrt(distSq);
                            
                            // Foliage vs Trunk radius based on height
                            const isFoliageZone = py > (ty + 10.0);
                            const collRad = isFoliageZone ? 12.0 : 2.5;
                            
                            if (dist < collRad && dist > 0.001) {
                                const overlap = collRad - dist;
                                // Push the player out
                                this.character.position.x += (dX / dist) * overlap;
                                this.character.position.z += (dZ / dist) * overlap;
                                // Slow down the flight
                                this.velocity *= 0.65;
                            }
                        }
                    }
                }
            }
        }
    }
}
