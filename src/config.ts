export const GameConfig = {
    // Player movement
    MOVE_SPEED: 0.1,
    SPRINT_MULTIPLIER: 2.0,
    JUMP_FORCE: 0.3,
    GRAVITY: -0.02,

    // Camera settings
    CAMERA_RADIUS: 15,
    CAMERA_BETA: Math.PI / 3.5,
    CAMERA_MIN_RADIUS: 5,
    CAMERA_MAX_RADIUS: 30,
    CAMERA_MIN_BETA: 0.1,
    CAMERA_MAX_BETA: Math.PI / 2.2,
    CAMERA_WHEEL_PRECISION: 50,
    CAMERA_ANGULAR_SENSITIVITY: 500,
    CAMERA_INERTIA: 0.5,

    // Graphics
    SHADOW_MAP_SIZE: 1024,
    SHADOW_BLUR_SCALE: 2,

    // Environment
    GROUND_SIZE: 100,
    TERRAIN_HEIGHT_SCALE: 2,

    // Player physics
    PLAYER_GROUND_HEIGHT: 1,

    // UI
    FPS_UPDATE_INTERVAL: 100, // milliseconds

    // Input keys
    KEYS: {
        FORWARD: 'w',
        BACKWARD: 's',
        LEFT: 'a',
        RIGHT: 'd',
        JUMP: ' ',
        SPRINT: 'shift',
        ROTATE_LEFT: 'q',
        ROTATE_RIGHT: 'e'
    },

    // Rotation
    ROTATION_SPEED: 0.05, // radians per frame

    // Keyboard event types
    KEYBOARD_EVENT_TYPE: {
        KEY_DOWN: 1,
        KEY_UP: 2
    }
} as const;
