// Fetch weather icon + temperature for a location and date at build time.
// Uses Open-Meteo geocoding + archive APIs (no API key required).
// Geocode results are cached in memory so the same city is only looked up once per build.

const iconMap: Record<number, string> = {
  0:'☀️', 1:'🌤️', 2:'⛅', 3:'☁️',
  45:'🌫️', 48:'🌫️',
  51:'🌦️', 53:'🌦️', 55:'🌦️',
  61:'🌧️', 63:'🌧️', 65:'🌧️',
  71:'❄️', 73:'❄️', 75:'❄️', 77:'❄️',
  80:'🌦️', 81:'🌦️', 82:'🌦️',
  85:'❄️', 86:'❄️',
  95:'⛈️', 96:'⛈️', 99:'⛈️',
};

function describe(code: number, temp: number, location: string): string {
  const loc = location.toLowerCase();
  if (code === 0) return temp > 20 ? 'Brilliant sunshine' : 'Clear blue skies';
  if (code === 1) return 'Mostly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) {
    if (temp < 4)  return 'A bitterly grey day';
    if (temp < 10) return loc === 'paris' ? 'The usual Parisian grey' : 'Low grey clouds';
    if (temp < 16) return 'Grey and overcast';
    return 'Overcast but warm';
  }
  if (code === 45 || code === 48) return 'A foggy morning';
  if (code === 51 || code === 53 || code === 55) return 'A light drizzle';
  if (code === 61 || code === 63) return 'Rainy';
  if (code === 65) return 'Heavy rain';
  if (code === 71 || code === 73) return 'Snowy';
  if (code === 75) return 'Heavy snow';
  if (code === 77) return 'Snow flurries';
  if (code === 80 || code === 81 || code === 82) return 'Scattered showers';
  if (code === 85 || code === 86) return 'Snow showers';
  if (code === 95 || code === 96 || code === 99) return 'Thundery skies';
  return 'Mixed conditions';
}

export interface WeatherData {
  icon: string;
  temp: number;
  description: string;
}

const geocodeCache = new Map<string, { lat: number; lon: number } | null>();

async function geocode(city: string): Promise<{ lat: number; lon: number } | null> {
  if (geocodeCache.has(city)) return geocodeCache.get(city)!;
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) { geocodeCache.set(city, null); return null; }
    const data = await res.json();
    const r = data.results?.[0];
    if (!r) { geocodeCache.set(city, null); return null; }
    const result = { lat: r.latitude as number, lon: r.longitude as number };
    geocodeCache.set(city, result);
    return result;
  } catch {
    geocodeCache.set(city, null);
    return null;
  }
}

export async function fetchWeatherForPost(location: string, pubDate: Date): Promise<WeatherData | null> {
  const coords = await geocode(location);
  if (!coords) return null;

  const date = pubDate.toISOString().slice(0, 10);
  const url = 'https://archive-api.open-meteo.com/v1/archive'
    + `?latitude=${coords.lat.toFixed(4)}`
    + `&longitude=${coords.lon.toFixed(4)}`
    + `&start_date=${date}`
    + `&end_date=${date}`
    + '&hourly=temperature_2m,weather_code'
    + '&timezone=auto';

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();

    const hours  = data.hourly?.time           as string[] | undefined;
    const temps  = data.hourly?.temperature_2m as number[] | undefined;
    const codes  = data.hourly?.weather_code   as number[] | undefined;

    if (!hours || !temps || !codes) {
      console.warn('[weather] Unexpected API response shape:', JSON.stringify(data).slice(0, 200));
      return null;
    }

    // Keep only midday hours (10am–2pm local time)
    const midday = hours.reduce<{ temp: number; code: number }[]>((acc, t, i) => {
      const h = parseInt(t.slice(11, 13));
      if (h >= 10 && h <= 14) acc.push({ temp: temps[i], code: codes[i] });
      return acc;
    }, []);

    if (!midday.length) return null;

    const avgTemp = Math.round(midday.reduce((s, h) => s + h.temp, 0) / midday.length);

    // Most common weather code over the window
    const counts = midday.reduce<Record<number, number>>((acc, h) => {
      acc[h.code] = (acc[h.code] || 0) + 1;
      return acc;
    }, {});
    const dominantCode = parseInt(
      Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    );

    return {
      icon: iconMap[dominantCode] ?? '🌡️',
      temp: avgTemp,
      description: describe(dominantCode, avgTemp, location),
    };
  } catch {
    return null;
  }
}
