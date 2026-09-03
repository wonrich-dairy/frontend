import type { Tank } from "../../api/tanks";

/** How full a tank is, as a whole percent, clamped so an over-fill still renders a full bar. */
export function percentFull(tank: Tank): number {
  if (tank.capacityLitres <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((tank.totalQuantityLitres / tank.capacityLitres) * 100));
}
