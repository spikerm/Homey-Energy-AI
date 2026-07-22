import type { EnergySnapshot } from './homey-energy-reader';

export type AdviceResult = {
  confidence: number;
  advice: string;
  batteryAdvice: string;
  evAdvice: string;
  savingsToday: number;
};

export class AdviceEngine {
  evaluate(snapshot: EnergySnapshot, mode: string): AdviceResult {
    const exporting = snapshot.gridPower < -250;
    const highImport = snapshot.gridPower > 2500;
    let advice = 'Het energiegebruik is momenteel in balans.';
    let batteryAdvice = 'Geen directe batterijactie nodig.';
    let evAdvice = snapshot.evPower > 0 ? 'De auto wordt momenteel geladen.' : 'Geen EV-laadactie nodig.';

    if (exporting && snapshot.solarPower > 500) {
      advice = `Er wordt ongeveer ${Math.abs(snapshot.gridPower)} W teruggeleverd. Gebruik flexibel verbruik.`;
      batteryAdvice = snapshot.batteryPower <= 0
        ? 'Laad de thuisbatterij met het zonne-overschot.'
        : 'De batterij neemt al vermogen op.';
      evAdvice = snapshot.evPower > 0
        ? 'EV-laden gebruikt het zonne-overschot.'
        : 'Start EV-laden wanneer de auto beschikbaar is.';
    } else if (highImport) {
      advice = `De netafname is hoog: ongeveer ${snapshot.gridPower} W. Stel flexibel verbruik uit.`;
      batteryAdvice = snapshot.batteryPower >= 0
        ? 'Overweeg batterijontlading om de verbruikspiek te verlagen.'
        : 'De batterij helpt de netpiek al te beperken.';
      evAdvice = snapshot.evPower > 0
        ? 'Verlaag of pauzeer EV-laden tijdens deze piek.'
        : 'Laat EV-laden voorlopig uitgesteld.';
    } else if (snapshot.gridPower < 0) {
      advice = `Er wordt ongeveer ${Math.abs(snapshot.gridPower)} W teruggeleverd.`;
    } else if (snapshot.gridPower > 0) {
      advice = `De woning neemt ongeveer ${snapshot.gridPower} W van het net af.`;
    }

    if (mode === 'advice') advice += ' Adviesmodus is actief.';

    return {
      confidence: Math.max(20, Math.min(95, 35 + snapshot.sourceCount * 12)),
      advice,
      batteryAdvice,
      evAdvice,
      savingsToday: exporting ? 0.85 : highImport ? 0.45 : 0.15,
    };
  }
}
