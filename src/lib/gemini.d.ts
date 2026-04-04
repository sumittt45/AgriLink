export interface CropForecastResult {
  profitable_crops: { name: string; reason: string }[];
  low_crops: { name: string; reason: string }[];
  raw: string;
}

export interface CropGuideResult {
  crop: string;
  steps: string[];
  estimated_cost: string;
  expected_profit: string;
  time_to_harvest: string;
  tips: string[];
}

export interface CropDetailResult {
  howToGrow: string;
  estimatedCost: string;
  estimatedProfit: string;
  timeToHarvest: string;
}

export function getCropForecast(state: string, city: string, language?: string): Promise<CropForecastResult>;
export function getCropGuide(cropName: string, state: string, city: string, language?: string): Promise<CropGuideResult>;
export function getCropDetail(cropName: string, state: string, language?: string): Promise<CropDetailResult>;
