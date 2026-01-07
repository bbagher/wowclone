# WoW Clone POC - Babylon.js

A browser-based 3D game proof-of-concept using Babylon.js and TypeScript.

## Quick Start

```bash
npm install
npm run dev
```

Then open your browser to `http://localhost:3000`

## Controls

- **WASD** - Move character
- **Mouse** - Look around (click canvas first)
- **Shift** - Sprint
- **Space** - Jump

## Features

- 3D environment with terrain
- Nature assets (trees, plants) loaded from your Quaternius pack
- Third-person camera following player capsule
- Physics (gravity, jumping, ground collision)
- Dynamic lighting and shadows
- FPS counter and position display

## Converting Monster Models (FBX to glTF)

Your monster pack came with FBX files that need conversion for web use. Here are your options:

### Option 1: Online Converter (Easiest)
1. Go to https://products.aspose.app/3d/conversion/fbx-to-gltf
2. Upload each FBX file from `assets/monsters/Animated Monster Pack by @Quaternius/FBX/`
3. Download the converted glTF files
4. Place them in `public/models/` folder

### Option 2: Blender (Most Control)
```bash
brew install blender  # macOS
```

Then use this script to batch convert:

```bash
# Create conversion script
cat > convert_models.sh << 'EOF'
#!/bin/bash
for file in "assets/monsters/Animated Monster Pack by @Quaternius/Blend"/*.blend; do
    filename=$(basename "$file" .blend)
    blender "$file" --background --python - <<PYTHON
import bpy
import os
bpy.ops.export_scene.gltf(
    filepath="public/models/${filename}.glb",
    export_format='GLB',
    export_animations=True
)
PYTHON
done
EOF

chmod +x convert_models.sh
./convert_models.sh
```

### Option 3: Use OBJ Files (No Animation)
The pack includes OBJ files which work in browsers but don't have animations:
- Already compatible with Babylon.js
- Just copy from `assets/monsters/.../OBJ/` to `public/models/`
- Update code to load `.obj` instead of `.glb`

## Project Structure

```
3dgame/
├── src/
│   └── main.ts          # Main game code
├── assets/              # Your downloaded assets
│   ├── monsters/        # Monster pack
│   └── nature/          # Nature MegaKit
├── public/              # (create this for web-ready models)
├── index.html           # HTML entry point
├── package.json         # Dependencies
└── vite.config.ts       # Build configuration
```

## Next Steps

1. Convert monster models (see above)
2. Replace the capsule player with an actual monster model
3. Add animations (walk, run, attack)
4. Add more terrain features
5. Implement multiplayer with WebSockets

## Tech Stack

- **Babylon.js 7** - WebGL 3D engine
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Quaternius Assets** - Free low-poly models

## Performance

Current scene runs at 60 FPS with:
- Dynamic terrain
- 45+ nature asset instances
- Real-time shadows
- Player physics

Ready to scale to hundreds of objects with optimization.
