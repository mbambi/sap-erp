import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// ─── Forecasting Models ───────────────────────────────────────────────

function movingAverage(data: number[], windowSize: number, horizonPeriods: number): { forecast: number[]; fitted: number[] } {
  const fitted: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < windowSize - 1) {
      fitted.push(data.slice(0, i + 1).reduce((a, b) => a + b, 0) / (i + 1));
    } else {
      fitted.push(data.slice(i - windowSize + 1, i + 1).reduce((a, b) => a + b, 0) / windowSize);
    }
  }
  const lastAvg = data.slice(-windowSize).reduce((a, b) => a + b, 0) / windowSize;
  const forecast = Array(horizonPeriods).fill(Math.round(lastAvg * 100) / 100);
  return { forecast, fitted: fitted.map((v) => Math.round(v * 100) / 100) };
}

function exponentialSmoothing(data: number[], alpha: number, horizonPeriods: number): { forecast: number[]; fitted: number[] } {
  const fitted: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    fitted.push(alpha * data[i] + (1 - alpha) * fitted[i - 1]);
  }
  const lastSmoothed = fitted[fitted.length - 1];
  const forecast = Array(horizonPeriods).fill(Math.round(lastSmoothed * 100) / 100);
  return { forecast, fitted: fitted.map((v) => Math.round(v * 100) / 100) };
}

function holtWinters(data: number[], alpha: number, beta: number, gamma: number, seasonLength: number, horizonPeriods: number): { forecast: number[]; fitted: number[] } {
  if (data.length < seasonLength * 2) {
    // Fallback to double exponential smoothing if not enough data for seasonality
    return doubleExponentialSmoothing(data, alpha, beta, horizonPeriods);
  }

  // Initialize level, trend, seasonals
  const firstSeason = data.slice(0, seasonLength);
  const secondSeason = data.slice(seasonLength, seasonLength * 2);
  let level = firstSeason.reduce((a, b) => a + b, 0) / seasonLength;
  let trend = (secondSeason.reduce((a, b) => a + b, 0) - firstSeason.reduce((a, b) => a + b, 0)) / (seasonLength * seasonLength);
  const seasonal: number[] = firstSeason.map((v) => v / (level || 1));

  const fitted: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const seasonIdx = i % seasonLength;
    const expected = (level + trend) * seasonal[seasonIdx];
    fitted.push(expected);

    const prevLevel = level;
    level = alpha * (data[i] / (seasonal[seasonIdx] || 1)) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    seasonal[seasonIdx] = gamma * (data[i] / (level || 1)) + (1 - gamma) * seasonal[seasonIdx];
  }

  const forecast: number[] = [];
  for (let h = 1; h <= horizonPeriods; h++) {
    const seasonIdx = (data.length + h - 1) % seasonLength;
    forecast.push(Math.round((level + h * trend) * seasonal[seasonIdx] * 100) / 100);
  }

  return { forecast, fitted: fitted.map((v) => Math.round(v * 100) / 100) };
}

function doubleExponentialSmoothing(data: number[], alpha: number, beta: number, horizonPeriods: number): { forecast: number[]; fitted: number[] } {
  let level = data[0];
  let trend = data.length > 1 ? data[1] - data[0] : 0;
  const fitted: number[] = [level];

  for (let i = 1; i < data.length; i++) {
    const prevLevel = level;
    level = alpha * data[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    fitted.push(level + trend);
  }

  const forecast: number[] = [];
  for (let h = 1; h <= horizonPeriods; h++) {
    forecast.push(Math.round((level + h * trend) * 100) / 100);
  }

  return { forecast, fitted: fitted.map((v) => Math.round(v * 100) / 100) };
}

function linearRegression(data: number[], horizonPeriods: number): { forecast: number[]; fitted: number[]; slope: number; intercept: number; r2: number } {
  const n = data.length;
  const x = data.map((_, i) => i + 1);
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = data.reduce((a, b) => a + b, 0) / n;

  let ssXY = 0, ssXX = 0, ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    ssXY += (x[i] - meanX) * (data[i] - meanY);
    ssXX += (x[i] - meanX) ** 2;
  }

  const slope = ssXX > 0 ? ssXY / ssXX : 0;
  const intercept = meanY - slope * meanX;

  const fitted = x.map((xi) => Math.round((slope * xi + intercept) * 100) / 100);

  for (let i = 0; i < n; i++) {
    ssTot += (data[i] - meanY) ** 2;
    ssRes += (data[i] - (slope * x[i] + intercept)) ** 2;
  }
  const r2 = ssTot > 0 ? Math.round((1 - ssRes / ssTot) * 10000) / 10000 : 0;

  const forecast: number[] = [];
  for (let h = 1; h <= horizonPeriods; h++) {
    forecast.push(Math.round((slope * (n + h) + intercept) * 100) / 100);
  }

  return { forecast, fitted, slope: Math.round(slope * 100) / 100, intercept: Math.round(intercept * 100) / 100, r2 };
}

function arima(data: number[], p: number, d: number, q: number, horizonPeriods: number): { forecast: number[]; fitted: number[] } {
  // Simplified ARIMA: differencing + AR
  let working = [...data];

  // Differencing (d times)
  const diffs: number[][] = [];
  for (let i = 0; i < d; i++) {
    diffs.push([...working]);
    const diffed = [];
    for (let j = 1; j < working.length; j++) {
      diffed.push(working[j] - working[j - 1]);
    }
    working = diffed;
  }

  // AR(p) estimation via OLS
  if (working.length <= p) {
    return exponentialSmoothing(data, 0.3, horizonPeriods);
  }

  const yVals = working.slice(p);
  const xMatrix: number[][] = [];
  for (let i = p; i < working.length; i++) {
    const row: number[] = [];
    for (let j = 1; j <= p; j++) {
      row.push(working[i - j]);
    }
    xMatrix.push(row);
  }

  // Simple AR(1) or AR(2) coefficient estimation
  const coeffs: number[] = [];
  if (p >= 1) {
    let num = 0, den = 0;
    for (let i = 0; i < yVals.length; i++) {
      num += yVals[i] * xMatrix[i][0];
      den += xMatrix[i][0] ** 2;
    }
    coeffs.push(den > 0 ? num / den : 0.5);
  }
  for (let j = 1; j < p; j++) {
    coeffs.push(0.1 / j); // Approximate higher-order AR terms
  }

  // Fitted values on differenced series
  const fittedDiff: number[] = Array(p).fill(0);
  for (let i = p; i < working.length; i++) {
    let pred = 0;
    for (let j = 0; j < coeffs.length; j++) {
      pred += coeffs[j] * working[i - j - 1];
    }
    fittedDiff.push(pred);
  }

  // Forecast differenced series
  const forecastDiff: number[] = [];
  const extended = [...working];
  for (let h = 0; h < horizonPeriods; h++) {
    let pred = 0;
    for (let j = 0; j < coeffs.length; j++) {
      pred += coeffs[j] * extended[extended.length - j - 1];
    }
    forecastDiff.push(pred);
    extended.push(pred);
  }

  // Undifference
  let forecastLevel = [...forecastDiff];
  let lastOriginal = data[data.length - 1];
  for (let i = d - 1; i >= 0; i--) {
    const undiffed: number[] = [];
    let prev = lastOriginal;
    for (const v of forecastLevel) {
      prev = prev + v;
      undiffed.push(prev);
    }
    forecastLevel = undiffed;
  }

  // Fitted on original scale (approximate)
  const fitted = data.map((_, i) => {
    if (i < p + d) return data[i];
    const idx = i - d;
    if (idx < 0 || idx >= fittedDiff.length) return data[i];
    let val = fittedDiff[idx];
    for (let dd = 0; dd < d; dd++) {
      val += data[Math.max(0, i - 1)];
    }
    return val;
  });

  return {
    forecast: forecastLevel.map((v) => Math.round(v * 100) / 100),
    fitted: fitted.map((v) => Math.round(v * 100) / 100),
  };
}

function computeConfidenceInterval(data: number[], forecast: number[], confidenceLevel: number = 0.95): Array<{ lower: number; upper: number }> {
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((s, v) => s + (v - mean) ** 2, 0) / data.length;
  const stdDev = Math.sqrt(variance);
  const z = confidenceLevel >= 0.99 ? 2.576 : confidenceLevel >= 0.95 ? 1.96 : confidenceLevel >= 0.9 ? 1.645 : 1.28;

  return forecast.map((f, i) => {
    const width = z * stdDev * Math.sqrt(1 + (i + 1) * 0.1); // Widen with horizon
    return {
      lower: Math.round((f - width) * 100) / 100,
      upper: Math.round((f + width) * 100) / 100,
    };
  });
}

function computeAccuracy(actual: number[], fitted: number[]): { mae: number; mape: number; rmse: number; mse: number } {
  const n = Math.min(actual.length, fitted.length);
  let aeSum = 0, apeSum = 0, seSum = 0, apeCount = 0;

  for (let i = 0; i < n; i++) {
    const err = actual[i] - fitted[i];
    aeSum += Math.abs(err);
    seSum += err ** 2;
    if (actual[i] !== 0) {
      apeSum += Math.abs(err / actual[i]);
      apeCount++;
    }
  }

  return {
    mae: Math.round((aeSum / n) * 100) / 100,
    mape: apeCount > 0 ? Math.round((apeSum / apeCount) * 10000) / 100 : 0,
    rmse: Math.round(Math.sqrt(seSum / n) * 100) / 100,
    mse: Math.round((seSum / n) * 100) / 100,
  };
}

// GET /models - list available models
router.get("/models", (_req: Request, res: Response) => {
  res.json([
    { id: "moving_average", name: "Moving Average", params: [{ name: "windowSize", default: 3, label: "Window Size" }], category: "basic" },
    { id: "exponential_smoothing", name: "Exponential Smoothing", params: [{ name: "alpha", default: 0.3, label: "Alpha (smoothing)" }], category: "basic" },
    { id: "double_exponential", name: "Double Exponential Smoothing (Holt)", params: [{ name: "alpha", default: 0.3, label: "Alpha" }, { name: "beta", default: 0.1, label: "Beta (trend)" }], category: "trend" },
    { id: "holt_winters", name: "Holt-Winters (Triple Exponential)", params: [{ name: "alpha", default: 0.3, label: "Alpha" }, { name: "beta", default: 0.1, label: "Beta" }, { name: "gamma", default: 0.3, label: "Gamma (seasonality)" }, { name: "seasonLength", default: 12, label: "Season Length" }], category: "seasonal" },
    { id: "arima", name: "ARIMA", params: [{ name: "p", default: 2, label: "p (autoregressive)" }, { name: "d", default: 1, label: "d (differencing)" }, { name: "q", default: 0, label: "q (moving average)" }], category: "advanced" },
    { id: "linear_regression", name: "Linear Regression", params: [], category: "trend" },
  ]);
});

// POST /run - run a single forecast
router.post("/run", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { model, materialId, data: customData, horizonPeriods = 6, params = {}, confidenceLevel = 0.95 } = req.body;

    if (!model) throw new AppError(400, "model is required");

    let inputData: number[];

    if (customData && Array.isArray(customData)) {
      inputData = customData.map(Number);
    } else if (materialId) {
      // Gather historical demand from sales order items
      const soItems = await prisma.salesOrderItem.findMany({
        where: { salesOrder: { tenantId }, materialId },
        include: { salesOrder: true },
        orderBy: { salesOrder: { orderDate: "asc" } },
      });

      if (soItems.length < 3) {
        // Fallback to forecasts table
        const forecasts = await prisma.demandForecast.findMany({
          where: { tenantId, materialId },
          orderBy: { period: "asc" },
        });
        inputData = forecasts.length >= 3 ? forecasts.map((f) => f.forecastQuantity) : Array.from({ length: 12 }, () => 50 + Math.random() * 100);
      } else {
        inputData = soItems.map((i) => i.quantity);
      }
    } else {
      throw new AppError(400, "Either materialId or data array required");
    }

    if (inputData.length < 2) throw new AppError(400, "Need at least 2 data points");

    let result: { forecast: number[]; fitted: number[]; extra?: Record<string, unknown> };

    switch (model) {
      case "moving_average":
        result = movingAverage(inputData, params.windowSize ?? 3, horizonPeriods);
        break;
      case "exponential_smoothing":
        result = exponentialSmoothing(inputData, params.alpha ?? 0.3, horizonPeriods);
        break;
      case "double_exponential":
        result = doubleExponentialSmoothing(inputData, params.alpha ?? 0.3, params.beta ?? 0.1, horizonPeriods);
        break;
      case "holt_winters":
        result = holtWinters(inputData, params.alpha ?? 0.3, params.beta ?? 0.1, params.gamma ?? 0.3, params.seasonLength ?? 12, horizonPeriods);
        break;
      case "arima": {
        result = arima(inputData, params.p ?? 2, params.d ?? 1, params.q ?? 0, horizonPeriods);
        break;
      }
      case "linear_regression": {
        const lr = linearRegression(inputData, horizonPeriods);
        result = { forecast: lr.forecast, fitted: lr.fitted, extra: { slope: lr.slope, intercept: lr.intercept, r2: lr.r2 } };
        break;
      }
      default:
        throw new AppError(400, `Unknown model: ${model}`);
    }

    const ci = computeConfidenceInterval(inputData, result.forecast, confidenceLevel);
    const accuracy = computeAccuracy(inputData, result.fitted);

    res.json({
      model,
      inputData,
      forecast: result.forecast,
      fitted: result.fitted,
      confidenceInterval: ci,
      accuracy,
      horizonPeriods,
      ...(result.extra ?? {}),
    });
  } catch (err) {
    next(err);
  }
});

// POST /compare - compare multiple models on the same data
router.post("/compare", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { materialId, data: customData, horizonPeriods = 6, models } = req.body;

    let inputData: number[];
    if (customData && Array.isArray(customData)) {
      inputData = customData.map(Number);
    } else if (materialId) {
      const soItems = await prisma.salesOrderItem.findMany({
        where: { salesOrder: { tenantId }, materialId },
        include: { salesOrder: true },
        orderBy: { salesOrder: { orderDate: "asc" } },
      });
      inputData = soItems.length >= 3 ? soItems.map((i) => i.quantity) : Array.from({ length: 12 }, () => 50 + Math.random() * 100);
    } else {
      throw new AppError(400, "Either materialId or data array required");
    }

    const modelList = models ?? ["moving_average", "exponential_smoothing", "double_exponential", "holt_winters", "arima", "linear_regression"];

    const results: Record<string, { forecast: number[]; fitted: number[]; accuracy: ReturnType<typeof computeAccuracy> }> = {};

    for (const m of modelList) {
      try {
        let r: { forecast: number[]; fitted: number[] };
        switch (m) {
          case "moving_average": r = movingAverage(inputData, 3, horizonPeriods); break;
          case "exponential_smoothing": r = exponentialSmoothing(inputData, 0.3, horizonPeriods); break;
          case "double_exponential": r = doubleExponentialSmoothing(inputData, 0.3, 0.1, horizonPeriods); break;
          case "holt_winters": r = holtWinters(inputData, 0.3, 0.1, 0.3, Math.min(12, Math.floor(inputData.length / 2)), horizonPeriods); break;
          case "arima": r = arima(inputData, 2, 1, 0, horizonPeriods); break;
          case "linear_regression": { const lr = linearRegression(inputData, horizonPeriods); r = { forecast: lr.forecast, fitted: lr.fitted }; break; }
          default: continue;
        }
        results[m] = { ...r, accuracy: computeAccuracy(inputData, r.fitted) };
      } catch {
        // Skip failed models
      }
    }

    // Rank by MAPE
    const ranking = Object.entries(results)
      .sort(([, a], [, b]) => a.accuracy.mape - b.accuracy.mape)
      .map(([model, r], i) => ({ rank: i + 1, model, mape: r.accuracy.mape, mae: r.accuracy.mae, rmse: r.accuracy.rmse }));

    res.json({
      inputData,
      horizonPeriods,
      results,
      ranking,
      bestModel: ranking[0]?.model ?? "unknown",
    });
  } catch (err) {
    next(err);
  }
});

// POST /generate-data - generate synthetic demand data for testing
router.post("/generate-data", (_req: Request, res: Response) => {
  const { periods = 36, pattern = "seasonal", baseDemand = 100, noise = 15 } = _req.body;

  const data: number[] = [];
  for (let i = 0; i < periods; i++) {
    let d = baseDemand;
    if (pattern === "seasonal") d += 30 * Math.sin((2 * Math.PI * i) / 12);
    else if (pattern === "trending") d += 3 * i;
    else if (pattern === "seasonal_trending") d += 3 * i + 30 * Math.sin((2 * Math.PI * i) / 12);
    else if (pattern === "step") d += i >= periods / 2 ? 50 : 0;
    d += (Math.random() - 0.5) * 2 * noise;
    data.push(Math.round(Math.max(0, d)));
  }

  res.json({ data, pattern, periods, baseDemand, noise });
});

export default router;
