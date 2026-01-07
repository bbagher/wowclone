use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Vector3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

#[wasm_bindgen]
impl Vector3 {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f32, y: f32, z: f32) -> Vector3 {
        Vector3 { x, y, z }
    }

    pub fn length(&self) -> f32 {
        (self.x * self.x + self.y * self.y + self.z * self.z).sqrt()
    }

    pub fn normalize(&mut self) {
        let len = self.length();
        if len > 0.0 {
            self.x /= len;
            self.y /= len;
            self.z /= len;
        }
    }

    pub fn scale(&self, scalar: f32) -> Vector3 {
        Vector3 {
            x: self.x * scalar,
            y: self.y * scalar,
            z: self.z * scalar,
        }
    }

    pub fn add(&self, other: &Vector3) -> Vector3 {
        Vector3 {
            x: self.x + other.x,
            y: self.y + other.y,
            z: self.z + other.z,
        }
    }
}

#[wasm_bindgen]
pub struct PlayerPhysics {
    position: Vector3,
    velocity: Vector3,
    is_grounded: bool,
    move_speed: f32,
    sprint_multiplier: f32,
    jump_force: f32,
    gravity: f32,
}

#[wasm_bindgen]
impl PlayerPhysics {
    #[wasm_bindgen(constructor)]
    pub fn new() -> PlayerPhysics {
        PlayerPhysics {
            position: Vector3::new(0.0, 1.0, 0.0),
            velocity: Vector3::new(0.0, 0.0, 0.0),
            is_grounded: false,
            move_speed: 0.1,
            sprint_multiplier: 2.0,
            jump_force: 0.3,
            gravity: -0.02,
        }
    }

    // Getters
    pub fn get_position_x(&self) -> f32 { self.position.x }
    pub fn get_position_y(&self) -> f32 { self.position.y }
    pub fn get_position_z(&self) -> f32 { self.position.z }
    pub fn is_moving(&self) -> bool {
        self.velocity.x.abs() > 0.001 || self.velocity.z.abs() > 0.001
    }
    pub fn get_rotation(&self) -> f32 {
        if self.is_moving() {
            self.velocity.z.atan2(self.velocity.x) + std::f32::consts::PI
        } else {
            0.0
        }
    }

    // Setters
    pub fn set_position(&mut self, x: f32, y: f32, z: f32) {
        self.position.x = x;
        self.position.y = y;
        self.position.z = z;
    }

    /// Update physics simulation
    /// Parameters:
    /// - move_x: horizontal movement input (-1 to 1)
    /// - move_z: forward movement input (-1 to 1)
    /// - forward_x, forward_z: camera forward direction (normalized)
    /// - right_x, right_z: camera right direction (normalized)
    /// - is_sprinting: whether sprint is active
    /// - should_jump: whether jump button is pressed
    /// - delta_time: time step for frame-rate independent physics
    pub fn update(
        &mut self,
        move_x: f32,
        move_z: f32,
        forward_x: f32,
        forward_z: f32,
        right_x: f32,
        right_z: f32,
        is_sprinting: bool,
        should_jump: bool,
        delta_time: f32,
    ) {
        // Calculate speed
        let mut speed = self.move_speed;
        if is_sprinting {
            speed *= self.sprint_multiplier;
        }

        // Calculate movement in world space
        let is_moving = move_x.abs() > 0.001 || move_z.abs() > 0.001;

        if is_moving {
            // Movement relative to camera
            // Note: Negate move_x to match Babylon.js coordinate system
            let movement_x = forward_x * move_z * speed - right_x * move_x * speed;
            let movement_z = forward_z * move_z * speed - right_z * move_x * speed;

            // Apply horizontal movement
            self.velocity.x = movement_x;
            self.velocity.z = movement_z;
        } else {
            // No input, stop horizontal movement
            self.velocity.x = 0.0;
            self.velocity.z = 0.0;
        }

        // Jump
        if should_jump && self.is_grounded {
            self.velocity.y = self.jump_force;
            self.is_grounded = false;
        }

        // Apply gravity
        self.velocity.y += self.gravity * delta_time;

        // Apply velocity to position
        self.position.x += self.velocity.x;
        self.position.y += self.velocity.y;
        self.position.z += self.velocity.z;

        // Simple ground collision
        if self.position.y <= 1.0 {
            self.position.y = 1.0;
            self.velocity.y = 0.0;
            self.is_grounded = true;
        }
    }

    /// Get movement direction for character rotation
    pub fn get_movement_angle(&self) -> f32 {
        if self.velocity.x.abs() > 0.001 || self.velocity.z.abs() > 0.001 {
            self.velocity.z.atan2(self.velocity.x) + std::f32::consts::PI
        } else {
            0.0 // Return 0 if not moving (rotation won't change)
        }
    }
}

#[wasm_bindgen(start)]
pub fn init() {
    // This is called when the WASM module is loaded
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}
