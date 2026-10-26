const palettes = {
  clear:    ["#FFE08A", "#FFD3AE", "#FFC9C9"],
  cloudy:   ["#CFE3F7", "#DAD5F6", "#CDEBD9"],
  overcast: ["#DEDDE8", "#D7E3DE", "#E8DED2"],
  rain:     ["#BFDAF3", "#C8D6F2", "#BDE4E1"],
  none:     ["#FFE08A", "#CFE3F7", "#CDEBD9"],
};

export function swipeColor(weather = "", week = 0) {
  const w = weather.toLowerCase();
  const key =
    /rain|shower|drizzle|storm/.test(w) ? "rain" :
    /overcast/.test(w)                  ? "overcast" :
    /cloud/.test(w)                     ? "cloudy" :
    /clear|sun/.test(w)                 ? "clear" :
                                          "none";
  const p = palettes[key];
  return p[week % p.length];
}
