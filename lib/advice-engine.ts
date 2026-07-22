import type { EnergySnapshot } from './homey-energy-reader';

export type AdviceResult = {
  confidence: number;
  advice: string;
  batteryAdvice: string;
  evAdvice: string;
  savingsToday: number;
};

export type AdviceThresholds = {
  evChargingPower: number;
  batteryActivePower: number;
  gridDeadbandPower: number;
  highImportPower: number;
  solarSurplusPower: number;
};

export class AdviceEngine {
  evaluate(snapshot: EnergySnapshot, mode: string, thresholds: AdviceThresholds): AdviceResult {
    const exporting = snapshot.gridPower < -thresholds.gridDeadbandPower;
    const importing = snapshot.gridPower > thresholds.gridDeadbandPower;
    const highImport = snapshot.gridPower > thresholds.highImportPower;
    const batteryCharging = snapshot.batteryPower > thresholds.batteryActivePower;
    const batteryDischarging = snapshot.batteryPower < -thresholds.batteryActivePower;
    const evCharging = snapshot.evPower >= thresholds.evChargingPower;
    const solarSurplus = exporting && snapshot.solarPower >= thresholds.solarSurplusPower;

    let advice = 'Energie in balans';
    let batteryAdvice = batteryCharging
      ? 'Batterij laadt'
      : batteryDischarging
        ? 'Batterij ontlaadt'
        : 'Batterij stand-by';
    let evAdvice = evCharging ? 'Auto wordt geladen' : 'Auto wordt niet geladen';

    if (solarSurplus) {
      advice = `${Math.abs(snapshot.gridPower)} W teruglevering`;
      batteryAdvice = batteryCharging ? 'Batterij gebruikt zon' : 'Batterij laden met zon';
      evAdvice = evCharging ? 'EV gebruikt zonne-overschot' : 'EV-laden kan starten';
    } else if (highImport) {
      advice = `${snapshot.gridPower} W hoge netafname`;
      batteryAdvice = batteryDischarging ? 'Batterij verlaagt piek' : 'Ontladen kan piek verlagen';
      evAdvice = evCharging ? 'EV-laden verlagen' : 'EV-laden uitstellen';
    } else if (exporting) {
      advice = `${Math.abs(snapshot.gridPower)} W teruglevering`;
    } else if (importing) {
      advice = `${snapshot.gridPower} W netafname`;
    } else if (snapshot.solarPower >= thresholds.solarSurplusPower) {
      advice = `${snapshot.solarPower} W zonneproductie`;
    }

    if (mode === 'advice' && advice === 'Energie in balans') {
      advice = 'Geen actie nodig';
    }

    return {
      confidence: Math.max(20, Math.min(95, 35 + snapshot.sourceCount * 12)),
      advice,
      batteryAdvice,
      evAdvice,
      savingsToday: solarSurplus ? 0.85 : highImport ? 0.45 : 0.15,
    };
  }
}
