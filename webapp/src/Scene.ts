import { Vector3D } from './models/Vector3D';
import { IHitable } from './hitables/IHitable';
import { SchwarzschildBlackHoleEquation } from './physics/SchwarzschildBlackHoleEquation';
import { Utils } from './Utils';

export class Scene {
  // Camera properties
  cameraPosition: Vector3D;
  cameraLookAt: Vector3D;
  upVector: Vector3D;
  
  // Field of view in degrees
  fov: number;
  
  // Camera spherical coordinates
  cameraDistance: number;
  cameraAngleHorz: number;
  cameraAngleVert: number;
  cameraTilt: number = 0;
  
  // Objects in the scene
  hitables: IHitable[];
  
  // Physics equation
  schwarzschildEquation: SchwarzschildBlackHoleEquation;
  
  constructor(
    cameraPosition: Vector3D,
    cameraLookAt: Vector3D,
    upVector: Vector3D,
    fov: number,
    hitables: IHitable[],
    curvatureCoefficient: number
  ) {
    this.cameraPosition = cameraPosition;
    this.cameraLookAt = cameraLookAt;
    this.upVector = upVector;
    this.fov = fov;
    this.hitables = hitables;
    
    // Calculate camera spherical coordinates
    const spherical = Utils.toSpherical(
      cameraPosition.x,
      cameraPosition.y,
      cameraPosition.z
    );
    
    this.cameraDistance = spherical.r;
    this.cameraAngleVert = spherical.theta;
    this.cameraAngleHorz = spherical.phi - 0.1;
    
    // Create Schwarzschild equation
    this.schwarzschildEquation = new SchwarzschildBlackHoleEquation(curvatureCoefficient);
  }
  
  // Clone the scene
  clone(): Scene {
    return new Scene(
      this.cameraPosition.clone(),
      this.cameraLookAt.clone(),
      this.upVector.clone(),
      this.fov,
      [...this.hitables],
      this.schwarzschildEquation.potentialCoefficient
    );
  }
  
  // Update camera position from spherical coordinates
  updateCameraFromSpherical(): void {
    const x = this.cameraDistance * Math.sin(this.cameraAngleVert) * Math.cos(this.cameraAngleHorz);
    const y = this.cameraDistance * Math.cos(this.cameraAngleVert);
    const z = this.cameraDistance * Math.sin(this.cameraAngleVert) * Math.sin(this.cameraAngleHorz);
    
    this.cameraPosition = new Vector3D(x, y, z);
  }
}
