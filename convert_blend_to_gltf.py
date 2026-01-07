#!/usr/bin/env python3
"""
Blender script to convert .blend files to .glb with animations

Usage:
    blender --background --python convert_blend_to_gltf.py -- <input.blend> <output.glb>

Or to convert all skeleton models:
    blender --background --python convert_blend_to_gltf.py
"""

import bpy
import sys
import os

# Get command line arguments after --
argv = sys.argv
argv = argv[argv.index("--") + 1:] if "--" in argv else []

if len(argv) >= 2:
    # Convert specific file
    input_file = argv[0]
    output_file = argv[1]

    # Clear existing scene
    bpy.ops.wm.read_homefile(use_empty=True)

    # Open the blend file
    bpy.ops.wm.open_mainfile(filepath=input_file)

    # Export to glTF
    bpy.ops.export_scene.gltf(
        filepath=output_file,
        export_format='GLB',
        export_animations=True,
        export_skins=True,
        export_morph=True,
        export_apply=False,
    )

    print(f"Converted {input_file} to {output_file}")
else:
    # Convert all skeleton models in the pack
    blend_dir = "assets/monsters/Animated Monster Pack by @Quaternius/Blend"
    output_dir = "public/models"

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    blend_files = [
        "Skeleton.blend",
        "Bat.blend",
        "Dragon.blend",
        "Slime.blend"
    ]

    for blend_file in blend_files:
        input_path = os.path.join(blend_dir, blend_file)
        output_name = blend_file.replace('.blend', '.glb')
        output_path = os.path.join(output_dir, output_name)

        if os.path.exists(input_path):
            # Clear scene
            bpy.ops.wm.read_homefile(use_empty=True)

            # Open blend file
            bpy.ops.wm.open_mainfile(filepath=input_path)

            # Export to glTF
            bpy.ops.export_scene.gltf(
                filepath=output_path,
                export_format='GLB',
                export_animations=True,
                export_skins=True,
                export_morph=True,
                export_apply=False,
            )

            print(f"Converted {blend_file} to {output_name}")

print("Conversion complete!")
