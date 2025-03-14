// WebGPU type definitions
// This is a simplified version of the WebGPU types for our application

interface GPUDevice {
  createShaderModule(descriptor: { code: string }): GPUShaderModule;
  createComputePipeline(descriptor: any): GPUComputePipeline;
  createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
  createTexture(descriptor: GPUTextureDescriptor): GPUTexture;
  createSampler(descriptor: GPUSamplerDescriptor): GPUSampler;
  createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
  createCommandEncoder(): GPUCommandEncoder;
  queue: GPUQueue;
}

interface GPUQueue {
  writeBuffer(buffer: GPUBuffer, offset: number, data: ArrayBufferView): void;
  submit(commandBuffers: GPUCommandBuffer[]): void;
  copyExternalImageToTexture(
    source: { source: ImageBitmap },
    destination: { texture: GPUTexture },
    copySize: [number, number]
  ): void;
}

interface GPUAdapter {
  requestDevice(): Promise<GPUDevice>;
}

interface GPUCanvasContext {
  configure(descriptor: GPUCanvasConfiguration): void;
  getCurrentTexture(): GPUTexture;
}

interface GPUCanvasConfiguration {
  device: GPUDevice;
  format: string;
  alphaMode: string;
}

interface GPUBufferDescriptor {
  size: number;
  usage: number;
  mappedAtCreation?: boolean;
}

interface GPUTextureDescriptor {
  size: [number, number] | [number, number, number];
  format: string;
  usage: number;
}

interface GPUSamplerDescriptor {
  magFilter?: string;
  minFilter?: string;
  addressModeU?: string;
  addressModeV?: string;
}

interface GPUBindGroupDescriptor {
  layout: GPUBindGroupLayout;
  entries: {
    binding: number;
    resource: any;
  }[];
}

interface GPUBindGroupLayout {
}

interface GPUShaderModule {
}

interface GPUComputePipeline {
  getBindGroupLayout(index: number): GPUBindGroupLayout;
}

interface GPUBuffer {
  getMappedRange(): ArrayBuffer;
  unmap(): void;
}

interface GPUTexture {
  createView(): GPUTextureView;
  destroy(): void;
}

interface GPUTextureView {
}

interface GPUSampler {
}

interface GPUCommandEncoder {
  beginComputePass(): GPUComputePassEncoder;
  copyTextureToTexture(
    source: { texture: GPUTexture },
    destination: { texture: GPUTexture },
    copySize: [number, number]
  ): void;
  finish(): GPUCommandBuffer;
}

interface GPUComputePassEncoder {
  setPipeline(pipeline: GPUComputePipeline): void;
  setBindGroup(index: number, bindGroup: GPUBindGroup): void;
  dispatchWorkgroups(x: number, y: number, z?: number): void;
  end(): void;
}

interface GPUCommandBuffer {
}

interface GPUBindGroup {
}

interface Navigator {
  gpu: {
    requestAdapter(): Promise<GPUAdapter>;
    getPreferredCanvasFormat(): string;
  };
}

// Buffer usage flags
// const enum GPUBufferUsage {
//   COPY_SRC = 0x0001,
//   COPY_DST = 0x0002,
//   INDEX = 0x0004,
//   VERTEX = 0x0008,
//   UNIFORM = 0x0010,
//   STORAGE = 0x0020,
//   INDIRECT = 0x0040,
//   QUERY_RESOLVE = 0x0080,
//   MAP_READ = 0x0100,
//   MAP_WRITE = 0x0200
// }

const enum GPUBufferUsage {
  COPY_SRC = 0x0004,
  COPY_DST = 0x0008,
  INDEX = 0x00010,
  VERTEX = 0x0020,
  UNIFORM = 0x0040,
  STORAGE = 0x0080,
  INDIRECT = 0x0100,
  QUERY_RESOLVE = 0x0200,
  MAP_READ = 0x0001,
  MAP_WRITE = 0x0002
};

// Texture usage flags
const enum GPUTextureUsage {
  COPY_SRC = 0x01,
  COPY_DST = 0x02,
  TEXTURE_BINDING = 0x04,
  STORAGE_BINDING = 0x08,
  RENDER_ATTACHMENT = 0x10
}

type GPUBufferUsageFlags = number;
