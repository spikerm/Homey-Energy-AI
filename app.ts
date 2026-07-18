import Homey from 'homey';

class EnergyAIApp extends Homey.App {
  private recalculateAction?: Homey.FlowCardAction;

  async onInit(): Promise<void> {
    this.log('Homey Energy AI 0.1.0 started in advisory-only mode');

    this.recalculateAction = this.homey.flow.getActionCard('recalculate_advice');
    this.recalculateAction.registerRunListener(async () => {
      const devices = this.homey.drivers.getDriver('energy_ai').getDevices();

      await Promise.all(devices.map(async device => {
        const recalculate = (device as unknown as { recalculateAdvice: () => Promise<void> }).recalculateAdvice;
        if (typeof recalculate === 'function') {
          await recalculate.call(device);
        }
      }));

      return true;
    });
  }
}

module.exports = EnergyAIApp;
