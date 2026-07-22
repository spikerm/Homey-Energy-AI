import Homey from 'homey';
import { HomeyEnergyReader } from './lib/homey-energy-reader';

const { HomeyAPI } = require('homey-api');

class EnergyAIApp extends Homey.App {
  private energyReader?: HomeyEnergyReader;
  private recalculateAction?: Homey.FlowCardAction;

  override async onInit(): Promise<void> {
    this.log('Homey Energy AI v0.5.0 initialized');

    try {
      const api = await HomeyAPI.createAppAPI({ homey: this.homey });
      this.energyReader = new HomeyEnergyReader(api);
      this.log('Homey Manager API connected');
    } catch (error) {
      this.error('Could not connect to Homey Manager API', error);
    }

    this.recalculateAction = this.homey.flow.getActionCard('recalculate_advice');
    this.recalculateAction.registerRunListener(async () => {
      const devices = this.homey.drivers.getDriver('energy_ai').getDevices();
      await Promise.all(devices.map(async device => {
        const refresh = (device as unknown as { refreshAdvice?: () => Promise<void> }).refreshAdvice;
        if (typeof refresh === 'function') await refresh.call(device);
      }));
      return true;
    });
  }

  async readEnergySnapshot() {
    if (!this.energyReader) throw new Error('Homey Manager API is not available');
    return this.energyReader.read();
  }
}

module.exports = EnergyAIApp;
