import { Vector3D } from '../models/Vector3D';
import { SchwarzschildBlackHoleEquation } from '../physics/SchwarzschildBlackHoleEquation';
import { ArgbColor } from '../ArgbColor';
import { IHitable } from './IHitable';
import { Utils } from '../Utils';

export class Disk implements IHitable {
  protected radiusInner: number;
  protected radiusOuter: number;
  protected radiusInnerSqr: number;
  protected radiusOuterSqr: number;
  
  constructor(radiusInner: number, radiusOuter: number) {
    this.radiusInner = radiusInner;
    this.radiusOuter = radiusOuter;
    this.radiusInnerSqr = radiusInner * radiusInner;
    this.radiusOuterSqr = radiusOuter * radiusOuter;
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
    // Remember what side of the plane we're currently on
    const side = prevPoint.y > 0 ? -1 : prevPoint.y < 0 ? 1 : 0;
    
    // Did we cross the horizontal plane?
    let success = false;
    if (point.y * side >= 0) {
      const colPoint = this.intersectionSearch(side, prevPoint, velocity, equation);
      const colPointSqr = colPoint.norm2();
      
      if (colPointSqr >= this.radiusInnerSqr && colPointSqr <= this.radiusOuterSqr) {
        const spherical = Utils.toSpherical(colPoint.x, colPoint.y, colPoint.z);
        
        // Get color at intersection point
        const hitColor = this.getColor(side, spherical.r, spherical.phi, spherical.theta + Math.PI / 12);
        
        // Add color to output
        const newColor = Utils.addColor(hitColor, color);
        color.r = newColor.r;
        color.g = newColor.g;
        color.b = newColor.b;
        color.a = newColor.a;
        
        stop.value = false;
        success = true;
      }
    }
    
    return success;
  }
  
  protected intersectionSearch(
    side: number,
    prevPoint: Vector3D,
    velocity: Vector3D,
    equation: SchwarzschildBlackHoleEquation
  ): Vector3D {
    let stepLow = 0;
    let stepHigh = equation.stepSize;
    let newPoint = prevPoint.clone();
    
    while (true) {
      const stepMid = (stepLow + stepHigh) / 2;
      newPoint = prevPoint.clone();
      const tempVelocity = velocity.clone();
      
      equation.functionWithStep(newPoint, tempVelocity, stepMid);
      
      if (Math.abs(stepHigh - stepLow) < 0.00001) {
        break;
      }
      
      if (side * newPoint.y > 0) {
        stepHigh = stepMid;
      } else {
        stepLow = stepMid;
      }
    }
    
    return newPoint;
  }
  
  protected getColor(side: number, r: number, theta: number, phi: number): ArgbColor {
    return ArgbColor.White;
  }
}
