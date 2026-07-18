# Homey Energy AI

AI-assisted energy management for Homey Pro.

## First milestone

Version 0.1 is an **advisory-only** Homey SDK v3 app. It creates one virtual Energy AI device and does not directly control batteries, EV chargers, heating or other equipment.

The app is designed to combine, in later milestones:

- dynamic electricity prices;
- PV production and forecasts;
- battery state of charge and power;
- P1 import/export;
- household demand;
- EV charging requirements;
- heating and thermal-buffer information.

## Development

```bash
npm install
npm run build
homey app validate
homey app run
```

## Safety principle

The project starts in observation and advice mode. Automatic control is added only after recommendations can be compared with real outcomes and the user explicitly enables control.
