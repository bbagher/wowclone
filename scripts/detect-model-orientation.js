// Script to detect the actual facing direction of the skeleton model
// This will run in the browser where we can actually load the model

console.log(`
========================================
Skeleton Model Orientation Detection
========================================

Instructions:
1. Start the dev server: npm run dev
2. Open the browser console
3. The character model should be loaded
4. Look at the console output below
5. We'll analyze which direction the model is actually facing

To test orientation manually:
- Press W to move forward
- Observe which direction the character model faces
- The model should face AWAY from the camera
- Currently it's showing the wrong side

Copy and paste this code into the browser console:
========================================
`);

const detectionCode = `
// Detect skeleton model orientation
(function detectModelOrientation() {
    // Get the player mesh
    const playerMesh = window.game?.playerController?.getMesh();
    const skeletonRoot = window.game?.playerController?.getSkeletonRoot();

    if (!playerMesh || !skeletonRoot) {
        console.error('Could not find player mesh or skeleton root');
        console.log('Available game objects:', window.game);
        return;
    }

    console.log('\\n=== ANALYZING SKELETON MODEL ORIENTATION ===\\n');

    // Reset rotation to baseline
    playerMesh.rotation.y = 0;

    // Get bounding box
    const boundingInfo = skeletonRoot.getHierarchyBoundingVectors();
    const min = boundingInfo.min;
    const max = boundingInfo.max;
    const center = min.add(max).scale(0.5);

    console.log('Bounding box at rotation.y = 0:');
    console.log('  Min:', min);
    console.log('  Max:', max);
    console.log('  Center:', center);
    console.log('  Width (X):', max.x - min.x);
    console.log('  Depth (Z):', max.z - min.z);
    console.log('  Height (Y):', max.y - min.y);

    console.log('\\nCentroid offset from origin:');
    console.log('  X offset:', center.x);
    console.log('  Z offset:', center.z);

    // Determine facing direction based on centroid
    const absX = Math.abs(center.x);
    const absZ = Math.abs(center.z);

    let facing = '';
    let offset = 0;

    if (absX > absZ) {
        if (center.x > 0) {
            facing = '+X (East)';
            offset = -Math.PI / 2; // Model faces +X, we want camera behind at -X
        } else {
            facing = '-X (West)';
            offset = Math.PI / 2; // Model faces -X, we want camera behind at +X
        }
    } else {
        if (center.z > 0) {
            facing = '+Z (North)';
            offset = Math.PI; // Model faces +Z, we want camera behind at -Z
        } else {
            facing = '-Z (South)';
            offset = 0; // Model faces -Z, we want camera behind at +Z
        }
    }

    console.log('\\n=== DETECTED FACING DIRECTION ===');
    console.log('Model faces:', facing);
    console.log('Recommended camera offset:', offset, '(' + (offset * 180 / Math.PI) + ' degrees)');

    // Test at different rotations
    console.log('\\n=== Testing at different rotations ===');

    playerMesh.rotation.y = Math.PI / 2;
    const bounds90 = skeletonRoot.getHierarchyBoundingVectors();
    const center90 = bounds90.min.add(bounds90.max).scale(0.5);
    console.log('Rotation 90° - Center:', center90);

    playerMesh.rotation.y = Math.PI;
    const bounds180 = skeletonRoot.getHierarchyBoundingVectors();
    const center180 = bounds180.min.add(bounds180.max).scale(0.5);
    console.log('Rotation 180° - Center:', center180);

    playerMesh.rotation.y = -Math.PI / 2;
    const bounds270 = skeletonRoot.getHierarchyBoundingVectors();
    const center270 = bounds270.min.add(bounds270.max).scale(0.5);
    console.log('Rotation 270° - Center:', center270);

    // Reset
    playerMesh.rotation.y = 0;

    // Check skeleton bones if available
    const scene = playerMesh.getScene();
    if (scene.skeletons && scene.skeletons.length > 0) {
        console.log('\\n=== Skeleton bone structure ===');
        const skeleton = scene.skeletons[0];
        console.log('Number of bones:', skeleton.bones.length);

        // Look for head bone
        const headBone = skeleton.bones.find(b => b.name.toLowerCase().includes('head'));
        if (headBone) {
            const headPos = headBone.getAbsolutePosition();
            console.log('Head bone position at rotation.y=0:', headPos);
            console.log('Head bone name:', headBone.name);
        }

        // Look for spine
        const spineBone = skeleton.bones.find(b => b.name.toLowerCase().includes('spine'));
        if (spineBone) {
            console.log('Spine bone name:', spineBone.name);
        }
    }

    console.log('\\n=== VISUAL TEST ===');
    console.log('Now watch the character:');
    console.log('1. The character should be at rotation.y = 0');
    console.log('2. Which way is the character\\'s FACE/FRONT pointing?');
    console.log('   - If facing +Z (away from you initially), offset should be PI');
    console.log('   - If facing -Z (toward you initially), offset should be 0');
    console.log('   - If facing +X (to the right), offset should be -PI/2');
    console.log('   - If facing -X (to the left), offset should be PI/2');
    console.log('\\nRecommended fix in CameraController.ts line 96:');
    console.log('  this.targetAlpha = this.normalizeAngle(target.rotation.y + ' + offset + ');');
})();
`;

console.log(detectionCode);
console.log('\n========================================\n');
