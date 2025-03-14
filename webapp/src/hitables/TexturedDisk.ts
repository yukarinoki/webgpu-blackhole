import { Disk } from './Disk';
import { ArgbColor } from '../ArgbColor';
import { DiscMapping } from '../mappings/DiscMapping';

export class TexturedDisk extends Disk {
  private textureMap: DiscMapping;
  private textureWidth: number;
  private textureImage: HTMLImageElement;
  private textureCanvas: HTMLCanvasElement;
  private textureContext: CanvasRenderingContext2D;
  
  constructor(radiusInner: number, radiusOuter: number, texture: HTMLImageElement) {
    super(radiusInner, radiusOuter);
    
    this.textureImage = texture;
    const width = texture.width;;
    this.textureWidth = width
    
    // Create a canvas to read pixel data from the texture
    this.textureCanvas = document.createElement('canvas');
    console.log("create canvas for texture"); 
    this.textureCanvas.width = width;
    this.textureCanvas.height = texture.height;
    
    this.textureContext = this.textureCanvas.getContext('2d')!;
    this.textureContext.drawImage(texture, 0, 0); 
    // Create texture mapping
    this.textureMap = new DiscMapping(radiusInner, radiusOuter, width, texture.height);
  }
  
  protected getColor(side: number, r: number, theta: number, phi: number): ArgbColor {
    const { x, y } = this.textureMap.map(r, theta, phi);
    
    // Get pixel data from the texture
    const pixelData = this.textureContext.getImageData(x, y, 1, 1).data;
    
    return new ArgbColor(pixelData[0], pixelData[1], pixelData[2], pixelData[3]);
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
      this.textureMap = new DiscMapping(this.radiusInner, this.radiusOuter, texture.width, texture.height);
    }
    
    // Update canvas with new texture
    this.textureContext.drawImage(texture, 0, 0);
  }
}
