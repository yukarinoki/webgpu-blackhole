import { Vector3D } from '../models/Vector3D';
import { SchwarzschildBlackHoleEquation } from '../physics/SchwarzschildBlackHoleEquation';
import { ArgbColor } from '../ArgbColor';
import { IHitable } from './IHitable';

export class Horizon implements IHitable {
  private hasTexture: boolean;
  
  constructor() {
    this.hasTexture = false;
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
    // Event horizon is at r = 2M (in natural units)
    const horizonRadius = 2.0;
    const horizonRadiusSqr = horizonRadius * horizonRadius;
    
    // Check if we crossed the event horizon
    if (sqrNorm < horizonRadiusSqr && prevSqrNorm > horizonRadiusSqr) {
      // Ray has entered the event horizon
      color.r = 0;
      color.g = 0;
      color.b = 0;
      color.a = 255;
      
      stop.value = true;
      return true;
    }
    
    return false;
  }
}
