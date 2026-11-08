# Tetherless3D

A free, installable 2D-to-3D drawing studio. Draw strokes on a 2D plane, organize them into editable layers/groups, transform whole drawings in 3D, and animate scenes.

## Prototype

The first prototype is a browser-native Three.js application with:
- Finger-first pointer drawing and brush size/opacity/color controls
- Layer groups that behave as transformable artwork containers
- 2D front-plane and 3D orbit workspaces
- Move gizmo, undo/redo, PNG export and JSON project download
- Early keyframe capture/playback experiment
- PWA manifest and offline app-shell cache

## Run locally

Serve this folder over HTTP (service workers require HTTPS or localhost):

```bash
python -m http.server 8080
```

Then open http://localhost:8080.

## Architecture

- **Input layer:** Pointer Events, pressure when exposed by hardware, plus velocity/gesture fallbacks.
- **Stroke model:** editable sampled points + brush/material metadata, independent from rendered mesh.
- **Scene graph:** each drawing layer is a Three.js Group; individual strokes remain separately editable children.
- **Transform system:** group-level move/rotate/scale gizmos.
- **Animation system:** timeline tracks and keyframes for group transforms, camera and visibility.
- **Persistence:** versioned JSON project format in IndexedDB; export/import files.
- **Rendering:** Three.js/WebGL, later custom shaders and post-processing.

## Roadmap

1. Drawing and grouped transforms (current prototype)
2. Editable stroke data, selection and multi-axis gizmos
3. Real timeline with per-layer keyframes, onion skin and playback
4. 3D guides/surface projection, advanced brushes and pressure mapping
5. IndexedDB autosave, import/export and offline asset strategy
6. Lighting, materials, effects and performance tuning

The project is free and offline-first. No account or subscription is required.
