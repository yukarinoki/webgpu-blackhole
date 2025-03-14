import { Scene } from './Scene';
import { Vector3D } from './models/Vector3D';
import { SchwarzschildBlackHoleEquation } from './physics/SchwarzschildBlackHoleEquation';
import { RayProcessor } from './RayProcessor';
import { IHitable } from './hitables/IHitable';
import { TexturedDisk } from './hitables/TexturedDisk';
import { Horizon } from './hitables/Horizon';
import { Sky } from './hitables/Sky';

export class App {
  private canvas: HTMLCanvasElement;
  private scene: Scene;
  private rayProcessor: RayProcessor | null = null;

  // UI elements
  private fpsCounter!: HTMLElement;
  private raysCounter!: HTMLElement;
  private startStopButton!: HTMLButtonElement;
  private frameByFrameButton!: HTMLButtonElement;
  private downloadButton!: HTMLButtonElement;
  private diskImageInput!: HTMLInputElement;
  private skyImageInput!: HTMLInputElement;

  // Rendering state
  private isRendering: boolean = false;
  private isFrameByFrame: boolean = false;
  private totalRaysProcessed: number = 0;
  private lastFrameTime: number = 0;
  private raysPerFrame: number = 1000;
  private proccessedFrame: number = 0;

  // Parameters
  private potentialCoefficientSlider!: HTMLInputElement;
  private stepSizeSlider!: HTMLInputElement;
  private fovSlider!: HTMLInputElement;
  private qualitySlider!: HTMLInputElement;
  
  // Camera controls
  private cameraDistanceSlider!: HTMLInputElement;
  private cameraAngleHorzSlider!: HTMLInputElement;
  private cameraAngleVertSlider!: HTMLInputElement;

  constructor() {
    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = 2048;
    this.canvas.height = 2048;
    document.body.appendChild(this.canvas);

    // Create UI elements
    this.createUI();

    // Create scene with parameters from the original C++ implementation
    const cameraPosition = new Vector3D(0, 3, -20); // Changed from (0, 0, -15)
    const cameraLookAt = new Vector3D(0, 0, 0);
    const upVector = new Vector3D(-0.3, 1, 0); // Changed from (0, 1, 0)
    const fov = 80.0;
    const hitables: IHitable[] = []; // Will add objects after loading textures
    const curvatureCoefficient = -1.5; // Changed from 1.0 to match C++ implementation

    this.scene = new Scene(
      cameraPosition,
      cameraLookAt,
      upVector,
      fov,
      hitables,
      curvatureCoefficient
    );

    // Set step size for the equation
    this.scene.schwarzschildEquation.stepSize = 0.16;

    // Update camera control sliders with initial values
    this.updateCameraControlSliders();
    
    // Initialize WebGPU
    this.initWebGPU();
  }

  // Helper method to load an image
  private async loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  private createUI(): void {
    // Create container
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '10px';
    container.style.left = '10px';
    container.style.padding = '10px';
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    container.style.color = 'white';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.borderRadius = '5px';
    document.body.appendChild(container);

    // Create FPS counter
    const fpsContainer = document.createElement('div');
    fpsContainer.textContent = 'FPS: ';
    this.fpsCounter = document.createElement('span');
    this.fpsCounter.textContent = '0';
    fpsContainer.appendChild(this.fpsCounter);
    container.appendChild(fpsContainer);

    // Create rays counter
    const raysContainer = document.createElement('div');
    raysContainer.textContent = 'Rays: ';
    this.raysCounter = document.createElement('span');
    this.raysCounter.textContent = '0';
    raysContainer.appendChild(this.raysCounter);
    container.appendChild(raysContainer);

    // Create parameter sliders
    container.appendChild(document.createElement('hr'));

    // Potential coefficient slider
    const potentialCoefficientContainer = document.createElement('div');
    potentialCoefficientContainer.textContent = 'Potential Coefficient: ';
    this.potentialCoefficientSlider = document.createElement('input');
    this.potentialCoefficientSlider.type = 'range';
    this.potentialCoefficientSlider.min = '-5.0';
    this.potentialCoefficientSlider.max = '5.0';
    this.potentialCoefficientSlider.step = '0.1';
    this.potentialCoefficientSlider.value = '-1.5';
    this.potentialCoefficientSlider.addEventListener('input', () => this.updateParameters());
    potentialCoefficientContainer.appendChild(this.potentialCoefficientSlider);
    container.appendChild(potentialCoefficientContainer);

    // Step size slider
    const stepSizeContainer = document.createElement('div');
    stepSizeContainer.textContent = 'Step Size: ';
    this.stepSizeSlider = document.createElement('input');
    this.stepSizeSlider.type = 'range';
    this.stepSizeSlider.min = '0.01';
    this.stepSizeSlider.max = '0.20';
    this.stepSizeSlider.step = '0.01';
    this.stepSizeSlider.value = '0.05';
    this.stepSizeSlider.addEventListener('input', () => this.updateParameters());
    stepSizeContainer.appendChild(this.stepSizeSlider);
    container.appendChild(stepSizeContainer);

    // FOV slider
    const fovContainer = document.createElement('div');
    fovContainer.textContent = 'FOV: ';
    this.fovSlider = document.createElement('input');
    this.fovSlider.type = 'range';
    this.fovSlider.min = '30';
    this.fovSlider.max = '150';
    this.fovSlider.step = '1';
    this.fovSlider.value = '80';
    this.fovSlider.addEventListener('input', () => this.updateParameters());
    fovContainer.appendChild(this.fovSlider);
    container.appendChild(fovContainer);

    // Quality slider
    const qualityContainer = document.createElement('div');
    qualityContainer.textContent = 'Image Quality: ';
    this.qualitySlider = document.createElement('input');
    this.qualitySlider.type = 'range';
    this.qualitySlider.min = '1';
    this.qualitySlider.max = '20';
    this.qualitySlider.step = '1';
    this.qualitySlider.value = '5';
    
    // Add quality level label
    const qualityLabel = document.createElement('span');
    qualityLabel.textContent = ' (Medium)';
    qualityLabel.id = 'quality-label';
    
    // Update quality label when slider changes
    this.qualitySlider.addEventListener('input', () => {
      const value = parseInt(this.qualitySlider.value);
      let qualityText = '';
      if (value <= 2) qualityText = ' (Very Low)';
      else if (value <= 4) qualityText = ' (Low)';
      else if (value <= 6) qualityText = ' (Medium)';
      else if (value <= 8) qualityText = ' (High)';
      else if (value <= 15) qualityText = ' (Very High)';
      else qualityText = ' (Ultra)';

      
      document.getElementById('quality-label')!.textContent = qualityText;
      this.updateParameters();
    });
    
    qualityContainer.appendChild(this.qualitySlider);
    qualityContainer.appendChild(qualityLabel);
    container.appendChild(qualityContainer);

    // Camera controls
    container.appendChild(document.createElement('hr'));
    container.appendChild(document.createElement('h4')).textContent = 'Camera Controls';

    // Camera distance slider
    const cameraDistanceContainer = document.createElement('div');
    cameraDistanceContainer.textContent = 'Camera Distance: ';
    this.cameraDistanceSlider = document.createElement('input');
    this.cameraDistanceSlider.type = 'range';
    this.cameraDistanceSlider.min = '5';
    this.cameraDistanceSlider.max = '50';
    this.cameraDistanceSlider.step = '1';
    this.cameraDistanceSlider.value = String(this.scene?.cameraDistance || 20);
    this.cameraDistanceSlider.addEventListener('input', () => this.updateCameraPosition());
    cameraDistanceContainer.appendChild(this.cameraDistanceSlider);
    container.appendChild(cameraDistanceContainer);

    // Camera horizontal angle slider
    const cameraAngleHorzContainer = document.createElement('div');
    cameraAngleHorzContainer.textContent = 'Horizontal Angle: ';
    this.cameraAngleHorzSlider = document.createElement('input');
    this.cameraAngleHorzSlider.type = 'range';
    this.cameraAngleHorzSlider.min = '0';
    this.cameraAngleHorzSlider.max = String(2 * Math.PI);
    this.cameraAngleHorzSlider.step = '0.01';
    this.cameraAngleHorzSlider.value = String(this.scene?.cameraAngleHorz || 0);
    this.cameraAngleHorzSlider.addEventListener('input', () => this.updateCameraPosition());
    cameraAngleHorzContainer.appendChild(this.cameraAngleHorzSlider);
    container.appendChild(cameraAngleHorzContainer);

    // Camera vertical angle slider
    const cameraAngleVertContainer = document.createElement('div');
    cameraAngleVertContainer.textContent = 'Vertical Angle: ';
    this.cameraAngleVertSlider = document.createElement('input');
    this.cameraAngleVertSlider.type = 'range';
    this.cameraAngleVertSlider.min = '0.1';
    this.cameraAngleVertSlider.max = String(Math.PI - 0.1);
    this.cameraAngleVertSlider.step = '0.01';
    this.cameraAngleVertSlider.value = String(this.scene?.cameraAngleVert || Math.PI / 2);
    this.cameraAngleVertSlider.addEventListener('input', () => this.updateCameraPosition());
    cameraAngleVertContainer.appendChild(this.cameraAngleVertSlider);
    container.appendChild(cameraAngleVertContainer);

    // Create image upload controls
    container.appendChild(document.createElement('hr'));

    // Disk image upload
    const diskImageContainer = document.createElement('div');
    diskImageContainer.textContent = 'Disk Image: ';
    this.diskImageInput = document.createElement('input');
    this.diskImageInput.type = 'file';
    this.diskImageInput.accept = 'image/*';
    this.diskImageInput.addEventListener('change', () => this.handleDiskImageUpload());
    diskImageContainer.appendChild(this.diskImageInput);
    container.appendChild(diskImageContainer);

    // Sky image upload
    const skyImageContainer = document.createElement('div');
    skyImageContainer.textContent = 'Sky Image: ';
    this.skyImageInput = document.createElement('input');
    this.skyImageInput.type = 'file';
    this.skyImageInput.accept = 'image/*';
    this.skyImageInput.addEventListener('change', () => this.handleSkyImageUpload());
    skyImageContainer.appendChild(this.skyImageInput);
    container.appendChild(skyImageContainer);

    // Create buttons
    container.appendChild(document.createElement('hr'));

    // Start/Stop button
    this.startStopButton = document.createElement('button');
    this.startStopButton.textContent = 'Start';
    this.startStopButton.addEventListener('click', () => this.toggleRendering());
    container.appendChild(this.startStopButton);

    this.frameByFrameButton = document.createElement('button');
    this.frameByFrameButton.textContent = 'Automatic';
    this.frameByFrameButton.addEventListener('click', () => this.toggleFrameByFrame());
    container.appendChild(this.frameByFrameButton);

    // Download button
    this.downloadButton = document.createElement('button');
    this.downloadButton.textContent = 'Download';
    this.downloadButton.disabled = true;
    this.downloadButton.addEventListener('click', () => this.downloadImage());
    container.appendChild(this.downloadButton);
  }

  private async initWebGPU(): Promise<void> {
    console.log("App.initWebGPU: Starting WebGPU initialization");

    if (!navigator.gpu) {
      console.error("App.initWebGPU: WebGPU is not supported in this browser");
      alert('WebGPU is not supported in your browser');
      return;
    }

    try {
      // Get GPU adapter with more detailed logging
      console.log("App.initWebGPU: Requesting adapter...");
      const adapter = await navigator.gpu.requestAdapter();

      if (!adapter) {
        console.error("App.initWebGPU: No GPU adapter found");
        throw new Error('No GPU adapter found');
      }

      console.log("App.initWebGPU: Adapter found");

      // Get GPU device with more detailed logging
      console.log("App.initWebGPU: Requesting device...");
      const device = await adapter.requestDevice();
      console.log("App.initWebGPU: Device created successfully");

      // Set up error handling with more details
      device.addEventListener('uncapturederror', (event) => {
        console.error('WebGPU device error:', event.error);
        console.error('Error message:', event.error.message);
        // Try to access stack if available (may not be on all implementations)
        const errorAny = event.error as any;
        if (errorAny.stack) {
          console.error('Error stack:', errorAny.stack);
        }
      });

      // Configure canvas
      console.log("App.initWebGPU: Configuring canvas...");
      const context = this.canvas.getContext('webgpu') as GPUCanvasContext;
      const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format: presentationFormat,
        alphaMode: 'premultiplied'
      });

      console.log("App.initWebGPU: Canvas configured with format", presentationFormat);
      // Create ray processor with the preferred canvas format
      // Use fixed size of 1280x720 to match the C++ implementation
      this.canvas.width = 2048;
      this.canvas.height = 2048;
      this.rayProcessor = new RayProcessor(
        this.canvas.width,
        this.canvas.height,
        this.scene,
        device,
        context,
        presentationFormat // Pass the preferred canvas format
      );

      // Load default textures
      await this.rayProcessor.loadDiskTexture('/public/cosmic_sky.jpg');
      await this.rayProcessor.loadSkyTexture('/public/sky.jpg');

      // Load images for creating scene objects
      console.log("App.initWebGPU: Loading images for scene objects");
      const diskTexture = await this.loadImage('/public/cosmic_sky.jpg');
      const skyTexture = await this.loadImage('/public/sky.jpg');
      
      // Add objects to the scene (similar to the original C++ implementation)
      console.log("App.initWebGPU: Adding objects to the scene");
      
      // Add TexturedDisk (inner radius 2.6, outer radius 12.0)
      const texturedDisk = new TexturedDisk(2.6, 12.0, diskTexture);
      this.scene.hitables.push(texturedDisk);
      
      // Add Horizon
      const horizon = new Horizon();
      this.scene.hitables.push(horizon);
      
      // Add Sky (radius 30.0)
      const sky = new Sky(skyTexture, 30.0);
      sky.setTextureOffset(Math.PI / 2); // Set texture offset like in C++ implementation
      this.scene.hitables.push(sky);
      
      // Update the scene in the ray processor
      this.rayProcessor.setScene(this.scene);
      console.log("App.initWebGPU: Scene objects added");
      
      this.rayProcessor.loadDiskTexture('/public/cosmic_sky.jpg');
      
      // Initialize in stopped state (don't start rendering automatically)
      this.startStopButton.textContent = 'Start';
      this.downloadButton.disabled = false;

      // Handle window resize
      window.addEventListener('resize', () => this.handleResize());

      // Initial resize
      this.handleResize();
    } catch (error: any) {
      console.error('App.initWebGPU: Error initializing WebGPU:', error);
      console.error('Error message:', error.message || "No error message");
      console.error('Error stack:', error.stack || "No stack trace");

      // Log all properties of the error object
      console.error('Error object properties:');
      for (const prop in error) {
        console.error(`- ${prop}:`, error[prop]);
      }

      alert(`Error initializing WebGPU: ${error}`);
    }
  }

  private handleResize(): void {
    // Get container size
    const width = 2048; //window.innerWidth;
    const height = 2048; //window.innerHeight;

    // Resize canvas
    this.canvas.width = width;
    this.canvas.height = height;

    // Resize ray processor
    if (this.rayProcessor) {
      console.log("Resizing ray processor to", width, "x", height);
      this.rayProcessor.resize(width, height);
    }
  }

  private updateParameters(): void {
    // Stop rendering
    const wasRendering = this.isRendering;
    if (wasRendering) {
      this.isRendering = false;
    }

    // Update scene parameters
    this.scene.schwarzschildEquation.potentialCoefficient = parseFloat(this.potentialCoefficientSlider.value);
    this.scene.schwarzschildEquation.stepSize = parseFloat(this.stepSizeSlider.value);
    this.scene.fov = parseFloat(this.fovSlider.value);
    
    // Update quality settings
    const qualityValue = parseInt(this.qualitySlider.value);
    
    // Adjust rays per frame based on quality
    // Higher quality = more rays per frame
    this.raysPerFrame = 500 + qualityValue * 500; // 1000 to 5500 rays per frame
    
    // Set max iterations based on quality
    if (this.rayProcessor) {
      this.rayProcessor.setMaxIterations(20000 + qualityValue * 5000); // 6000 to 15000 iterations
      this.rayProcessor.setJitterScale(20.0); // 0.95 to 0.5
    }

    // Reset ray processor
    if (this.rayProcessor) {
      this.rayProcessor.reset();
    }

    // Update UI
    this.totalRaysProcessed = 0;
    this.raysCounter.textContent = '0';
    this.downloadButton.disabled = true;

    // Resume rendering if it was active
    if (wasRendering) {
      this.isRendering = true;
      this.render();
    }
  }

  private updateCameraControlSliders(): void {
    // Update camera control sliders with values from the scene
    if (this.scene) {
      this.cameraDistanceSlider.value = String(this.scene.cameraDistance);
      this.cameraAngleHorzSlider.value = String(this.scene.cameraAngleHorz);
      this.cameraAngleVertSlider.value = String(this.scene.cameraAngleVert);
    }
  }

  private updateCameraPosition(): void {
    // Stop rendering
    const wasRendering = this.isRendering;
    if (wasRendering) {
      this.isRendering = false;
    }

    // Update camera parameters
    this.scene.cameraDistance = parseFloat(this.cameraDistanceSlider.value);
    this.scene.cameraAngleHorz = parseFloat(this.cameraAngleHorzSlider.value);
    this.scene.cameraAngleVert = parseFloat(this.cameraAngleVertSlider.value);
    
    // Update camera position from spherical coordinates
    this.scene.updateCameraFromSpherical();
    
    // Reset ray processor
    if (this.rayProcessor) {
      this.rayProcessor.reset();
    }

    // Update UI
    this.totalRaysProcessed = 0;
    this.raysCounter.textContent = '0';
    this.downloadButton.disabled = true;

    // Resume rendering if it was active
    if (wasRendering) {
      this.isRendering = true;
      this.render();
    }
  }

  private async handleDiskImageUpload(): Promise<void> {
    if (!this.diskImageInput.files || !this.diskImageInput.files[0] || !this.rayProcessor) {
      return;
    }

    // Stop rendering
    const wasRendering = this.isRendering;
    if (wasRendering) {
      this.isRendering = false;
    }

    // Get file
    const file = this.diskImageInput.files[0];

    // Create URL
    const url = URL.createObjectURL(file);

    // Load texture
    await this.rayProcessor.loadDiskTexture(url);

    // Clean up
    URL.revokeObjectURL(url);

    // Reset ray processor
    this.rayProcessor.reset();

    // Update UI
    this.totalRaysProcessed = 0;
    this.raysCounter.textContent = '0';
    this.downloadButton.disabled = true;

    // Resume rendering if it was active
    if (wasRendering) {
      this.isRendering = true;
      this.render();
    }
  }

  private async handleSkyImageUpload(): Promise<void> {
    if (!this.skyImageInput.files || !this.skyImageInput.files[0] || !this.rayProcessor) {
      return;
    }

    // Stop rendering
    const wasRendering = this.isRendering;
    if (wasRendering) {
      this.isRendering = false;
    }

    // Get file
    const file = this.skyImageInput.files[0];

    // Create URL
    const url = URL.createObjectURL(file);

    // Load texture
    await this.rayProcessor.loadSkyTexture(url);

    // Clean up
    URL.revokeObjectURL(url);

    // Reset ray processor
    this.rayProcessor.reset();

    // Update UI
    this.totalRaysProcessed = 0;
    this.raysCounter.textContent = '0';
    this.downloadButton.disabled = true;

    // Resume rendering if it was active
    if (wasRendering) {
      this.isRendering = true;
      this.render();
    }
  }
  private toggleFrameByFrame(): void {
    this.isFrameByFrame = !this.isFrameByFrame;
    if (this.isFrameByFrame) {
      this.frameByFrameButton.textContent = 'Frame-by-Frame';
    }
    else {
      this.frameByFrameButton.textContent = 'Automatic';
    }
  }


  private toggleRendering(): void {
    this.isRendering = !this.isRendering;

    if (this.isRendering) {
      // Start rendering
      this.startStopButton.textContent = 'Stop';
      this.downloadButton.disabled = true;
      this.render();
      if (this.isFrameByFrame) {
        this.toggleRendering();
      }
    } else {
      // Stop rendering
      this.startStopButton.textContent = 'Start';
      this.downloadButton.disabled = false;
    }
  }

  private render(timestamp: number = 0): void {
    if (!this.isRendering || !this.rayProcessor) {
      return;
    }

    // Calculate FPS
    const deltaTime = timestamp - this.lastFrameTime;

    if (deltaTime > 1000){
      const fps = Math.round(1000 / (deltaTime / this.proccessedFrame));
      this.fpsCounter.textContent = fps.toString();
      this.lastFrameTime = timestamp;
      this.proccessedFrame = 0;
    }

    // Process frame
    console.log("Processing frame with", this.raysPerFrame, "rays");
    const raysProcessed = this.rayProcessor.processFrame(this.raysPerFrame);

    // Update rays counter
    console.log("Processed", raysProcessed, "rays");
    this.totalRaysProcessed += raysProcessed;
    this.raysCounter.textContent = this.totalRaysProcessed.toString();

    this.proccessedFrame += 1;

    // Request next frame
    console.log("Requesting next frame");
    requestAnimationFrame((time) => this.render(time));
  }

  private async downloadImage(): Promise<void> {
    if (!this.rayProcessor) {
      return;
    }

    try {

      const imageData = await this.rayProcessor.getImageData();

      // Create canvas and context
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // クローンした新しい Uint8ClampedArray を作成することで、detach 状態を回避
      const copiedData = new Uint8ClampedArray(imageData.data);
      const newImageData = new ImageData(copiedData, imageData.width, imageData.height);

      // Draw image data to canvas
      ctx.putImageData(newImageData, 0, 0);

      // Create download link
      const link = document.createElement('a');
      link.download = 'blackhole.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error downloading image:', error);
      alert(`Error downloading image: ${error}`);
    }
  }
}
