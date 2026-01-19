import { extractDecisionFeatures } from "./decisionConfidenceFeatures";
import type { ConsolidatedDecisionMoment } from "../utils/consolidateDecisionMoments";

export type ConfidenceModel = {
  weights: number[];
  bias: number;
};

const DEFAULT_WEIGHTS = [0.25, 0.25, 0.25, 0.25];
const DEFAULT_BIAS = 0;
const TRAINING_STEPS = 200;
const LEARNING_RATE = 0.5;

let cachedModel: ConfidenceModel | null = null;
let cachedKey: string | null = null;

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
    throw new Error("Confidence features length mismatch.");
  }
  let score = model.bias;
  for (let index = 0; index < features.length; index += 1) {
    const feature = features[index];
    const weight = model.weights[index];
    if (!Number.isFinite(feature) || !Number.isFinite(weight)) {
      throw new Error("Invalid confidence feature/weight.");
    }
    score += feature * weight;
  }
  return clamp(sigmoid(score), 0.05, 0.95);
}

function validateModel(model: ConfidenceModel) {
  if (model.weights.length !== 4) {
    throw new Error("Confidence model weights must be length 4.");
  }
  if (!Number.isFinite(model.bias)) {
    throw new Error("Confidence model bias must be finite.");
  }
  model.weights.forEach((weight) => {
    if (!Number.isFinite(weight)) {
      throw new Error("Confidence model weights must be finite.");
    }
  });
}

export function trainConfidenceModel(
  decisions: ConsolidatedDecisionMoment[]
): ConfidenceModel {
  if (decisions.length === 0) {
    throw new Error("Cannot train confidence model with no data.");
  }

  let weights = [...DEFAULT_WEIGHTS];
  let bias = DEFAULT_BIAS;

  for (let step = 0; step < TRAINING_STEPS; step += 1) {
    let gradBias = 0;
    const gradWeights = new Array(weights.length).fill(0);
    for (const decision of decisions) {
      const features = extractDecisionFeatures(decision);
      const label = clamp(
        decision.heuristic_confidence_score ??
          decision.confidence_score ??
          0,
        0,
        1
      );
      const prediction = predictConfidence(
        features,
        { weights, bias }
      );
      const error = prediction - label;
      const sigmoidGrad = prediction * (1 - prediction);
      gradBias += error * sigmoidGrad;
      for (let index = 0; index < weights.length; index += 1) {
        gradWeights[index] += error * sigmoidGrad * features[index];
      }
    }
    const scale = 1 / decisions.length;
    bias -= LEARNING_RATE * gradBias * scale;
    weights = weights.map(
      (weight, index) =>
        weight - LEARNING_RATE * gradWeights[index] * scale
    );
  }

  const model = { weights, bias };
  validateModel(model);

  let minConfidence = 1;
  let maxConfidence = 0;
  for (const decision of decisions) {
    const features = extractDecisionFeatures(decision);
    const prediction = predictConfidence(features, model);
    minConfidence = Math.min(minConfidence, prediction);
    maxConfidence = Math.max(maxConfidence, prediction);
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `Confidence model range: ${minConfidence.toFixed(
        3
      )}–${maxConfidence.toFixed(3)}`
    );
  }

  if (maxConfidence - minConfidence < 0.05) {
    throw new Error("Confidence model training is degenerate.");
  }

  return model;
}

export function getOrTrainConfidenceModel(
  decisions: ConsolidatedDecisionMoment[],
  cacheKey: string
): ConfidenceModel {
  if (cachedModel && cachedKey === cacheKey) {
    return cachedModel;
  }
  const model = trainConfidenceModel(decisions);
  cachedModel = model;
  cachedKey = cacheKey;
  return model;
}

export function resetConfidenceModelCache() {
  cachedModel = null;
  cachedKey = null;
}
