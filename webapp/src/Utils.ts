import { Vector3D } from './models/Vector3D';
import { Matrix4x4 } from './models/Matrix4x4';
import { ArgbColor } from './ArgbColor';

export class Utils {
  // Convert from Cartesian to Spherical coordinates
  static toSpherical(x: number, y: number, z: number): { r: number; theta: number; phi: number } {
    const r = Math.sqrt(x * x + y * y + z * z);
    if (r === 0) {
      return { r: 0, theta: 0, phi: 0 };
    }
    const theta = Math.acos(z / r);
    const phi = Math.atan2(y, x);
    return { r, theta, phi };
  }

  // Convert from Spherical to Cartesian coordinates
  static toCartesian(r: number, theta: number, phi: number): Vector3D {
    const x = r * Math.sin(theta) * Math.cos(phi);
    const y = r * Math.sin(theta) * Math.sin(phi);
    const z = r * Math.cos(theta);
    return new Vector3D(x, y, z);
  }

  // Transform a vector using a matrix
  static transform(v: Vector3D, matrix: Matrix4x4): Vector3D {
    return matrix.transform(v);
  }

  // Modulo function that works correctly with negative numbers
  static doubleMod(n: number, m: number): number {
    return ((n % m) + m) % m;
  }

  // Get brightness of a color
  static getBrightness(color: ArgbColor): number {
    const r = color.r / 255;
    const g = color.g / 255;
    const b = color.b / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    
    return (max + min) / 2;
  }

  // Cap a value to a maximum
  static cap(x: number, max: number): number {
    return x > max ? max : x;
  }

  // Cap a value to a minimum
  static capMin(x: number, min: number): number {
    return x < min ? min : x;
  }

  // Add two colors together
  static addColor(hitColor: ArgbColor, tintColor: ArgbColor): ArgbColor {
    if (tintColor.equals(ArgbColor.Transparent)) {
      return hitColor;
    }
    
    const brightness = Utils.getBrightness(tintColor);
    
    const r = Utils.cap(Math.floor((1.0 - brightness) * hitColor.r + 
                Utils.capMin(tintColor.r, 0) * 255 / 205), 255);
    const g = Utils.cap(Math.floor((1.0 - brightness) * hitColor.g + 
                Utils.capMin(tintColor.g, 0) * 255 / 205), 255);
    const b = Utils.cap(Math.floor((1.0 - brightness) * hitColor.b + 
                Utils.capMin(tintColor.b, 0) * 255 / 205), 255);
    
    return new ArgbColor(r, g, b, 255);
  }

  // Create a texture from an image
  static createTextureFromImage(device: GPUDevice, image: HTMLImageElement): GPUTexture {
    // Create a bitmap from the image
    const imageBitmap = createImageBitmap(image);
    
    // Create a texture
    const texture = device.createTexture({
      size: [image.width, image.height, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      label: 'Texture from image'
    });
    
    // Copy the image data to the texture
    imageBitmap.then(bitmap => {
      device.queue.copyExternalImageToTexture(
        { source: bitmap },
        { texture: texture },
        [bitmap.width, bitmap.height]
      );
    });
    
    return texture;
  }

  // Log buffer usage flags in human-readable format
  static logBufferUsageFlags(usage: number): string {
    const flags = [];
    if (usage & GPUBufferUsage.COPY_SRC) flags.push("COPY_SRC");
    if (usage & GPUBufferUsage.COPY_DST) flags.push("COPY_DST");
    if (usage & GPUBufferUsage.INDEX) flags.push("INDEX");
    if (usage & GPUBufferUsage.VERTEX) flags.push("VERTEX");
    if (usage & GPUBufferUsage.UNIFORM) flags.push("UNIFORM");
    if (usage & GPUBufferUsage.STORAGE) flags.push("STORAGE");
    if (usage & GPUBufferUsage.INDIRECT) flags.push("INDIRECT");
    if (usage & GPUBufferUsage.QUERY_RESOLVE) flags.push("QUERY_RESOLVE");
    if (usage & GPUBufferUsage.MAP_READ) flags.push("MAP_READ");
    if (usage & GPUBufferUsage.MAP_WRITE) flags.push("MAP_WRITE");
    return flags.join(" | ");
  }

  // Note: createBuffer utility method has been removed.
  // All buffer creation is now done directly at the call site.
}
