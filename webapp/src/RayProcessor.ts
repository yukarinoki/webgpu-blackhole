import { Scene } from './Scene';
import { Vector3D, cross } from './models/Vector3D';
import { Matrix4x4 } from './models/Matrix4x4';
import { SchwarzschildBlackHoleEquation } from './physics/SchwarzschildBlackHoleEquation';
import { ArgbColor } from './ArgbColor';
import { Utils } from './Utils';

// WebGPU shader for ray tracing
const rayTracingShader = `
struct Camera {
  position: vec3<f32>,
  @align(16) lookAt: vec3<f32>,
  @align(16) up: vec3<f32>,
  fov: f32,
  tanFov: f32,
}

struct BlackHoleParams {
  potentialCoefficient: f32,
  stepSize: f32,
  @align(8) _pad1: f32,
  _pad2: f32,
}

struct Ray {
  origin: vec3<f32>,
  @align(16) direction: vec3<f32>,
  h2: f32,
}

struct Uniforms {
  camera: Camera,
  blackHole: BlackHoleParams,
  @align(16) width: f32,
  height: f32,
  frameCount: f32,
  raysPerFrame: u32,
  diskInnerRadius: f32,
  diskOuterRadius: f32,
  skyRadius: f32,
  horizonRadius: f32,
  randomSeed: f32,
  maxIterations: f32,
  jitterScale: f32,
}

// Random number generator based on hash function
fn hash(p: vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}

// Generate a random float between 0 and 1
fn random(seed: vec2<f32>) -> f32 {
  return hash(seed);
}

// Generate a random vector in a unit disk
fn randomInUnitDisk(seed: vec2<f32>) -> vec2<f32> {
  let theta = random(seed) * 2.0 * 3.14159;
  let r = sqrt(random(seed + vec2<f32>(1.0, 2.0)));
  return vec2<f32>(r * cos(theta), r * sin(theta));
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>; // Format will be determined at runtime
@group(0) @binding(6) var<storage, read_write> accumulationBuffer: array<f32>;
@group(0) @binding(2) var diskTexture: texture_2d<f32>;
@group(0) @binding(3) var skyTexture: texture_2d<f32>;
@group(0) @binding(4) var diskSampler: sampler;
@group(0) @binding(5) var skySampler: sampler;

// Convert from Cartesian to Spherical coordinates
fn toSpherical(p: vec3<f32>) -> vec3<f32> {
  let r = length(p);
  if (r == 0.0) {
    return vec3<f32>(0.0, 0.0, 0.0);
  }
  let theta = acos(p.z / r);
  let phi = atan2(p.y, p.x);
  return vec3<f32>(r, theta, phi);
}

// Cross product
fn cross3(a: vec3<f32>, b: vec3<f32>) -> vec3<f32> {
  return vec3<f32>(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x
  );
}

// Set initial conditions for ray
fn setInitialConditions(ray: ptr<function, Ray>) {
  let c = cross3((*ray).origin, (*ray).direction);
  (*ray).h2 = dot(c, c);
}

// Apply Schwarzschild equation to update ray
fn applyEquation(ray: ptr<function, Ray>, step: f32) {
  // Update position
  (*ray).origin += (*ray).direction * step;
  
  // Calculate acceleration
  let r2 = dot((*ray).origin, (*ray).origin);
  let accel = (*ray).origin * (uniforms.blackHole.potentialCoefficient * (*ray).h2 / pow(r2, 2.5));
  
  // Update velocity
  (*ray).direction += accel * step;
}

// Map disk coordinates to texture
fn mapDiskCoords(r: f32, phi: f32) -> vec2<f32> {
  let innerRadius = uniforms.diskInnerRadius;
  let outerRadius = uniforms.diskOuterRadius;
  
  if (r < innerRadius || r > outerRadius) {
    return vec2<f32>(0.0, 1.0);
  }
  
  // Texture coordinates
  var x = (phi / (2.0 * 3.14159)) % 1.0;
  if (x < 0.0) {
    x += 1.0;
  }


  if (x < 0.5) {
    x = 0.49;
  } else {
    x = 0.51;
  }

  var y = (r - innerRadius) / (outerRadius - innerRadius);
  y = clamp(y, 0.0, 1.0);  
  return vec2<f32>(x, y);
}

// Map sky coordinates to texture
fn mapSkyCoords(theta: f32, phi: f32) -> vec2<f32> {
  var x = (phi / (2.0 * 3.14159)) % 1.0;
  if (x < 0.0) {
    x += 1.0;
  }
  
  var y = (theta / 3.14159) % 1.0;
  if (y < 0.0) {
    y += 1.0;
  }
  
  return vec2<f32>(x, y);
}

// mix color

fn mixColor(hitColor: vec4<f32>, tintColor: vec4<f32>) -> vec4<f32> {
  if (tintColor.a == 0.0) {
    return hitColor;
  }

  let r = (hitColor.r + tintColor.r) / 2.0;
  let g = (hitColor.g + tintColor.g) / 2.0;
  let b = (hitColor.b + tintColor.b) / 2.0;

  return vec4<f32>(
    min(r, 1.0),
    min(g, 1.0),
    min(b, 1.0),
    1.0
  );
}

fn remap(x: f32, inMin: f32, inMax: f32, outMin: f32, outMax: f32) -> f32 {
  return outMin + (x - inMin) * (outMax - outMin) / (inMax - inMin);
}


// Add colors
fn addColor(hitColor: vec4<f32>, tintColor: vec4<f32>) -> vec4<f32> {
  if (tintColor.a == 0.0) {
    return hitColor;
  }
  
  let brightness = (max(max(tintColor.r, tintColor.g), tintColor.b) + 
                   min(min(tintColor.r, tintColor.g), tintColor.b)) / 2.0;
  
  let r = ((1.0 - brightness) * hitColor.r + max(tintColor.r, 0.0) * 255.0 / 205.0);
  let g = ((1.0 - brightness) * hitColor.g + max(tintColor.g, 0.0) * 255.0 / 205.0);
  let b = ((1.0 - brightness) * hitColor.b + max(tintColor.b, 0.0) * 255.0 / 205.0);
  
  return vec4<f32>(
    min(r, 1.0),
    min(g, 1.0),
    min(b, 1.0),
    1.0
  );
}

// Trace a single ray
fn traceRay(rayIndex: u32, pixelCoord: vec2<u32>) -> vec4<f32> {
  // Calculate view direction
  let aspect = uniforms.width / uniforms.height;
  let x = (f32(pixelCoord.x) / uniforms.width - 0.5) * uniforms.camera.tanFov;
  let y = ((-(f32(pixelCoord.y) / uniforms.height) + 0.5) * aspect) * uniforms.camera.tanFov;
  
  // Set up camera basis
  let front = normalize(uniforms.camera.lookAt - uniforms.camera.position);
  let left = normalize(cross3(uniforms.camera.up, front));
  let up = cross3(front, left);
  
  // Create a random seed based on pixel coordinates and frame count
  let seed = vec2<f32>(
    f32(pixelCoord.x) + 5 * uniforms.randomSeed + 7.0 * uniforms.frameCount,
    f32(pixelCoord.y) + 3 * uniforms.randomSeed + 11.0 * uniforms.frameCount
  );
  
  // Add a small random jitter to the ray direction (anti-aliasing)
  // The jitter amount decreases as the frame count increases to converge to the correct image
  let jitterScale = uniforms.jitterScale / (1.0 + uniforms.frameCount * 0.1);
  let jitter = randomInUnitDisk(seed) * jitterScale;
  
  // Apply jitter to the pixel coordinates
  let jitteredX = x + jitter.x * uniforms.camera.tanFov / uniforms.width;
  let jitteredY = y + jitter.y * uniforms.camera.tanFov * aspect / uniforms.height;
  
  // Transform view direction to world space with jitter
  let viewDir = normalize(left * jitteredX + up * jitteredY + front);
  
  // Initialize ray
  var ray: Ray;
  ray.origin = uniforms.camera.position;
  ray.direction = viewDir;
  setInitialConditions(&ray);
  
  // Initialize color
  var color = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  
  // Ray tracing loop
  let maxIterations = u32(uniforms.maxIterations);
  var stop = false;
  
  for (var iter = 0u; iter < maxIterations; iter++) {
    if (stop) {
      break;
    }
    
    let prevPoint = ray.origin;
    let prevSqrNorm = dot(prevPoint, prevPoint);
    
    // Apply equation to update ray
    let step = (length(ray.origin) / 30.0) * uniforms.blackHole.stepSize;
    applyEquation(&ray, step);
    
    let sqrNorm = dot(ray.origin, ray.origin);
    let spherical = toSpherical(ray.origin);
    let r = spherical.x;
    let theta = spherical.y;
    let phi = spherical.z;
    
    // Check if ray hit the event horizon
    if (sqrNorm < uniforms.horizonRadius * uniforms.horizonRadius && 
        prevSqrNorm > uniforms.horizonRadius * uniforms.horizonRadius) {
      
      // Calculate intersection point with the event horizon
      // This is a simplified binary search to find the exact intersection point
      var stepLow = 0.0;
      var stepHigh = step;
      var intersectionPoint = prevPoint;
      var tempVelocity = ray.direction;
      
      // Binary search for intersection point (simplified version)
      for (var i = 0u; i < 10u; i++) {
        let stepMid = (stepLow + stepHigh) / 2.0;
        intersectionPoint = prevPoint;
        tempVelocity = ray.direction;
        
        // Apply equation to find new point
        intersectionPoint += tempVelocity * stepMid;
        let r2 = dot(intersectionPoint, intersectionPoint);
        let accel = intersectionPoint * (uniforms.blackHole.potentialCoefficient * ray.h2 / pow(r2, 2.5));
        tempVelocity += accel * stepMid;
        
        let distance = length(intersectionPoint);
        
        if (distance < uniforms.horizonRadius) {
          stepHigh = stepMid;
        } else {
          stepLow = stepMid;
        }
      }
      
      // Check if intersection point is in the disk plane
      // The disk is in the XZ plane (y = 0)
      let diskY = intersectionPoint.y;
      
      // If the intersection point is close to the disk plane and within disk radius
      let diskSqrNorm = intersectionPoint.x * intersectionPoint.x + intersectionPoint.z * intersectionPoint.z;
      if (abs(diskY) < 0.1 && 
          diskSqrNorm >= uniforms.diskInnerRadius * uniforms.diskInnerRadius && 
          diskSqrNorm <= uniforms.diskOuterRadius * uniforms.diskOuterRadius) {
        // Ray hit the disk through the horizon
        let diskCoords = mapDiskCoords(sqrt(diskSqrNorm), atan2(intersectionPoint.z, intersectionPoint.x));
        // 標準的なサンプリング
        var diskColor = textureSampleLevel(diskTexture, diskSampler, diskCoords, 0.0);
        
        color = diskColor;
      } else {
        // Ray entered the event horizon (not through the disk)
        let blackColor = vec4<f32>(0.0, 0.0, 0.0, 1.0);
        color = addColor(blackColor, color);
      }
      
      stop = true;
      continue;
    }
    
    // Check if ray hit the disk
    var side = 0.0;
    if (prevPoint.y > 0.0) {
      side = -1.0;
    } else if (prevPoint.y < 0.0) {
      side = 1.0;
    }
    if (ray.origin.y * side >= 0.0) {
      // Ray crossed the horizontal plane
      // In a real implementation, we would do binary search to find exact intersection
      // For simplicity, we'll just use the current point
      
      let diskSqrNorm = ray.origin.x * ray.origin.x + ray.origin.z * ray.origin.z;
      if (diskSqrNorm >= uniforms.diskInnerRadius * uniforms.diskInnerRadius && 
          diskSqrNorm <= uniforms.diskOuterRadius * uniforms.diskOuterRadius) {
        // Ray hit the disk
        let diskCoords = mapDiskCoords(sqrt(diskSqrNorm), phi);
        var diskColor = textureSampleLevel(diskTexture, diskSampler, diskCoords, 0.0);   

        // mitigate seam
        let diskSeamLowerBound = 0.52;
        let diskSeamUpperBound = 0.99;
        let seamRange = (diskSeamUpperBound - diskSeamLowerBound) / 3;


        if (diskCoords.x > diskSeamLowerBound && diskCoords.x < diskSeamLowerBound + seamRange) {
          let sampleColor = textureSampleLevel(diskTexture, diskSampler, vec2<f32>(diskSeamLowerBound, diskCoords.y), 0.0);
          diskColor = mixColor(diskColor, sampleColor);
          diskColor = sampleColor;
        } else if (diskCoords.x > diskSeamLowerBound + seamRange && diskCoords.x < diskSeamLowerBound + 2 * seamRange) {
          let sampleColor1 = textureSampleLevel(diskTexture, diskSampler, vec2<f32>(diskSeamLowerBound, diskCoords.y), 0.0);
          let sampleColor2 = textureSampleLevel(diskTexture, diskSampler, vec2<f32>(diskSeamUpperBound, diskCoords.y), 0.0);
          let sampleColor = mixColor(sampleColor1, sampleColor2);
          diskColor = mixColor(diskColor, sampleColor);
          diskColor = sampleColor;
        } else if (diskCoords.x > diskSeamLowerBound + 2 * seamRange && diskCoords.x < diskSeamUpperBound) {
          let sampleColor = textureSampleLevel(diskTexture, diskSampler, vec2<f32>(diskSeamUpperBound, diskCoords.y), 0.0);
          diskColor = mixColor(diskColor, sampleColor);
          diskColor = sampleColor;
        }

        color = addColor(diskColor, color);


        // if (diskCoords.x > 0.49 && diskCoords.x < 0.5) {
        //     color = vec4<f32>(1.0, 0.0, 0.0, 1.0);
        // }
      }
    }
    
    // Check if ray escaped to infinity
    if (sqrNorm > uniforms.skyRadius * uniforms.skyRadius) {
      // Ray hit the sky
      let skyCoords = mapSkyCoords(theta, phi);
      let skyColor = textureSampleLevel(skyTexture, skySampler, skyCoords, 0.0);
      color = addColor(skyColor, color);
      stop = true;
      continue;
    }
  }
  

  
  return color;
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  // Check if within bounds
  if (global_id.x >= u32(uniforms.width) || global_id.y >= u32(uniforms.height)) {
    return;
  }
  
  // Calculate pixel index
  let pixelIndex = (global_id.y * u32(uniforms.width) + global_id.x) * 4u;
  
  // Trace ray
  var rayColor = traceRay(global_id.x + global_id.y * u32(uniforms.width), global_id.xy);
  
  // Blend with existing color
  if (uniforms.frameCount > 0.0) {
    // Get previous accumulated color from buffer
    let prevR = accumulationBuffer[pixelIndex];
    let prevG = accumulationBuffer[pixelIndex + 1u];
    let prevB = accumulationBuffer[pixelIndex + 2u];
    let prevA = accumulationBuffer[pixelIndex + 3u];
    
    // Calculate weight for blending
    var weight = uniforms.frameCount / (uniforms.frameCount + 1.0);
    // Blend colors
    var r = prevR * weight + rayColor.r * (1.0 - weight);
    var g = prevG * weight + rayColor.g * (1.0 - weight);
    var b = prevB * weight + rayColor.b * (1.0 - weight);
    var a = prevA * weight + rayColor.a * (1.0 - weight);
    // Store accumulated color in buffer
    accumulationBuffer[pixelIndex] = r;
    accumulationBuffer[pixelIndex + 1u] = g;
    accumulationBuffer[pixelIndex + 2u] = b;
    accumulationBuffer[pixelIndex + 3u] = a;
    
    // Store final color in output texture
    textureStore(outputTexture, global_id.xy, vec4<f32>(r, g, b, a));
  } else {
    // First frame, just store the ray color
    // rayColor = vec4<f32>(1.0, 0.0, 0.0, 1.0);
    accumulationBuffer[pixelIndex] = rayColor.r;
    accumulationBuffer[pixelIndex + 1u] = rayColor.g;
    accumulationBuffer[pixelIndex + 2u] = rayColor.b;
    accumulationBuffer[pixelIndex + 3u] = rayColor.a;
    
    // Store in output texture
    textureStore(outputTexture, global_id.xy, rayColor);
  }
}
`;

// Uniform buffer layout
interface RayTracerUniforms {
  // Camera
  cameraPosition: [number, number, number];
  _pad1: number;
  cameraLookAt: [number, number, number];
  _pad2: number;
  cameraUp: [number, number, number];
  fov: number;
  tanFov: number;
  _pad3: [number, number, number];

  // Black hole parameters
  potentialCoefficient: number;
  stepSize: number;
  _pad4: [number, number];

  // Render parameters
  width: number;
  height: number;
  frameCount: number;
  raysPerFrame: number;

  // Object parameters
  diskInnerRadius: number;
  diskOuterRadius: number;
  skyRadius: number;
  horizonRadius: number;
  
  // Jitter parameters
  randomSeed: number;
  maxIterations: number;
  jitterScale: number;
}

export class RayProcessor {
  private width: number;
  private height: number;
  private scene: Scene;
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private canvasFormat: string; // Store the canvas format

  // WebGPU resources
  private pipeline: GPUComputePipeline;
  private uniformBuffer: GPUBuffer;
  private uniformBindGroup: GPUBindGroup;
  private outputTexture: GPUTexture;
  private accumulationBuffer: GPUBuffer;
  private diskTexture: GPUTexture;
  private skyTexture: GPUTexture;
  private sampler: GPUSampler;

  // Rendering state
  private frameCount: number = 0;
  private maxIterations: number = 100000;
  private jitterScale: number = 20.0;

  constructor(
    width: number,
    height: number,
    scene: Scene,
    device: GPUDevice,
    context: GPUCanvasContext,
    canvasFormat: string = 'bgra8unorm' // Default to BGRA8Unorm if not provided
  ) {
    this.canvasFormat = canvasFormat;
    console.log("RayProcessor.constructor: Initializing RayProcessor");
    console.log("RayProcessor.constructor: Width:", width, "Height:", height);

    this.width = width;
    this.height = height;
    this.scene = scene;
    this.device = device;
    this.context = context;

    try {
      // Create compute pipeline
      console.log("RayProcessor.constructor: Creating compute pipeline");
      this.pipeline = this.createComputePipeline();

      // Create uniform buffer
      console.log("RayProcessor.constructor: Creating uniform buffer");
      this.uniformBuffer = this.createUniformBuffer();

      // Create textures and buffers
      console.log("RayProcessor.constructor: Creating output texture");
      this.outputTexture = this.createOutputTexture();

      console.log("RayProcessor.constructor: Creating accumulation buffer");
      this.accumulationBuffer = this.createAccumulationBuffer();

      console.log("RayProcessor.constructor: Creating disk texture");
      this.diskTexture = this.createDiskTexture();

      console.log("RayProcessor.constructor: Creating sky texture");
      this.skyTexture = this.createSkyTexture();

      // Create sampler
      console.log("RayProcessor.constructor: Creating sampler");
      this.sampler = this.createSampler();

      // Create bind group
      console.log("RayProcessor.constructor: Creating bind group");
      this.uniformBindGroup = this.createBindGroup();

      // Create render pipeline and resources
      console.log("RayProcessor.constructor: Creating render pipeline");
      this.renderPipeline = this.createRenderPipeline();
      
      console.log("RayProcessor.constructor: Creating vertex buffer");
      this.vertexBuffer = this.createVertexBuffer();
      
      console.log("RayProcessor.constructor: Creating render bind group");
      this.renderBindGroup = this.createRenderBindGroup();

      console.log("RayProcessor.constructor: Initialization complete");
    } catch (error: any) {
      console.error("RayProcessor.constructor: Error during initialization:", error);
      console.error("Error message:", error.message || "No error message");
      console.error("Error stack:", error.stack || "No stack trace");

      // Log all properties of the error object
      console.error('Error object properties:');
      for (const prop in error) {
        console.error(`- ${prop}:`, error[prop]);
      }

      throw error;
    }
  }

  // Create compute pipeline
  private createComputePipeline(): GPUComputePipeline {
    const shaderModule = this.device.createShaderModule({
      code: rayTracingShader,
      label: "Ray Tracing Shader"
    });

    return this.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint: 'main'
      },
      label: "Ray Tracing Pipeline"
    });
  }

  // Create uniform buffer 
  private createUniformBuffer(): GPUBuffer {

    const directUsage = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;

    try {
      const buffer = this.device.createBuffer({
        size: 256, // Aligned size for the uniform buffer
        usage: directUsage,
        label: "Uniform Buffer (Direct)"
      });
      return buffer;
    } catch (error: any) {
      console.error("========================================");
      console.error("RayProcessor.createUniformBuffer: Buffer creation error");
      console.error("========================================");
      throw error;
    }
  }

  // Create output texture - always use RGBA8Unorm for storage binding
  private createOutputTexture(): GPUTexture {
    console.log("RayProcessor.createOutputTexture: Creating texture with format: rgba8unorm");
    return this.device.createTexture({
      size: [this.width, this.height],
      format: 'rgba8unorm', // Must use RGBA8Unorm for storage binding
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING,
      label: "Output Texture"
    });
  }

  private createAccumulationBuffer(): GPUBuffer {


    const directUsage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;

    try {
      const buffer = this.device.createBuffer({
        size: this.width * this.height * 4 * 4, // 4 floats per pixel (RGBA)
        usage: directUsage,
        label: "Accumulation Buffer (Direct)"
      });
      return buffer;
    } catch (error: any) {
      console.error("========================================");
      console.error("RayProcessor.createAccumulationBuffer: Buffer creation error");
      console.error("========================================");
      throw error;
    }
  }

  // Create disk texture
  private createDiskTexture(): GPUTexture {
    // Create a 1x1 white texture as a placeholder
    const data = new Uint8Array([255, 255, 255, 255]);

    const texture = this.device.createTexture({
      size: [1, 1],
      format: this.canvasFormat, // Use the same format as the canvas
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      label: "Disk Texture"
    });

    this.device.queue.writeTexture(
      { texture },
      data,
      { bytesPerRow: 4 },
      [1, 1]
    );

    return texture;
  }

  // Create sky texture
  private createSkyTexture(): GPUTexture {
    // Create a 1x1 blue texture as a placeholder
    const data = new Uint8Array([0, 0, 255, 255]);

    const texture = this.device.createTexture({
      size: [1, 1],
      format: this.canvasFormat, // Use the same format as the canvas
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      label: "Sky Texture"
    });

    this.device.queue.writeTexture(
      { texture },
      data,
      { bytesPerRow: 4 },
      [1, 1]
    );

    return texture;
  }

  // Create sampler
  private createSampler(): GPUSampler {
    return this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'mirror-repeat', 
      addressModeV: 'mirror-repeat', 
      mipmapFilter: 'linear',        
      maxAnisotropy: 16,
      label: "Texture Sampler"
    });
  }

  // Create bind group
  private createBindGroup(): GPUBindGroup {
    console.log("RayProcessor.createBindGroup: Creating bind group");
    return this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      label: "Ray Tracing Bind Group",
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer }
        },
        {
          binding: 1,
          resource: this.outputTexture.createView()
        },
        {
          binding: 2,
          resource: this.diskTexture.createView()
        },
        {
          binding: 3,
          resource: this.skyTexture.createView()
        },
        {
          binding: 4,
          resource: this.sampler
        },
        {
          binding: 5,
          resource: this.sampler
        },
        {
          binding: 6,
          resource: { buffer: this.accumulationBuffer }
        }
      ]
    });
  }

  // Update uniform buffer with current scene parameters
  private updateUniforms(raysPerFrame: number): void {
    // Calculate tan(fov)
    const fovRadians = (this.scene.fov * Math.PI) / 180;
    const tanFov = Math.tan(fovRadians / 2);

    // Find disk parameters
    let diskInnerRadius = 2.6;
    let diskOuterRadius = 12.0;
    const disk = this.scene.hitables.find(h => h.constructor.name === 'TexturedDisk' || h.constructor.name === 'Disk');
    if (disk) {
      // In a real implementation, we would get the parameters from the disk
      // For now, we'll use default values
    }

    // Find sky parameters
    let skyRadius = 30.0;
    const sky = this.scene.hitables.find(h => h.constructor.name === 'Sky');
    if (sky) {
      // In a real implementation, we would get the parameters from the sky
      // For now, we'll use default values
    }

    // Generate a random seed for this frame
    const randomSeed = Math.random() * 1000;

    // Create uniform data
    const uniformData = new Float32Array([
      // Camera position
      this.scene.cameraPosition.x, this.scene.cameraPosition.y, this.scene.cameraPosition.z, 0,
      // Camera look at
      this.scene.cameraLookAt.x, this.scene.cameraLookAt.y, this.scene.cameraLookAt.z, 0,
      // Camera up
      this.scene.upVector.x, this.scene.upVector.y, this.scene.upVector.z, 0,
      // Camera fov and tanFov
      fovRadians, tanFov, 0, 0,

      // Black hole parameters
      this.scene.schwarzschildEquation.potentialCoefficient,
      this.scene.schwarzschildEquation.stepSize,
      0, 0,

      // Render parameters
      this.width, this.height, this.frameCount, raysPerFrame,

      // Object parameters
      diskInnerRadius, diskOuterRadius, skyRadius, 2.0, // Horizon radius is 2.0
      
      // Jitter parameters
      randomSeed, this.maxIterations, this.jitterScale
    ]);

    console.log("RayProcessor.updateUniforms packed Parameters: ", uniformData);

    // Update uniform buffer
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
  }

  // Render pipeline for displaying the output texture on the canvas
  private renderPipeline!: GPURenderPipeline;
  private renderBindGroup!: GPUBindGroup;
  private vertexBuffer!: GPUBuffer;

  // Create render pipeline for displaying the output texture
  private createRenderPipeline(): GPURenderPipeline {
    // Vertex shader for a full-screen quad
    const vertexShaderCode = `
      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) texCoord: vec2<f32>,
      }

      @vertex
      fn main(@location(0) position: vec2<f32>, @location(1) texCoord: vec2<f32>) -> VertexOutput {
        var output: VertexOutput;
        output.position = vec4<f32>(position, 0.0, 1.0);
        output.texCoord = texCoord;
        return output;
      }
    `;

    // Fragment shader for sampling the texture
    const fragmentShaderCode = `
      @group(0) @binding(0) var texSampler: sampler;
      @group(0) @binding(1) var tex: texture_2d<f32>;

      @fragment
      fn main(@location(0) texCoord: vec2<f32>) -> @location(0) vec4<f32> {
        return textureSample(tex, texSampler, texCoord);
      }
    `;

    // Create shader modules
    const vertexShaderModule = this.device.createShaderModule({
      code: vertexShaderCode,
      label: "Vertex Shader"
    });

    const fragmentShaderModule = this.device.createShaderModule({
      code: fragmentShaderCode,
      label: "Fragment Shader"
    });

    // Create pipeline layout
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [
        this.device.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.FRAGMENT,
              sampler: {}
            },
            {
              binding: 1,
              visibility: GPUShaderStage.FRAGMENT,
              texture: {}
            }
          ],
          label: "Render Bind Group Layout"
        })
      ],
      label: "Render Pipeline Layout"
    });

    // Create render pipeline
    return this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: vertexShaderModule,
        entryPoint: "main",
        buffers: [
          {
            arrayStride: 4 * 4, // 4 floats per vertex (2 for position, 2 for texCoord)
            attributes: [
              {
                // position
                shaderLocation: 0,
                offset: 0,
                format: "float32x2"
              },
              {
                // texCoord
                shaderLocation: 1,
                offset: 2 * 4, // 2 floats (8 bytes) for position
                format: "float32x2"
              }
            ]
          }
        ]
      },
      fragment: {
        module: fragmentShaderModule,
        entryPoint: "main",
        targets: [
          {
            format: this.canvasFormat as GPUTextureFormat
          }
        ]
      },
      primitive: {
        topology: "triangle-list"
      },
      label: "Render Pipeline"
    });
  }

  // Create vertex buffer for a full-screen quad
  private createVertexBuffer(): GPUBuffer {
    // Define a full-screen quad with texture coordinates
    const vertices = new Float32Array([
      // position (x, y), texCoord (u, v)
      -1.0, -1.0, 0.0, 1.0, // bottom-left
       1.0, -1.0, 1.0, 1.0, // bottom-right
      -1.0,  1.0, 0.0, 0.0, // top-left
      -1.0,  1.0, 0.0, 0.0, // top-left (repeated)
       1.0, -1.0, 1.0, 1.0, // bottom-right (repeated)
       1.0,  1.0, 1.0, 0.0  // top-right
    ]);

    // Create buffer with mappedAtCreation
    const buffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
      label: "Vertex Buffer"
    });
    
    // Copy data to buffer
    new Float32Array(buffer.getMappedRange()).set(vertices);
    buffer.unmap();
    
    return buffer;
  }

  // Create bind group for rendering
  private createRenderBindGroup(): GPUBindGroup {
    // ログ出力: outputTextureのlabelとusage
    console.log("Output Texture Label:", this.outputTexture.label);
    console.log("Output Texture Usage:", this.outputTexture.usage);

    return this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: this.sampler
        },
        {
          binding: 1,
          resource: this.outputTexture.createView()
        }
      ],
      label: "Render Bind Group"
    });
  }

  // Process a frame
  processFrame(raysPerFrame: number): number {
    // Update uniforms
    this.updateUniforms(raysPerFrame);

    // Create command encoder
    const commandEncoder = this.device.createCommandEncoder({
      label: "Ray Tracing Command Encoder"
    });

    // Create compute pass
    const computePass = commandEncoder.beginComputePass({
      label: "Ray Tracing Compute Pass"
    });

    computePass.setPipeline(this.pipeline);
    computePass.setBindGroup(0, this.uniformBindGroup);

    // Dispatch compute shader
    console.log("Dispatching compute shader with workgroup size: 16x16");
    const workgroupCountX = Math.ceil(this.width / 16);
    const workgroupCountY = Math.ceil(this.height / 16);
    computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY);
    computePass.end();

    // Render the output texture to the canvas
    console.log("Rendering output texture to canvas");
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    };

    // Begin render pass
    const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.renderBindGroup);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.draw(6); // 6 vertices for 2 triangles
    renderPass.end();

    // Submit commands
    console.log("Submitting command encoder");
    this.device.queue.submit([commandEncoder.finish()]);
    
    // Increment frame count
    this.frameCount++;
    console.log("Frame count:", this.frameCount);

    // Return number of rays processed
    return this.width * this.height;
  }

  // Resize the output texture
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    // Recreate output texture
    console.log("this.outputTexture destroy: ", this.outputTexture.label);
    this.outputTexture.destroy();
    this.outputTexture = this.createOutputTexture();

    // Recreate accumulation buffer
    this.accumulationBuffer.destroy();
    this.accumulationBuffer = this.createAccumulationBuffer();

    // Recreate bind group
    this.uniformBindGroup = this.createBindGroup();
    this.renderBindGroup = this.createRenderBindGroup();

    // Reset frame count
    this.frameCount = 0;
  }

  // Reset the rendering
  reset(): void {
    this.frameCount = 0;
  }

  // Set a new scene
  setScene(scene: Scene): void {
    this.scene = scene;
    this.reset();
  }

  // Load disk texture from image
  async loadDiskTexture(imageUrl: string): Promise<void> {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob);
    
    const width = imageBitmap.width;
    const height = imageBitmap.height;

    const canvas = new OffscreenCanvas(2 * width, 2 * height);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error("Failed to get 2D context for canvas");
    }
    // Draw horizontally flipped image (top-right)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(imageBitmap, -2 * width, 0);
    ctx.restore();

    // Draw vertically flipped image (bottom-left)
    ctx.save();
    ctx.scale(1, -1);
    ctx.drawImage(imageBitmap, 0, -2 * height);
    ctx.restore();

    // Draw both horizontally and vertically flipped image (bottom-right)
    ctx.save();
    ctx.scale(-1, -1);
    ctx.drawImage(imageBitmap, -2 * width, -2 * height);
    ctx.restore();

    // Convert to new ImageBitmap
    const newImageBitmap = await createImageBitmap(canvas);

    // Create new texture
    const texture = this.device.createTexture({
      size: [newImageBitmap.width, newImageBitmap.height],
      format: this.canvasFormat, // Use the same format as the canvas
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      label: "Disk Texture (Loaded)"
    });

    // Copy image data to texture
    this.device.queue.copyExternalImageToTexture(
      { source: newImageBitmap },
      { texture },
      [newImageBitmap.width, newImageBitmap.height]
    );

    // Destroy old texture
    this.diskTexture.destroy();

    // Set new texture
    this.diskTexture = texture;

    // Recreate bind group
    this.uniformBindGroup = this.createBindGroup();

    // Reset rendering
    this.reset();
  }

  // Load sky texture from image
  async loadSkyTexture(imageUrl: string): Promise<void> {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob);

    // Create new texture
    const texture = this.device.createTexture({
      size: [imageBitmap.width, imageBitmap.height],
      format: this.canvasFormat, // Use the same format as the canvas
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      label: "Sky Texture (Loaded)"
    });

    // Copy image data to texture
    this.device.queue.copyExternalImageToTexture(
      { source: imageBitmap },
      { texture },
      [imageBitmap.width, imageBitmap.height]
    );

    // Destroy old texture
    console.log("this.skyTexture destroy", this.skyTexture.label);
    this.skyTexture.destroy();

    // Set new texture
    this.skyTexture = texture;

    // Recreate bind group
    this.uniformBindGroup = this.createBindGroup();

    // Reset rendering
    this.reset();
  }

  // Get current frame count
  getFrameCount(): number {
    return this.frameCount;
  }
  
  // Set maximum iterations for ray tracing
  setMaxIterations(iterations: number): void {
    this.maxIterations = iterations;
    console.log("Set max iterations to", iterations);
  }
  
  // Set jitter scale for ray tracing
  setJitterScale(scale: number): void {
    this.jitterScale = scale;
    console.log("Set jitter scale to", scale);
  }

  // Get image data for download 
  getImageData(): Promise<ImageData> {
    const directUsage = GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST;
  
    try {
      // Create a temporary buffer to read the pixel data
      const readBuffer = this.device.createBuffer({
        size: this.width * this.height * 4,
        usage: directUsage,
        label: "Image Download Buffer (Direct)"
      });
  
      // Create a command encoder
      const commandEncoder = this.device.createCommandEncoder({
        label: "Image Download Command Encoder"
      });
  
      // Copy texture to buffer
      commandEncoder.copyTextureToBuffer(
        { texture: this.outputTexture },
        { buffer: readBuffer, bytesPerRow: this.width * 4 },
        [this.width, this.height]
      );
  
      // Submit commands
      this.device.queue.submit([commandEncoder.finish()]);
  
      // Map the buffer and create an ImageData
      return new Promise<ImageData>((resolve) => {
        readBuffer.mapAsync(GPUMapMode.READ).then(() => {
          // Create a copy of the mapped range data to avoid detached buffer issues
          const mappedRange = readBuffer.getMappedRange();
          const data = new Uint8ClampedArray(mappedRange.slice(0));
          const imageData = new ImageData(data, this.width, this.height);
          
          // Unmap and destroy the buffer
          readBuffer.unmap();
          readBuffer.destroy();
          
          resolve(imageData);
        });
      });
    } catch (error: any) {
      console.error("========================================");
      console.error("RayProcessor.getImageData: Error during image data download");
      console.error("========================================");
      console.error("Error message:", error.message || "No error message");
      console.error("Error stack:", error.stack || "No stack trace");
      throw error;
    }
  }
  
}
