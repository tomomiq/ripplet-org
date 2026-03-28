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

export interface WeatherData {
  icon: string;
  temp: number;
}

const geocodeCache = new Map<string, { lat: number; lon: number } | null>();

async function geocode(city: string): Promise<{ lat: number; lon: number } | null> {
  if (geocodeCache.has(city)) return geocodeCache.get(city)!;
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) { geocodeCache.set(city, null); console.log(`[weather] geocode non-ok: ${res.status} for ${city}`); return null; }
    const data = await res.json();
    const r = data.results?.[0];
    if (!r) { geocodeCache.set(city, null); console.log(`[weather] geocode no results for ${city}`); return null; }
    const result = { lat: r.latitude as number, lon: r.longitude as number };
    geocodeCache.set(city, result);
    return result;
  } catch (e) {
    console.log(`[weather] geocode fetch threw: ${e} for ${city}`);
    geocodeCache.set(city, null);
    return null;
  }
}

export async function fetchWeatherForPost(location: string, pubDate: Date): Promise<WeatherData | null> {
  console.log(`[weather] called for: ${location} on ${pubDate.toISOString().slice(0, 10)}`);
  const coords = await geocode(location);
  if (!coords) {
    console.log(`[weather] geocode failed for: ${location}`);
    return null;
  }

  const date = pubDate.toISOString().slice(0, 10);
  const url = 'https://archive-api.open-meteo.com/v1/archive'
    + `?latitude=${coords.lat.toFixed(4)}`
    + `&longitude=${coords.lon.toFixed(4)}`
    + `&start_date=${date}`
    + `&end_date=${date}`
    + '&hourly=temperature_2m,weathercode'
    + '&timezone=auto';

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.log(`[weather] archive fetch failed: ${res.status} for ${location} on ${date}`);
      return null;
    }
    const data = await res.json();

    const hours  = data.hourly.time           as string[];
    const temps  = data.hourly.temperature_2m as number[];
    const codes  = data.hourly.weathercode    as number[];

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

    const result = { icon: iconMap[dominantCode] ?? '🌡️', temp: avgTemp };
    console.log(`[weather] success for ${location}: ${result.icon} ${result.temp}°C`);
    return result;
  } catch (e) {
    console.log(`[weather] archive fetch threw: ${e} for ${location} on ${date}`);
    return null;
  }
}
