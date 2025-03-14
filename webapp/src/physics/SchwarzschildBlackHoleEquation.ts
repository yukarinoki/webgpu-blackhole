import { Vector3D, cross } from '../models/Vector3D';

export class SchwarzschildBlackHoleEquation {
  // Default step size
  readonly defaultStepSize: number = 0.16;
  
  // Angular momentum squared
  private h2: number = 0;
  
  // Current step size
  stepSize: number;
  
  // Potential coefficient (ranges from 0 for no curvature to -1.5 for full curvature)
  potentialCoefficient: number;
  
  constructor(potentialCoefficient: number) {
    this.potentialCoefficient = potentialCoefficient;
    this.stepSize = this.defaultStepSize;
  }
  
  // Clone the equation
  clone(): SchwarzschildBlackHoleEquation {
    const equation = new SchwarzschildBlackHoleEquation(this.potentialCoefficient);
    equation.stepSize = this.stepSize;
    equation.h2 = this.h2;
    return equation;
  }
  
  // Set initial conditions for the ray
  setInitialConditions(point: Vector3D, velocity: Vector3D): void {
    const c = cross(point, velocity);
    this.h2 = c.norm2();
  }
  
  // Apply the equation to update point and velocity
  function(point: Vector3D, velocity: Vector3D): void {
    this.functionWithStep(point, velocity, (point.norm() / 30.0) * this.stepSize);
  }
  
  // Apply the equation with a specific step size
  functionWithStep(point: Vector3D, velocity: Vector3D, step: number): void {
    // Update position
    const newPoint = point.add(velocity.multiply(step));
    point.x = newPoint.x;
    point.y = newPoint.y;
    point.z = newPoint.z;
    
    // Calculate acceleration
    // This is the magical -3/2 r^(-5) potential
    const pointNorm2 = point.norm2();
    const accel = point.multiply(this.potentialCoefficient * this.h2 / Math.pow(pointNorm2, 2.5));
    
    // Update velocity
    const newVelocity = velocity.add(accel.multiply(step));
    velocity.x = newVelocity.x;
    velocity.y = newVelocity.y;
    velocity.z = newVelocity.z;
  }
}
