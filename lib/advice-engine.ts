import type { EnergySnapshot } from './homey-energy-reader';

export type AdviceResult = {
  confidence: number;
  advice: string;
  batteryAdvice: string;
  evAdvice: string;
  savingsToday: number;
};

export class AdviceEngine {
  evaluate(snapshot: EnergySnapshot, mode: string, evChargingThreshold = 250): AdviceResult {
    const exporting = snapshot.gridPower < -250;
    const highImport = snapshot.gridPower > 2500;
    const batteryCharging = snapshot.batteryPower > 100;
    const batteryDischarging = snapshot.batteryPower < -100;
    const evCharging = snapshot.evPower >= evChargingThreshold;

    let advice = 'Energie in balans';
    let batteryAdvice = batteryCharging
      ? 'Batterij laadt'
      : batteryDischarging
        ? 'Batterij ontlaadt'
        : 'Batterij stand-by';
    let evAdvice = evCharging ? 'Auto wordt geladen' : 'Auto wordt niet geladen';

    if (exporting && snapshot.solarPower > 500) {
      advice = `${Math.abs(snapshot.gridPower)} W teruglevering`;
      batteryAdvice = batteryCharging ? 'Batterij gebruikt zon' : 'Batterij laden met zon';
      evAdvice = evCharging ? 'EV gebruikt zonne-overschot' : 'EV-laden kan starten';
    } else if (highImport) {
      advice = `${snapshot.gridPower} W hoge netafname`;
      batteryAdvice = batteryDischarging ? 'Batterij verlaagt piek' : 'Ontladen kan piek verlagen';
      evAdvice = evCharging ? 'EV-laden verlagen' : 'EV-laden uitstellen';
    } else if (snapshot.gridPower < 0) {
      advice = `${Math.abs(snapshot.gridPower)} W teruglevering`;
    } else if (snapshot.gridPower > 0) {
      advice = `${snapshot.gridPower} W netafname`;
    } else if (snapshot.solarPower > 250) {
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
      savingsToday: exporting ? 0.85 : highImport ? 0.45 : 0.15,
    };
  }
}
