export class Vector3D {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0
  ) {}

  // Clone the vector
  clone(): Vector3D {
    return new Vector3D(this.x, this.y, this.z);
  }

  // Add another vector to this one
  add(v: Vector3D): Vector3D {
    return new Vector3D(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  // Subtract another vector from this one
  subtract(v: Vector3D): Vector3D {
    return new Vector3D(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  // Multiply by scalar
  multiply(scalar: number): Vector3D {
    return new Vector3D(this.x * scalar, this.y * scalar, this.z * scalar);
  }

  // Divide by scalar
  divide(scalar: number): Vector3D {
    if (scalar === 0) {
      throw new Error("Cannot divide by zero");
    }
    const invScalar = 1 / scalar;
    return new Vector3D(this.x * invScalar, this.y * invScalar, this.z * invScalar);
  }

  // Calculate the dot product with another vector
  dot(v: Vector3D): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  // Calculate the cross product with another vector
  cross(v: Vector3D): Vector3D {
    return new Vector3D(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }

  // Calculate the squared length of the vector
  norm2(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  // Calculate the length of the vector
  norm(): number {
    return Math.sqrt(this.norm2());
  }

  // Normalize the vector (make it unit length)
  normalize(): Vector3D {
    const length = this.norm();
    if (length === 0) {
      return new Vector3D(0, 0, 0);
    }
    return this.divide(length);
  }

  // Static method to create a vector from spherical coordinates
  static fromSpherical(r: number, theta: number, phi: number): Vector3D {
    return new Vector3D(
      r * Math.sin(theta) * Math.cos(phi),
      r * Math.sin(theta) * Math.sin(phi),
      r * Math.cos(theta)
    );
  }

  // Convert to spherical coordinates
  toSpherical(): { r: number; theta: number; phi: number } {
    const r = this.norm();
    if (r === 0) {
      return { r: 0, theta: 0, phi: 0 };
    }
    const theta = Math.acos(this.z / r);
    const phi = Math.atan2(this.y, this.x);
    return { r, theta, phi };
  }
}

// Static utility functions
export function dot(a: Vector3D, b: Vector3D): number {
  return a.dot(b);
}

export function cross(a: Vector3D, b: Vector3D): Vector3D {
  return a.cross(b);
}
