export type ConfidenceModel = {
  weights: number[];
  bias: number;
};

const DEFAULT_WEIGHTS = [0.25, 0.25, 0.25, 0.25];
const DEFAULT_BIAS = 0;
const TRAINING_STEPS = 200;
const LEARNING_RATE = 0.5;

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function sigmoid(value: number) {
  if (!Number.isFinite(value)) return 0;
  return 1 / (1 + Math.exp(-value));
}

export function predictConfidence(
  features: number[],
  model: ConfidenceModel
): number {
  if (features.length !== model.weights.length) {
    throw new Error("Confidence feature length mismatch.");
  }
  let score = model.bias;
  for (let index = 0; index < features.length; index += 1) {
    const feature = features[index];
    const weight = model.weights[index];
    if (!Number.isFinite(feature) || !Number.isFinite(weight)) {
      throw new Error("Invalid confidence feature or weight.");
    }
    score += feature * weight;
  }
  return clamp(sigmoid(score), 0.05, 0.95);
}

function validateModel(model: ConfidenceModel) {
  if (model.weights.length !== 4) {
    throw new Error("Confidence model weights must be length 4.");
  }
  model.weights.forEach((weight) => {
    if (!Number.isFinite(weight)) {
      throw new Error("Confidence model weights must be finite.");
    }
  });
  if (!Number.isFinite(model.bias)) {
    throw new Error("Confidence model bias must be finite.");
  }
}

export function trainConfidenceModel(
  samples: Array<{ features: number[]; label: number }>
): ConfidenceModel {
  if (samples.length === 0) {
    throw new Error("Cannot train confidence model with no data.");
  }

  let weights = [...DEFAULT_WEIGHTS];
  let bias = DEFAULT_BIAS;

  for (let step = 0; step < TRAINING_STEPS; step += 1) {
    let gradBias = 0;
    const gradWeights = new Array(weights.length).fill(0);
    for (const sample of samples) {
      const label = clamp(sample.label, 0, 1);
      const prediction = predictConfidence(sample.features, {
        weights,
        bias,
      });
      const error = prediction - label;
      const sigmoidGrad = prediction * (1 - prediction);
      gradBias += error * sigmoidGrad;
      for (let index = 0; index < weights.length; index += 1) {
        gradWeights[index] += error * sigmoidGrad * sample.features[index];
      }
    }
    const scale = 1 / samples.length;
    bias -= LEARNING_RATE * gradBias * scale;
    weights = weights.map(
      (weight, index) =>
        weight - LEARNING_RATE * gradWeights[index] * scale
    );
  }

  const model = { weights, bias };
  validateModel(model);
  return model;
}
