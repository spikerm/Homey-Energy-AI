export type EnergySnapshot = {
  gridPower: number;
  consumptionPower: number;
  solarPower: number;
  batteryPower: number;
  evPower: number;
  deviceCount: number;
  sourceCount: number;
};

type CapabilityValue = { value?: unknown };
type DeviceLike = {
  class?: string;
  capabilitiesObj?: Record<string, CapabilityValue>;
  energy?: { cumulative?: boolean };
};

function readPower(device: DeviceLike): number | null {
  const value = device.capabilitiesObj?.measure_power?.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export class HomeyEnergyReader {
  constructor(private readonly api: any) {}

  async read(): Promise<EnergySnapshot> {
    const result = await this.api.devices.getDevices();
    const devices = Object.values(result ?? {}) as DeviceLike[];

    let gridPower = 0;
    let solarPower = 0;
    let batteryPower = 0;
    let evPower = 0;
    let otherPower = 0;
    let sourceCount = 0;

    for (const device of devices) {
      const power = readPower(device);
      if (power === null) continue;

      if (device.energy?.cumulative === true) {
        gridPower += power;
        sourceCount += 1;
      } else if (device.class === 'solarpanel') {
        solarPower += Math.abs(power);
        sourceCount += 1;
      } else if (device.class === 'battery') {
        batteryPower += power;
        sourceCount += 1;
      } else if (device.class === 'evcharger' || device.class === 'ev') {
        evPower += Math.max(0, power);
        sourceCount += 1;
      } else if (power > 0) {
        otherPower += power;
      }
    }

    const consumptionPower = gridPower !== 0
      ? Math.max(0, gridPower + solarPower + Math.max(0, batteryPower))
      : Math.max(0, otherPower + evPower);

    return {
      gridPower: Math.round(gridPower),
      consumptionPower: Math.round(consumptionPower),
      solarPower: Math.round(solarPower),
      batteryPower: Math.round(batteryPower),
      evPower: Math.round(evPower),
      deviceCount: devices.length,
      sourceCount,
    };
  }
}
