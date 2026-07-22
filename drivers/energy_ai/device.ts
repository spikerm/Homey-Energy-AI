import Homey from 'homey';

class EnergyAIDevice extends Homey.Device {
  private adviceChangedTrigger?: Homey.FlowCardTriggerDevice;

  override async onInit(): Promise<void> {
    this.adviceChangedTrigger = this.homey.flow.getDeviceTriggerCard('advice_changed');

    await this.ensureCapabilities();

    await this.setCapabilityValue('energy_ai_mode', 'observe');
    await this.setCapabilityValue('energy_ai_score', 0);
    await this.setCapabilityValue(
      'energy_ai_advice',
      this.homey.__('advice.collecting_data'),
    );
    await this.setCapabilityValue('energy_ai_savings_today', 0);

    this.log('Energy AI device initialized');
  }

  private async ensureCapabilities(): Promise<void> {
    const requiredCapabilities = [
      'energy_ai_mode',
      'energy_ai_score',
      'energy_ai_advice',
      'energy_ai_savings_today',
    ];

    for (const capability of requiredCapabilities) {
      if (!this.hasCapability(capability)) {
        this.log(`Adding missing capability: ${capability}`);
        await this.addCapability(capability);
      }
    }
  }

  async recalculateAdvice(): Promise<void> {
    const advice = this.homey.__('advice.observation_only');
    const confidence = 10;

    await this.setCapabilityValue('energy_ai_mode', 'advice');
    await this.setCapabilityValue('energy_ai_advice', advice);
    await this.setCapabilityValue('energy_ai_score', confidence);

    if (this.adviceChangedTrigger) {
      await this.adviceChangedTrigger.trigger(
        this,
        {
          advice,
          confidence,
        },
        {},
      );
    }
  }
}

module.exports = EnergyAIDevice;
