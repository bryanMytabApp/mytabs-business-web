/**
 * Lazy-load the Google Maps Places API. Only injects the <script> tag the
 * first time it's called; subsequent calls return the same resolved promise.
 *
 * Usage (in a useEffect):
 *   import { loadGoogleMaps } from '../../utils/googleMaps';
 *   useEffect(() => {
 *     loadGoogleMaps().then(() => {
 *       // window.google.maps.places is now available
 *     });
 *   }, []);
 *
 * Why lazy:
 *   The Maps script was previously in index.html, which meant every page
 *   load (Events, Home, Analytics, etc.) made a Places API call even though
 *   only 4 pages actually use autocomplete. This caused rate-limit throttling
 *   from Google and slowed initial page render by ~300-800ms.
 */

const MAPS_API_KEY = 'AIzaSyDuAoPw-2XsoFsUDR-2wRk-0y99GWen2RY';
const MAPS_SCRIPT_ID = 'google-maps-places';

let _promise = null;

export function loadGoogleMaps() {
  // Already loaded (e.g. from a prior navigation to My Business).
  if (window.google && window.google.maps && window.google.maps.places) {
    return Promise.resolve();
  }

  // Already loading — return the in-flight promise.
  if (_promise) return _promise;

  _promise = new Promise((resolve, reject) => {
    // Guard against double-injection if something else loads it.
    if (document.getElementById(MAPS_SCRIPT_ID)) {
      const check = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.places) {
          clearInterval(check);
          resolve();
        }
      }, 50);
      return;
    }

    const script = document.createElement('script');
    script.id = MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });

  return _promise;
}
