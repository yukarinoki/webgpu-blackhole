import { Vector3D } from '../models/Vector3D';
import { SchwarzschildBlackHoleEquation } from '../physics/SchwarzschildBlackHoleEquation';
import { ArgbColor } from '../ArgbColor';

export interface IHitable {
  /**
   * Check if a ray hits this object
   * @param point Current point of the ray
   * @param sqrNorm Squared norm of the current point
   * @param prevPoint Previous point of the ray
   * @param prevSqrNorm Squared norm of the previous point
   * @param velocity Current velocity of the ray
   * @param equation Schwarzschild equation for the ray
   * @param r Spherical coordinate r of the current point
   * @param theta Spherical coordinate theta of the current point
   * @param phi Spherical coordinate phi of the current point
   * @param color Output color if hit
   * @param stop Whether to stop ray tracing if hit
   * @param debug Debug flag
   * @returns Whether the ray hit this object
   */
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
  ): boolean;
}
