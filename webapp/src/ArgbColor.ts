export class ArgbColor {
  constructor(
    public r: number = 0,
    public g: number = 0,
    public b: number = 0,
    public a: number = 255
  ) {}

  // Static color constants
  static readonly Transparent = new ArgbColor(0, 0, 0, 0);
  static readonly Black = new ArgbColor(0, 0, 0);
  static readonly White = new ArgbColor(255, 255, 255);
  static readonly Red = new ArgbColor(255, 0, 0);
  static readonly Green = new ArgbColor(0, 255, 0);
  static readonly Blue = new ArgbColor(0, 0, 255);
  static readonly Yellow = new ArgbColor(255, 255, 0);
  static readonly Cyan = new ArgbColor(0, 255, 255);
  static readonly Magenta = new ArgbColor(255, 0, 255);

  // Create a color from ARGB integer
  static fromArgb(argb: number | Uint8ClampedArray): ArgbColor {
    if (typeof argb === 'number') {
      const a = (argb >> 24) & 0xFF;
      const r = (argb >> 16) & 0xFF;
      const g = (argb >> 8) & 0xFF;
      const b = argb & 0xFF;
      return new ArgbColor(r, g, b, a);
    } else if (argb instanceof Uint8ClampedArray) {
      // For image data, assuming RGBA format
      return new ArgbColor(argb[0], argb[1], argb[2], argb[3]);
    } else {
      throw new Error('Invalid argument type for fromArgb');
    }
  }

  // Convert to ARGB integer
  toArgb(): number {
    return ((this.a & 0xFF) << 24) |
           ((this.r & 0xFF) << 16) |
           ((this.g & 0xFF) << 8) |
           (this.b & 0xFF);
  }

  // Convert to CSS color string
  toCssColor(): string {
    return `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a / 255})`;
  }

  // Check if two colors are equal
  equals(other: ArgbColor): boolean {
    return this.r === other.r &&
           this.g === other.g &&
           this.b === other.b &&
           this.a === other.a;
  }

  // Clone the color
  clone(): ArgbColor {
    return new ArgbColor(this.r, this.g, this.b, this.a);
  }
}
