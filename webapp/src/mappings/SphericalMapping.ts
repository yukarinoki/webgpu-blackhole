export class SphericalMapping {
  private sizeX: number;
  private sizeY: number;
  
  constructor(sizeX: number, sizeY: number) {
    if (sizeX === 0 || sizeY === 0) {
      throw new Error("Invalid texture dimensions");
    }
    
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
    // Map phi to x coordinate (0 to 2π maps to 0 to sizeX)
    let x = Math.floor((phi / (2 * Math.PI)) * this.sizeX) % this.sizeX;
    if (x < 0) {
      x = this.sizeX + x;
    }
    
    // Map theta to y coordinate (0 to π maps to 0 to sizeY)
    let y = Math.floor((theta / Math.PI) * this.sizeY) % this.sizeY;
    if (y < 0) {
      y = this.sizeY + y;
    }
    
    return { x, y };
  }
  
  /**
   * Map Cartesian coordinates to texture coordinates
   * @param x X coordinate
   * @param y Y coordinate
   * @param z Z coordinate
   * @returns Texture coordinates (u, v)
   */
  mapCartesian(x: number, y: number, z: number): { u: number; v: number } {
    // Map atan2(z, x) to u coordinate (maps -π to π to 0 to sizeX)
    let u = Math.floor((0.5 + Math.atan2(z, x) / (2 * Math.PI)) * this.sizeX) % this.sizeX;
    if (u < 0) {
      u = this.sizeX + u;
    }
    
    // Map asin(y) to v coordinate (maps -π/2 to π/2 to 0 to sizeY)
    let v = Math.floor((0.5 - (Math.asin(y) / Math.PI)) * this.sizeY) % this.sizeY;
    if (v < 0) {
      v = this.sizeY + v;
    }
    
    return { u, v };
  }
}
