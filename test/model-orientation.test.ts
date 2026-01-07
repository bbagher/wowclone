// Test to determine the actual orientation of the skeleton model
import '@babylonjs/core/Culling/ray';
import { Vector3 } from '@babylonjs/core/Maths/math';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { Ray } from '@babylonjs/core/Culling/ray';
import {
    createTestScene,
    getForwardFromRotation,
    TestEnvironment
} from './utils';

describe('Skeleton Model Orientation Detection', () => {
    let testEnv: TestEnvironment;

    beforeEach(() => {
        testEnv = createTestScene();
    });

    afterEach(() => {
        testEnv.scene.dispose();
        testEnv.engine.dispose();
    });

    test('detect skeleton model forward direction using geometry', async () => {
        // Load the skeleton model
        const result = await SceneLoader.ImportMeshAsync(
            '',
            '/models/',
            'Skeleton.glb',
            testEnv.scene
        );

        const root = result.meshes[0];
        console.log('Loaded skeleton model');
        console.log('Root mesh:', root.name);
        console.log('Number of meshes:', result.meshes.length);

        // Get bounding box at rotation.y = 0
        root.rotation.y = 0;
        const boundingInfo = root.getHierarchyBoundingVectors();

        console.log('\n=== Bounding box at rotation.y = 0 ===');
        console.log('Min:', boundingInfo.min);
        console.log('Max:', boundingInfo.max);
        console.log('Center:', boundingInfo.min.add(boundingInfo.max).scale(0.5));

        const width = boundingInfo.max.x - boundingInfo.min.x;
        const depth = boundingInfo.max.z - boundingInfo.min.z;

        console.log('\n=== Dimensions ===');
        console.log('Width (X):', width);
        console.log('Depth (Z):', depth);

        // Calculate the centroid offset from origin
        const center = boundingInfo.min.add(boundingInfo.max).scale(0.5);
        console.log('\n=== Centroid offset ===');
        console.log('X offset:', center.x);
        console.log('Z offset:', center.z);

        // The model "faces" the direction where most of its geometry extends
        // If centroid.z > 0, model faces +Z
        // If centroid.z < 0, model faces -Z
        // If centroid.x > 0, model faces +X
        // If centroid.x < 0, model faces -X

        const absX = Math.abs(center.x);
        const absZ = Math.abs(center.z);

        let facing = '';
        if (absX > absZ) {
            facing = center.x > 0 ? '+X (East)' : '-X (West)';
        } else {
            facing = center.z > 0 ? '+Z (North)' : '-Z (South)';
        }

        console.log('\n=== DETECTED FACING DIRECTION ===');
        console.log('Model faces:', facing);

        // Now test at different rotations
        console.log('\n=== Testing rotation.y = PI/2 (90 degrees) ===');
        root.rotation.y = Math.PI / 2;
        const bounds90 = root.getHierarchyBoundingVectors();
        const center90 = bounds90.min.add(bounds90.max).scale(0.5);
        console.log('Centroid at 90°:', center90);

        console.log('\n=== Testing rotation.y = PI (180 degrees) ===');
        root.rotation.y = Math.PI;
        const bounds180 = root.getHierarchyBoundingVectors();
        const center180 = bounds180.min.add(bounds180.max).scale(0.5);
        console.log('Centroid at 180°:', center180);

        // Check if model has a skeleton
        if (result.skeletons.length > 0) {
            console.log('\n=== Skeleton bone structure ===');
            const skeleton = result.skeletons[0];
            console.log('Number of bones:', skeleton.bones.length);

            // Look for spine or head bone to determine facing
            const spineBone = skeleton.bones.find(b => b.name.toLowerCase().includes('spine'));
            const headBone = skeleton.bones.find(b => b.name.toLowerCase().includes('head'));

            if (headBone) {
                root.rotation.y = 0;
                const headPos = headBone.getAbsolutePosition();
                console.log('Head bone position at rotation.y=0:', headPos);
                console.log('Head bone name:', headBone.name);
            }

            if (spineBone) {
                console.log('Spine bone name:', spineBone.name);
            }
        }

        // This test always passes - it's for logging information
        expect(result.meshes.length).toBeGreaterThan(0);
    }, 30000); // 30 second timeout for model loading
});
