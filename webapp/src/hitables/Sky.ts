import { Vector3D } from '../models/Vector3D';
import { SchwarzschildBlackHoleEquation } from '../physics/SchwarzschildBlackHoleEquation';
import { ArgbColor } from '../ArgbColor';
import { IHitable } from './IHitable';
import { SphericalMapping } from '../mappings/SphericalMapping';
import { Utils } from '../Utils';

export class Sky implements IHitable {
  private textureMap: SphericalMapping;
  private textureWidth: number;
  private textureImage: HTMLImageElement;
  private textureCanvas: HTMLCanvasElement;
  private textureContext: CanvasRenderingContext2D;
  private radius: number;
  private radiusSqr: number;
  private textureOffset: number = 0;
  
  constructor(texture: HTMLImageElement, radius: number) {
    this.textureImage = texture;
    this.textureWidth = texture.width;
    this.radius = radius;
    this.radiusSqr = radius * radius;
    
    // Create a canvas to read pixel data from the texture
    this.textureCanvas = document.createElement('canvas');
    this.textureCanvas.width = texture.width;
    this.textureCanvas.height = texture.height;
    
    this.textureContext = this.textureCanvas.getContext('2d')!;
    this.textureContext.drawImage(texture, 0, 0);
    
    // Create texture mapping
    this.textureMap = new SphericalMapping(texture.width, texture.height);
  }
  
  // Set texture offset
  setTextureOffset(offset: number): Sky {
    this.textureOffset = offset;
    return this;
  }
  
  // Update the texture
  updateTexture(texture: HTMLImageElement): void {
    this.textureImage = texture;
    this.textureWidth = texture.width;
    
    // Resize canvas if needed
    if (this.textureCanvas.width !== texture.width || this.textureCanvas.height !== texture.height) {
      this.textureCanvas.width = texture.width;
      this.textureCanvas.height = texture.height;
      
      // Update texture mapping
      this.textureMap = new SphericalMapping(texture.width, texture.height);
    }
    
    // Update canvas with new texture
    this.textureContext.drawImage(texture, 0, 0);
  }
  
  hit(
    point: Vector3D,
    sqrNorm: number,
    prevPoint: Vector3D,
    prevSqrNorm: number,
    velocity: Vector3D,
    equation: SchwarzschildBlackHoleEquation,
    r: number,
    theta: number,
    phi: number,
    color: ArgbColor,
    stop: { value: boolean },
    debug: boolean
  ): boolean {
    // Has the ray escaped to infinity?
    if (sqrNorm > this.radiusSqr) {
      // Get texture coordinates
      const { x, y } = this.textureMap.map(r, theta, phi + this.textureOffset);
      
      // Get pixel data from the texture
      const pixelData = this.textureContext.getImageData(x, y, 1, 1).data;
      const skyColor = new ArgbColor(pixelData[0], pixelData[1], pixelData[2], pixelData[3]);
      
      // Add color to output
      const newColor = Utils.addColor(skyColor, color);
      color.r = newColor.r;
      color.g = newColor.g;
      color.b = newColor.b;
      color.a = newColor.a;
      
      stop.value = true;
      return true;
    }
    
    return false;
  }
}
