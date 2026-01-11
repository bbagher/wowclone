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

    /// Set the grounded state and reset vertical velocity
    /// This is called from TypeScript when collision detection determines
    /// the player has landed on a surface (ground, rock, platform, etc.)
    pub fn set_grounded(&mut self, grounded: bool) {
        self.is_grounded = grounded;
        if grounded {
            self.velocity.y = 0.0;
        }
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

use std::collections::{BinaryHeap, HashMap};
use std::cmp::Ordering;

// A* pathfinding node for the priority queue
#[derive(Clone)]
struct PathNode {
    x: i32,
    z: i32,
    g_cost: f32, // Cost from start to this node
    h_cost: f32, // Heuristic cost from this node to goal
    f_cost: f32, // Total cost (g + h)
}

impl PartialEq for PathNode {
    fn eq(&self, other: &Self) -> bool {
        self.f_cost == other.f_cost
    }
}

impl Eq for PathNode {}

impl PartialOrd for PathNode {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        other.f_cost.partial_cmp(&self.f_cost)
    }
}

impl Ord for PathNode {
    fn cmp(&self, other: &Self) -> Ordering {
        self.partial_cmp(other).unwrap_or(Ordering::Equal)
    }
}

#[wasm_bindgen]
pub struct Pathfinder {
    grid: Vec<bool>, // true = walkable, false = blocked
    grid_size: usize,
    cell_size: f32,
    world_offset: f32, // Offset to center grid (world_size / 2)
}

#[wasm_bindgen]
impl Pathfinder {
    #[wasm_bindgen(constructor)]
    pub fn new(grid_size: usize, cell_size: f32, world_size: f32) -> Pathfinder {
        let total_cells = grid_size * grid_size;
        Pathfinder {
            grid: vec![true; total_cells], // Initialize all as walkable
            grid_size,
            cell_size,
            world_offset: world_size / 2.0,
        }
    }

    /// Convert world position to grid coordinates
    fn world_to_grid(&self, x: f32, z: f32) -> (i32, i32) {
        let grid_x = ((x + self.world_offset) / self.cell_size).floor() as i32;
        let grid_z = ((z + self.world_offset) / self.cell_size).floor() as i32;
        (grid_x, grid_z)
    }

    /// Convert grid coordinates to world position (center of cell)
    fn grid_to_world(&self, grid_x: i32, grid_z: i32) -> (f32, f32) {
        let x = (grid_x as f32 * self.cell_size) - self.world_offset + (self.cell_size / 2.0);
        let z = (grid_z as f32 * self.cell_size) - self.world_offset + (self.cell_size / 2.0);
        (x, z)
    }

    /// Check if grid coordinates are valid
    fn is_valid(&self, grid_x: i32, grid_z: i32) -> bool {
        grid_x >= 0 && grid_x < self.grid_size as i32 &&
        grid_z >= 0 && grid_z < self.grid_size as i32
    }

    /// Get grid cell index
    fn get_index(&self, grid_x: i32, grid_z: i32) -> usize {
        (grid_z as usize * self.grid_size) + grid_x as usize
    }

    /// Mark a cell as blocked (obstacle)
    pub fn set_blocked(&mut self, x: f32, z: f32) {
        let (grid_x, grid_z) = self.world_to_grid(x, z);
        if self.is_valid(grid_x, grid_z) {
            let idx = self.get_index(grid_x, grid_z);
            self.grid[idx] = false;
        }
    }

    /// Mark a circular area as blocked
    pub fn set_blocked_circle(&mut self, x: f32, z: f32, radius: f32) {
        let (center_grid_x, center_grid_z) = self.world_to_grid(x, z);
        let grid_radius = (radius / self.cell_size).ceil() as i32;

        for dz in -grid_radius..=grid_radius {
            for dx in -grid_radius..=grid_radius {
                let grid_x = center_grid_x + dx;
                let grid_z = center_grid_z + dz;

                if self.is_valid(grid_x, grid_z) {
                    let (world_x, world_z) = self.grid_to_world(grid_x, grid_z);
                    let dist = ((world_x - x).powi(2) + (world_z - z).powi(2)).sqrt();

                    if dist <= radius {
                        let idx = self.get_index(grid_x, grid_z);
                        self.grid[idx] = false;
                    }
                }
            }
        }
    }

    /// Check if a cell is walkable
    pub fn is_walkable(&self, x: f32, z: f32) -> bool {
        let (grid_x, grid_z) = self.world_to_grid(x, z);
        if !self.is_valid(grid_x, grid_z) {
            return false;
        }
        let idx = self.get_index(grid_x, grid_z);
        self.grid[idx]
    }

    /// Heuristic function for A* (Euclidean distance)
    fn heuristic(&self, x1: i32, z1: i32, x2: i32, z2: i32) -> f32 {
        let dx = (x2 - x1) as f32;
        let dz = (z2 - z1) as f32;
        (dx * dx + dz * dz).sqrt()
    }

    /// Find path using A* algorithm
    /// Returns a flat array of [x1, z1, x2, z2, ...] coordinates in world space
    pub fn find_path(&self, start_x: f32, start_z: f32, goal_x: f32, goal_z: f32) -> Vec<f32> {
        let (start_grid_x, start_grid_z) = self.world_to_grid(start_x, start_z);
        let (goal_grid_x, goal_grid_z) = self.world_to_grid(goal_x, goal_z);

        // Check if start and goal are valid
        if !self.is_valid(start_grid_x, start_grid_z) ||
           !self.is_valid(goal_grid_x, goal_grid_z) {
            return Vec::new();
        }

        // Check if goal is walkable
        let goal_idx = self.get_index(goal_grid_x, goal_grid_z);
        if !self.grid[goal_idx] {
            return Vec::new();
        }

        let mut open_set = BinaryHeap::new();
        let mut came_from: HashMap<(i32, i32), (i32, i32)> = HashMap::new();
        let mut g_scores: HashMap<(i32, i32), f32> = HashMap::new();

        let start_node = PathNode {
            x: start_grid_x,
            z: start_grid_z,
            g_cost: 0.0,
            h_cost: self.heuristic(start_grid_x, start_grid_z, goal_grid_x, goal_grid_z),
            f_cost: 0.0,
        };

        g_scores.insert((start_grid_x, start_grid_z), 0.0);
        open_set.push(start_node);

        // 8 directions: N, NE, E, SE, S, SW, W, NW
        let directions = [
            (0, 1), (1, 1), (1, 0), (1, -1),
            (0, -1), (-1, -1), (-1, 0), (-1, 1)
        ];

        while let Some(current) = open_set.pop() {
            // Check if we reached the goal
            if current.x == goal_grid_x && current.z == goal_grid_z {
                // Reconstruct path
                let mut path = Vec::new();
                let mut current_pos = (current.x, current.z);

                // Build path in reverse
                let mut reverse_path = Vec::new();
                reverse_path.push(current_pos);

                while let Some(&prev_pos) = came_from.get(&current_pos) {
                    reverse_path.push(prev_pos);
                    current_pos = prev_pos;
                }

                // Convert to world coordinates (excluding start point, including goal)
                for i in (0..reverse_path.len() - 1).rev() {
                    let (grid_x, grid_z) = reverse_path[i];
                    let (world_x, world_z) = self.grid_to_world(grid_x, grid_z);
                    path.push(world_x);
                    path.push(world_z);
                }

                return path;
            }

            // Check all neighbors
            for (dx, dz) in &directions {
                let neighbor_x = current.x + dx;
                let neighbor_z = current.z + dz;

                if !self.is_valid(neighbor_x, neighbor_z) {
                    continue;
                }

                let neighbor_idx = self.get_index(neighbor_x, neighbor_z);
                if !self.grid[neighbor_idx] {
                    continue; // Cell is blocked
                }

                // Calculate cost (diagonal moves cost more)
                let move_cost = if *dx != 0 && *dz != 0 { 1.414 } else { 1.0 };
                let tentative_g = current.g_cost + move_cost;

                let neighbor_key = (neighbor_x, neighbor_z);
                let current_g = g_scores.get(&neighbor_key).copied().unwrap_or(f32::INFINITY);

                if tentative_g < current_g {
                    came_from.insert(neighbor_key, (current.x, current.z));
                    g_scores.insert(neighbor_key, tentative_g);

                    let h_cost = self.heuristic(neighbor_x, neighbor_z, goal_grid_x, goal_grid_z);
                    let f_cost = tentative_g + h_cost;

                    let neighbor_node = PathNode {
                        x: neighbor_x,
                        z: neighbor_z,
                        g_cost: tentative_g,
                        h_cost,
                        f_cost,
                    };

                    open_set.push(neighbor_node);
                }
            }
        }

        // No path found
        Vec::new()
    }

    /// Get a random walkable position within bounds
    pub fn get_random_walkable_position(&self, center_x: f32, center_z: f32, radius: f32) -> Vec<f32> {
        let max_attempts = 50;

        for _ in 0..max_attempts {
            // Generate random angle and distance
            let angle = (js_sys::Math::random() as f32) * 2.0 * std::f32::consts::PI;
            let distance = (js_sys::Math::random() as f32) * radius;

            let x = center_x + angle.cos() * distance;
            let z = center_z + angle.sin() * distance;

            if self.is_walkable(x, z) {
                return vec![x, z];
            }
        }

        // Fallback to center if no walkable position found
        vec![center_x, center_z]
    }
}

#[wasm_bindgen(start)]
pub fn init() {
    // This is called when the WASM module is loaded
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}
