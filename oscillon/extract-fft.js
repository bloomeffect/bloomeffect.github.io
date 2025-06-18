import fs from 'fs';
import path from 'path';
import { decode } from 'wav-decoder';
import Meyda from 'meyda';

const audioDir = './audio/';
const output = {};

async function analyzeTrack(fileName) {
  const filePath = path.join(audioDir, fileName);
  const buffer = fs.readFileSync(filePath);
  const audioData = await decode(buffer);

  const channelData = audioData.channelData[0]; // mono
  const frameSize = 512;
  const hopSize = 256;
  const sampleRate = audioData.sampleRate;

  const collected = {
    centroid: [],
    spread: [],
    flatness: [],
    rms: [],
    lowEnergy: [],
    midEnergy: [],
    highEnergy: []
  };

  for (let i = 0; i < channelData.length - frameSize; i += hopSize) {
    const frame = channelData.slice(i, i + frameSize);

    const features = Meyda.extract(
      [
        'spectralCentroid',
        'spectralSpread',
        'spectralFlatness',
        'rms',
        'energy',
        'perceptualSpread'
      ],
      frame,
      { sampleRate, bufferSize: frameSize }
    );

    if (features) {
      collected.centroid.push(features.spectralCentroid);
      collected.spread.push(features.spectralSpread);
      collected.flatness.push(features.spectralFlatness);
      collected.rms.push(features.rms);

      // Optional band approximation (basic slices of FFT energy)
      const bands = Meyda.extract(['amplitudeSpectrum'], frame, {
        sampleRate,
        bufferSize: frameSize
      }).amplitudeSpectrum;

      const low = bands.slice(0, 20);
      const mid = bands.slice(20, 100);
      const high = bands.slice(100);

      const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
      collected.lowEnergy.push(avg(low));
      collected.midEnergy.push(avg(mid));
      collected.highEnergy.push(avg(high));
    }
  }

  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

  output[fileName.replace('.wav', '')] = {
    centroid: avg(collected.centroid),
    spread: avg(collected.spread),
    flatness: avg(collected.flatness),
    rms: avg(collected.rms),
    low: avg(collected.lowEnergy),
    mid: avg(collected.midEnergy),
    high: avg(collected.highEnergy)
  };
}

async function main() {
  const files = fs.readdirSync(audioDir).filter(f => f.endsWith('.wav'));
  for (const file of files) {
    console.log(`Analyzing ${file}`);
    await analyzeTrack(file);
  }

  fs.writeFileSync('ribbon-configs.json', JSON.stringify(output, null, 2));
  console.log('✅ Written to ribbon-configs.json');
}

main();
