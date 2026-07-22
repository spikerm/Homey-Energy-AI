import type { EnergySnapshot } from './homey-energy-reader';

export type AdviceResult = {
  confidence: number;
  energyScore: number;
  selfConsumption: number;
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

    const exportedPower = Math.max(0, -snapshot.gridPower);
    const selfConsumedSolar = Math.max(0, snapshot.solarPower - exportedPower);
    const selfConsumption = snapshot.solarPower > 0
      ? Math.max(0, Math.min(100, Math.round((selfConsumedSolar / snapshot.solarPower) * 100)))
      : 0;

    let energyScore = 70;
    if (snapshot.solarPower > 0) energyScore += Math.round(selfConsumption * 0.2);
    if (exporting) energyScore -= Math.min(15, Math.round(exportedPower / 500));
    if (highImport) energyScore -= Math.min(30, Math.round((snapshot.gridPower - thresholds.highImportPower) / 250));
    if (batteryDischarging && importing) energyScore += 5;
    if (batteryCharging && snapshot.solarPower > 0) energyScore += 5;
    energyScore = Math.max(0, Math.min(100, energyScore));

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
      energyScore,
      selfConsumption,
      advice,
      batteryAdvice,
      evAdvice,
      savingsToday: solarSurplus ? 0.85 : highImport ? 0.45 : 0.15,
    };
  }
}
