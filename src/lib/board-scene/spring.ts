const MAX_STEP = 1 / 120;

/**
 * A damped harmonic spring. Retargeting mid-flight keeps its velocity,
 * so an animation interrupted by the next tap flows into the new one.
 */
export class Spring {
  velocity = 0;
  target: number;

  constructor(
    public value: number,
    public stiffness = 170,
    public damping = 20,
  ) {
    this.target = value;
  }

  /** Adds velocity without changing where the spring comes to rest. */
  kick(velocity: number) {
    this.velocity += velocity;
  }

  snap(value: number) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }

  step(dt: number) {
    // Fixed sub-steps keep stiff springs stable through a dropped frame.
    let remaining = Math.min(dt, 0.1);
    while (remaining > 0) {
      const h = Math.min(remaining, MAX_STEP);
      const force =
        this.stiffness * (this.target - this.value) -
        this.damping * this.velocity;
      this.velocity += force * h;
      this.value += this.velocity * h;
      remaining -= h;
    }
  }

  get settled(): boolean {
    return (
      Math.abs(this.target - this.value) < 1e-3 &&
      Math.abs(this.velocity) < 1e-2
    );
  }
}
