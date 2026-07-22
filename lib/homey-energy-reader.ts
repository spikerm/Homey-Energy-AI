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
  id?: string;
  name?: string;
  class?: string;
  capabilities?: string[];
  capabilitiesObj?: Record<string, CapabilityValue>;
  energy?: {
    cumulative?: boolean;
    cumulativeImportedCapability?: string;
    cumulativeExportedCapability?: string;
  };
};

const POWER_CAPABILITIES = [
  'measure_power',
  'measure_power.total',
  'measure_power.grid',
  'measure_power.import',
  'measure_power.export',
  'power',
];

function readNumber(device: DeviceLike, capability: string): number | null {
  const value = device.capabilitiesObj?.[capability]?.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readPower(device: DeviceLike): number | null {
  for (const capability of POWER_CAPABILITIES) {
    const value = readNumber(device, capability);
    if (value !== null) return value;
  }
  return null;
}

function searchable(device: DeviceLike): string {
  return `${device.id ?? ''} ${device.name ?? ''} ${device.class ?? ''}`.toLowerCase();
}

function isSolar(device: DeviceLike): boolean {
  const text = searchable(device);
  return device.class === 'solarpanel' || /solar|pv|zonne|inverter|hoymiles/.test(text);
}

function isBattery(device: DeviceLike): boolean {
  const text = searchable(device);
  return device.class === 'battery' || /battery|batterij|accu|marstek/.test(text);
}

function isEv(device: DeviceLike): boolean {
  const text = searchable(device);
  return device.class === 'evcharger' || device.class === 'ev' || /evse|charger|laadpaal|auto laden/.test(text);
}

function isGrid(device: DeviceLike): boolean {
  const text = searchable(device);
  return device.energy?.cumulative === true
    || /p1|smart meter|slimme meter|grid|netmeter|youless|homewizard/.test(text);
}

export class HomeyEnergyReader {
  constructor(private readonly api: any) {}

  async read(): Promise<EnergySnapshot> {
    const result = await this.api.devices.getDevices();
    const devices = Object.values(result ?? {}) as DeviceLike[];

    const gridCandidates: number[] = [];
    let solarPower = 0;
    let batteryPower = 0;
    let evPower = 0;
    let otherPower = 0;
    let sourceCount = 0;

    for (const device of devices) {
      const power = readPower(device);
      if (power === null) continue;

      // Classification order matters: batteries and solar devices may also
      // expose cumulative energy metadata and must not be treated as P1 meters.
      if (isSolar(device)) {
        solarPower += Math.abs(power);
        sourceCount += 1;
      } else if (isBattery(device)) {
        batteryPower += power;
        sourceCount += 1;
      } else if (isEv(device)) {
        evPower += Math.max(0, power);
        sourceCount += 1;
      } else if (isGrid(device)) {
        gridCandidates.push(power);
        sourceCount += 1;
      } else if (power > 0) {
        otherPower += power;
      }
    }

    // Several apps can expose the same P1 reading. Taking the strongest
    // candidate prevents duplicate meters from being added together.
    const gridPower = gridCandidates.reduce((selected, candidate) => (
      Math.abs(candidate) > Math.abs(selected) ? candidate : selected
    ), 0);

    // Homey power convention is normally positive for consumption/charging.
    // Therefore battery charging is subtracted from PV + grid to estimate the
    // actual home load; a negative battery value (discharging) is added.
    const hasGridSource = gridCandidates.length > 0;
    const consumptionPower = hasGridSource
      ? Math.max(0, gridPower + solarPower - batteryPower)
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
