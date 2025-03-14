import { Vector3D } from './Vector3D';

export class Matrix4x4 {
  private data: number[];

  constructor(data?: number[]) {
    if (data && data.length === 16) {
      this.data = [...data];
    } else {
      // Identity matrix by default
      this.data = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ];
    }
  }

  // Get element at row i, column j (0-indexed)
  get(i: number, j: number): number {
    return this.data[i * 4 + j];
  }

  // Set element at row i, column j (0-indexed)
  set(i: number, j: number, value: number): void {
    this.data[i * 4 + j] = value;
  }

  // Access element at row i, column j (0-indexed) using function call syntax
  // This is to match the C++ implementation's operator()
  call(i: number, j: number): number {
    return this.get(i, j);
  }

  // Multiply this matrix by another matrix
  multiply(other: Matrix4x4): Matrix4x4 {
    const result = new Matrix4x4();
    
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += this.get(i, k) * other.get(k, j);
        }
        result.set(i, j, sum);
      }
    }
    
    return result;
  }

  // Transform a 3D vector by this matrix (assuming homogeneous coordinates)
  transform(v: Vector3D): Vector3D {
    return new Vector3D(
      v.x * this.get(0, 0) + v.y * this.get(1, 0) + v.z * this.get(2, 0) + this.get(3, 0),
      v.x * this.get(0, 1) + v.y * this.get(1, 1) + v.z * this.get(2, 1) + this.get(3, 1),
      v.x * this.get(0, 2) + v.y * this.get(1, 2) + v.z * this.get(2, 2) + this.get(3, 2)
    );
  }

  // Create a translation matrix
  static translation(x: number, y: number, z: number): Matrix4x4 {
    return new Matrix4x4([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      x, y, z, 1
    ]);
  }

  // Create a scaling matrix
  static scaling(x: number, y: number, z: number): Matrix4x4 {
    return new Matrix4x4([
      x, 0, 0, 0,
      0, y, 0, 0,
      0, 0, z, 0,
      0, 0, 0, 1
    ]);
  }

  // Create a rotation matrix around the X axis
  static rotationX(angle: number): Matrix4x4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    
    return new Matrix4x4([
      1, 0, 0, 0,
      0, c, -s, 0,
      0, s, c, 0,
      0, 0, 0, 1
    ]);
  }

  // Create a rotation matrix around the Y axis
  static rotationY(angle: number): Matrix4x4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    
    return new Matrix4x4([
      c, 0, s, 0,
      0, 1, 0, 0,
      -s, 0, c, 0,
      0, 0, 0, 1
    ]);
  }

  // Create a rotation matrix around the Z axis
  static rotationZ(angle: number): Matrix4x4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    
    return new Matrix4x4([
      c, -s, 0, 0,
      s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  }

  // Create a view matrix from camera parameters
  static lookAt(eye: Vector3D, target: Vector3D, up: Vector3D): Matrix4x4 {
    const zAxis = eye.subtract(target).normalize();
    const xAxis = up.cross(zAxis).normalize();
    const yAxis = zAxis.cross(xAxis);
    
    return new Matrix4x4([
      xAxis.x, yAxis.x, zAxis.x, 0,
      xAxis.y, yAxis.y, zAxis.y, 0,
      xAxis.z, yAxis.z, zAxis.z, 0,
      -xAxis.dot(eye), -yAxis.dot(eye), -zAxis.dot(eye), 1
    ]);
  }

  // Create a perspective projection matrix
  static perspective(fovY: number, aspect: number, near: number, far: number): Matrix4x4 {
    const f = 1.0 / Math.tan(fovY / 2);
    const rangeInv = 1 / (near - far);
    
    return new Matrix4x4([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * rangeInv, -1,
      0, 0, near * far * rangeInv * 2, 0
    ]);
  }
}
