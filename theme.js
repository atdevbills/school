/* theme.js — load in <head> on EVERY page (no dependencies).
   Applies the saved colors instantly (from cache) so pages don't flash the default blue.
   The hero banner is NOT themed: it uses --hero-a / --hero-b in style.css or its uploaded image. */
(function () {
  function toRgb(hex) {
    hex = String(hex || "").replace("#", "");
    if (hex.length === 3) hex = hex.split("").map(function (c) { return c + c; }).join("");
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    var n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function toHex(rgb) {
    return "#" + rgb.map(function (v) { return Math.round(v).toString(16).padStart(2, "0"); }).join("");
  }
  function mix(a, b, t) {
    var A = toRgb(a), B = toRgb(b);
    return toHex(A.map(function (v, i) { return v + (B[i] - v) * t; }));
  }

  window.applyThemeColors = function (primary, secondary) {
    var p = toRgb(primary) ? primary : "#1d5de0";
    var s = toRgb(secondary) ? secondary : "#0b2a6f";
    var st = document.documentElement.style;
    st.setProperty("--blue-600", p);
    st.setProperty("--blue-700", mix(p, "#000000", 0.18));
    st.setProperty("--blue-900", s);
    st.setProperty("--blue-100", mix(p, "#ffffff", 0.88));
    st.setProperty("--blue-50", mix(p, "#ffffff", 0.95));
    st.setProperty("--line", mix(p, "#ffffff", 0.85));
    st.setProperty("--primary-rgb", toRgb(p).join(", "));
  };

  window.cacheThemeColors = function (primary, secondary) {
    try { localStorage.setItem("siteTheme", JSON.stringify({ primary: primary, secondary: secondary })); } catch (e) {}
  };

  try {
    var saved = JSON.parse(localStorage.getItem("siteTheme"));
    if (saved) window.applyThemeColors(saved.primary, saved.secondary);
  } catch (e) {}
})();
