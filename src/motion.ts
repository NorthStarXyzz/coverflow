/** CSS 3D geometry. The side-stack idea references the MIT coverflow examples
 * credited in NOTICE; this implementation has no renderer dependency. */
export function coverPose(distance: number, size: number) {
  const absolute = Math.abs(distance), focus = Math.min(1, absolute);
  return {
    x: Math.sign(distance) * (focus * size * .82 + Math.max(0, absolute - 1) * size * .24),
    z: -focus * 180,
    rotation: -Math.max(-1, Math.min(1, distance)) * 65,
    scale: 1 - focus * .06,
    opacity: 1,
    brightness: 1 - focus * .14,
    order: 1000 - Math.round(absolute * 100),
  };
}
/** Substeps keep spring integration stable across normal display rates. */
export function advanceSpring(position: number, velocity: number, target: number, seconds: number) {
  const elapsed = Math.max(0, Math.min(.064, seconds));
  const steps = Math.max(1, Math.ceil(elapsed / (1 / 120))), dt = elapsed / steps;
  for (let i = 0; i < steps; i++) {
    velocity += ((target - position) * 150 - velocity * 30) * dt;
    position += velocity * dt;
  }
  const settled = Math.abs(target - position) < .001 && Math.abs(velocity) < .005;
  return { position: settled ? target : position, velocity: settled ? 0 : velocity, settled };
}
