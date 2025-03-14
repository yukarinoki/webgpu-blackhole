# WebGPU Black Hole Raytracer

![Black Hole](https://github.com/yukarinoki/webgpu-blackhole-raytracer/blob/main/samples/lava_disk.jpg)

This is a WebGPU-based implementation of a black hole raytracer. It simulates the gravitational lensing effect of a Schwarzschild black hole, allowing users to visualize how light bends around a black hole.

**Try it here**
https://webgpu-blackhole-raytracer.netlify.app/

My implementation is based on the repository: [Black-Hole-Raytracer by eliot1019](https://github.com/eliot1019/Black-Hole-Raytracer).  
I'm very grateful for that implementation!

## Features
- Real-time raytracing using WebGPU for high performance
- Interactive controls for camera position, black hole parameters, and rendering settings
- Upload custom background and disk textures
- Download rendered images
- Progressive rendering with ray count display

## Requirements

- A browser that supports WebGPU (Chrome 113+, Edge 113+, or other compatible browsers)
- A GPU that supports WebGPU

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm start
```

The development server will start at http://localhost:9000.

### Build

```bash
# Build for production
npm run build
```

The build output will be in the `dist` directory.

## Implementation Details

This application is based on the C++ implementation of a black hole raytracer. It uses the Schwarzschild metric to simulate the gravitational lensing effect of a black hole.

The main components are:

- `App.ts`: Main application class that handles UI and rendering
- `RayProcessor.ts`: WebGPU-based ray tracing implementation
- `Scene.ts`: Scene representation with camera, objects, and physics
- `SchwarzschildBlackHoleEquation.ts`: Implementation of the Schwarzschild metric
- Various model and utility classes

## License

MIT
