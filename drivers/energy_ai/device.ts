import Homey from 'homey';
import { AdviceEngine, type AdviceThresholds } from '../../lib/advice-engine';
import type { EnergySnapshot } from '../../lib/homey-energy-reader';

type EnergyAIApp = Homey.App & {
  readEnergySnapshot: () => Promise<EnergySnapshot>;
};

class EnergyAIDevice extends Homey.Device {
  private adviceChangedTrigger?: Homey.FlowCardTriggerDevice;
  private refreshTimer?: NodeJS.Timeout;
  private readonly adviceEngine = new AdviceEngine();

  override async onInit(): Promise<void> {
    this.adviceChangedTrigger = this.homey.flow.getDeviceTriggerCard('advice_changed');
    await this.ensureCapabilities();
    this.log('Energy AI v0.6.0 device initialized');
    await this.refreshAdvice();
    this.startRefreshTimer();
  }

  override async onDeleted(): Promise<void> {
    this.stopRefreshTimer();
  }

  override async onSettings(): Promise<string | void> {
    this.startRefreshTimer();
    await this.refreshAdvice();
    return 'Instellingen opgeslagen';
  }

  private getNumberSetting(id: string, fallback: number, minimum = 0): number {
    const configured = Number(this.getSetting(id) ?? fallback);
    return Number.isFinite(configured) ? Math.max(minimum, configured) : fallback;
  }

  private getThresholds(): AdviceThresholds {
    return {
      evChargingPower: this.getNumberSetting('ev_charging_threshold', 250),
      batteryActivePower: this.getNumberSetting('battery_active_threshold', 100),
      gridDeadbandPower: this.getNumberSetting('grid_deadband_threshold', 100),
      highImportPower: this.getNumberSetting('high_import_threshold', 2500),
      solarSurplusPower: this.getNumberSetting('solar_surplus_threshold', 500),
    };
  }

  private startRefreshTimer(): void {
    this.stopRefreshTimer();
    const refreshSeconds = this.getNumberSetting('refresh_interval_seconds', 60, 10);
    this.refreshTimer = this.homey.setInterval(() => {
      this.refreshAdvice().catch(this.error);
    }, refreshSeconds * 1000);
    this.log(`Energy refresh interval: ${refreshSeconds} seconds`);
  }

  private stopRefreshTimer(): void {
    if (this.refreshTimer) {
      this.homey.clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  private async ensureCapabilities(): Promise<void> {
    const required = [
      'energy_ai_mode', 'energy_ai_score', 'energy_ai_energy_score',
      'energy_ai_self_consumption', 'energy_ai_advice',
      'energy_ai_savings_today', 'energy_ai_grid_power',
      'energy_ai_consumption_power', 'energy_ai_solar_power',
      'energy_ai_battery_power', 'energy_ai_ev_power',
      'energy_ai_battery_advice', 'energy_ai_ev_advice',
      'energy_ai_data_status', 'energy_ai_last_update',
    ];

    for (const capability of required) {
      if (!this.hasCapability(capability)) {
        this.log(`Adding missing capability: ${capability}`);
        await this.addCapability(capability);
      }
    }
  }

  async recalculateAdvice(): Promise<void> {
    await this.refreshAdvice();
  }

  async refreshAdvice(): Promise<void> {
    try {
      const snapshot = await (this.homey.app as EnergyAIApp).readEnergySnapshot();
      const mode = String(this.getCapabilityValue('energy_ai_mode') ?? 'observe');
      const thresholds = this.getThresholds();

      const filteredSnapshot: EnergySnapshot = {
        ...snapshot,
        evPower: snapshot.evPower >= thresholds.evChargingPower ? snapshot.evPower : 0,
        batteryPower: Math.abs(snapshot.batteryPower) >= thresholds.batteryActivePower
          ? snapshot.batteryPower
          : 0,
        gridPower: Math.abs(snapshot.gridPower) >= thresholds.gridDeadbandPower
          ? snapshot.gridPower
          : 0,
      };

      const result = this.adviceEngine.evaluate(filteredSnapshot, mode, thresholds);
      const updateTime = new Date().toLocaleTimeString('nl-NL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      await Promise.all([
        this.setCapabilityValue('energy_ai_grid_power', filteredSnapshot.gridPower),
        this.setCapabilityValue('energy_ai_consumption_power', snapshot.consumptionPower),
        this.setCapabilityValue('energy_ai_solar_power', snapshot.solarPower),
        this.setCapabilityValue('energy_ai_battery_power', filteredSnapshot.batteryPower),
        this.setCapabilityValue('energy_ai_ev_power', filteredSnapshot.evPower),
        this.setCapabilityValue('energy_ai_score', result.confidence),
        this.setCapabilityValue('energy_ai_energy_score', result.energyScore),
        this.setCapabilityValue('energy_ai_self_consumption', result.selfConsumption),
        this.setCapabilityValue('energy_ai_advice', result.advice),
        this.setCapabilityValue('energy_ai_savings_today', result.savingsToday),
        this.setCapabilityValue('energy_ai_battery_advice', result.batteryAdvice),
        this.setCapabilityValue('energy_ai_ev_advice', result.evAdvice),
        this.setCapabilityValue('energy_ai_data_status', `${snapshot.sourceCount} bronnen gevonden`),
        this.setCapabilityValue('energy_ai_last_update', updateTime),
      ]);

      if (this.adviceChangedTrigger) {
        await this.adviceChangedTrigger.trigger(this, {
          advice: result.advice,
          confidence: result.confidence,
        }, {});
      }

      await this.setAvailable();
    } catch (error) {
      this.error('Energy refresh failed', error);
      const message = error instanceof Error ? error.message : 'Onbekende fout';
      await this.setCapabilityValue('energy_ai_data_status', `Leesfout: ${message}`);
    }
  }
}

module.exports = EnergyAIDevice;
