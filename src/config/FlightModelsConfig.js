// Flight Models Registry & Calibration Config
// Defines models in public/flight_models/ with verified Euler orientation, scale, and animation clips.

export const FLIGHT_MODELS = [
    {
        id: 'kiki',
        name: 'Kiki (Broomstick)',
        icon: '🧹',
        file: 'flight_models/kiki-lowpoly.glb',
        rotX: 0,
        rotY: 180,
        rotZ: 0,
        scale: 1.3,
        offsetY: 0,
        anim: null
    },
    {
        id: 'princess',
        name: 'Princess on Whale',
        icon: '🐋',
        file: 'flight_models/Princess.glb',
        rotX: 0,
        rotY: 180,
        rotZ: 0,
        scale: 2.8,
        offsetY: 0,
        anim: null
    },
    {
        id: 'american_robin',
        name: 'American Robin',
        icon: '🐦',
        file: 'flight_models/american_robin_-_in_flight.glb',
        rotX: 0,
        rotY: 180,
        rotZ: 0,
        scale: 1.5,
        offsetY: 0,
        anim: 'Wings Flapping'
    },
    {
        id: 'wood_pewee',
        name: 'Eastern Wood-Pewee',
        icon: '🕊️',
        file: 'flight_models/eastern_wood-pewee_-_in_flight.glb',
        rotX: 0,
        rotY: 180,
        rotZ: 0,
        scale: 1.5,
        offsetY: 0,
        anim: 'Wings Flapping'
    },
    {
        id: 'american_bittern',
        name: 'American Bittern',
        icon: '🦅',
        file: 'flight_models/american_bittern_-_in_flight.glb',
        rotX: 0,
        rotY: 180,
        rotZ: 0,
        scale: 1.6,
        offsetY: 0,
        anim: 'Wing Flapping'
    },
    {
        id: 'scarlet_macaw',
        name: 'Scarlet Macaw',
        icon: '🦜',
        file: 'flight_models/animated_parrot.glb',
        rotX: -30,
        rotY: 180,
        rotZ: 0,
        scale: 1.6,
        offsetY: 0,
        anim: '02-flying'
    },
    {
        id: 'birds_flock',
        name: 'Bird Flock',
        icon: '🪶',
        file: 'flight_models/birds.glb',
        rotX: 0,
        rotY: 0,
        rotZ: 0,
        scale: 1.6,
        offsetY: 0,
        anim: 'Scene'
    },
    {
        id: 'blue_butterfly',
        name: 'Blue Morpho Butterfly',
        icon: '🦋',
        file: 'flight_models/borboleta_azul_-_butterfly.glb',
        rotX: 0,
        rotY: -90,
        rotZ: 0,
        scale: 2.2,
        offsetY: 0,
        anim: 'ArmatureAction.001'
    },
    {
        id: 'monarch_butterfly',
        name: 'Monarch Butterfly',
        icon: '🦋',
        file: 'flight_models/idl_flight_on_spot.glb',
        rotX: 0,
        rotY: 0,
        rotZ: 0,
        scale: 2.8,
        offsetY: 2.5,
        anim: 'Take 001'
    },
    {
        id: 'tropical_parrot',
        name: 'Tropical Parrot',
        icon: '🦜',
        file: 'flight_models/parrot_ai.glb',
        rotX: -25,
        rotY: 90,
        rotZ: 0,
        scale: 1.6,
        offsetY: 0,
        anim: 'Object_0'
    },
    {
        id: 'quetzal',
        name: 'Resplendent Quetzal',
        icon: '🌿',
        file: 'flight_models/quetzal_animation__texture_test.glb',
        rotX: 0,
        rotY: 180,
        rotZ: 0,
        scale: 1.6,
        offsetY: 0,
        anim: 'Take 001'
    }
];
