import Homey from 'homey';

class EnergyAIDriver extends Homey.Driver {
  async onInit(): Promise<void> {
    this.log('Energy AI driver initialized');
  }

  async onPairListDevices(): Promise<Array<{ name: string; data: { id: string } }>> {
    return [
      {
        name: 'Energy AI',
        data: {
          id: 'energy-ai-core',
        },
      },
    ];
  }
}

module.exports = EnergyAIDriver;
