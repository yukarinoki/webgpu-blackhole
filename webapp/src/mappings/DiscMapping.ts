export class DiscMapping {
  private rMin: number;
  private rMax: number;
  private sizeX: number;
  private sizeY: number;
  
  constructor(rMin: number, rMax: number, sizeX: number, sizeY: number) {
    if (sizeX === 0 || sizeY === 0) {
      throw new Error("Invalid texture dimensions");
    }
    
    this.rMin = rMin;
    this.rMax = rMax;
    this.sizeX = sizeX;
    this.sizeY = sizeY;
  }
  
  /**
   * Map spherical coordinates to texture coordinates
   * @param r Radial distance
   * @param theta Polar angle
   * @param phi Azimuthal angle
   * @returns Texture coordinates (x, y)
   */
  map(r: number, theta: number, phi: number): { x: number; y: number } {
    if (r < this.rMin || r > this.rMax) {
      return { x: 0, y: this.sizeY - 1 };
    }
    
    // Map phi to x coordinate (0 to 2π maps to 0 to sizeX)
    let x = Math.floor((phi / (2 * Math.PI)) * this.sizeX) % this.sizeX;
    if (x < 0) {
      x = this.sizeX + x;
    }
    
    // Map r to y coordinate (rMin to rMax maps to 0 to sizeY)
    let y = Math.floor(((r - this.rMin) / (this.rMax - this.rMin)) * this.sizeY);
    if (y > this.sizeY - 1) {
      y = this.sizeY - 1;
    }
    
    return { x, y };
  }
}
