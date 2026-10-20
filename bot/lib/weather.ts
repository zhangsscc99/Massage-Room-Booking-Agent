export type WeatherReport =
  | {
      ok: true;
      city: string;
      temperatureC: number;
      condition: string;
      advice: string;
    }
  | {
      ok: false;
      city: string;
      error: string;
    };

const FALLBACK: Record<string, { latitude: number; longitude: number }> = {
  北京: { latitude: 39.9042, longitude: 116.4074 },
  上海: { latitude: 31.2304, longitude: 121.4737 },
  广州: { latitude: 23.1291, longitude: 113.2644 },
  深圳: { latitude: 22.5431, longitude: 114.0579 },
};

type GeoHit = {
  name?: string;
  latitude?: number;
  longitude?: number;
  country_code?: string;
};

export function normalizeCity(city: string): string {
  const trimmed = city.trim().replace(/市$/, "");
  return trimmed.length > 0 ? trimmed : "北京";
}

export async function lookupWeather(city: string): Promise<WeatherReport> {
  const name = normalizeCity(city);
  const place = await geocode(name);
  if (place === undefined) {
    return { ok: false, city: name, error: "没有查到这个城市，请改用北京。" };
  }
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}` +
      `&longitude=${place.longitude}&current=temperature_2m,weather_code&timezone=Asia%2FShanghai`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      return { ok: false, city: name, error: "天气服务暂时不可用。" };
    }
    const body = (await response.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    const temperature = body.current?.temperature_2m;
    const code = body.current?.weather_code;
    if (typeof temperature !== "number" || typeof code !== "number") {
      return { ok: false, city: name, error: "天气服务没有返回当前温度。" };
    }
    const temperatureC = Math.round(temperature * 10) / 10;
    const condition = describeCode(code);
    return {
      ok: true,
      city: name,
      temperatureC,
      condition,
      advice: advise(temperatureC, code, condition),
    };
  } catch {
    return { ok: false, city: name, error: "天气服务暂时不可用。" };
  }
}

async function geocode(city: string): Promise<{ latitude: number; longitude: number } | undefined> {
  const fallback = FALLBACK[city];
  try {
    const url =
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}` +
      "&count=5&language=zh&format=json";
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return fallback;
    const body = (await response.json()) as { results?: GeoHit[] };
    const results = body.results ?? [];
    const picked = results.find((item) => item.country_code === "CN") ?? results[0];
    if (
      picked === undefined ||
      typeof picked.latitude !== "number" ||
      typeof picked.longitude !== "number"
    ) {
      return fallback;
    }
    return { latitude: picked.latitude, longitude: picked.longitude };
  } catch {
    return fallback;
  }
}

function describeCode(code: number): string {
  if (code === 0) return "晴";
  if (code === 1 || code === 2) return "多云";
  if (code === 3) return "阴";
  if (code === 45 || code === 48) return "雾";
  if (code >= 51 && code <= 67) return "雨";
  if (code >= 71 && code <= 77) return "雪";
  if (code >= 80 && code <= 82) return "阵雨";
  if (code >= 85 && code <= 86) return "阵雪";
  if (code >= 95) return "雷雨";
  return "多云";
}

function advise(temperatureC: number, code: number, condition: string): string {
  const parts: string[] = [];
  if (temperatureC >= 35) parts.push("气温高，请注意防晒和补水");
  else if (temperatureC >= 30) parts.push("天气较热，出门请注意防晒");
  else if (temperatureC <= 5) parts.push("气温低，请注意保暖");
  else parts.push(`${condition}，气温适合出门`);
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) {
    parts.push("可能有降水，建议带伞");
  }
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    parts.push("可能有降雪，请注意路滑");
  }
  return parts.join("，");
}
