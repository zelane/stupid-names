// The two maps: one to pick a birthplace, one to show where a name was born.
// maplibregl is loaded as a global by a script tag in index.html.
import { familyBox, localBox } from './codec.js';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const mapOpts = { style: MAP_STYLE, attributionControl: { compact: false } };
const COLOUR = '#c4512d';

// A map with a draggable pin; onPick(lon, lat) runs when someone clicks or drops the pin
export function pickMap(container, [lon, lat], onPick) {
  const map = new maplibregl.Map({ ...mapOpts, container, center: [lon, lat], zoom: 9 });
  const marker = new maplibregl.Marker({ draggable: true }).setLngLat([lon, lat]).addTo(map);
  map.on('click', e => { const p = e.lngLat.wrap(); onPick(p.lng, p.lat); });
  marker.on('dragend', () => { const p = marker.getLngLat().wrap(); onPick(p.lng, p.lat); });
  return {
    pin: (lon, lat) => marker.setLngLat([lon, lat]),
    flyTo: (lon, lat) => map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 9) }),
    easeTo: (lon, lat) => map.easeTo({ center: [lon, lat] })
  };
}

// A map that outlines a person's family area and, inside it, their local square
export function areaMap(container, [lon, lat]) {
  const map = new maplibregl.Map({ ...mapOpts, container, center: [lon, lat], zoom: 8 });
  const ready = new Promise(resolve => map.on('load', () => {
    const empty = { type: 'FeatureCollection', features: [] };
    map.addSource('family', { type: 'geojson', data: empty });
    map.addSource('local', { type: 'geojson', data: empty });
    map.addLayer({ id: 'family-fill', type: 'fill', source: 'family', paint: { 'fill-color': COLOUR, 'fill-opacity': 0.08 } });
    map.addLayer({ id: 'family-line', type: 'line', source: 'family', paint: { 'line-color': COLOUR, 'line-width': 2 } });
    map.addLayer({ id: 'local-fill', type: 'fill', source: 'local', paint: { 'fill-color': COLOUR, 'fill-opacity': 0.3 } });
    map.addLayer({ id: 'local-line', type: 'line', source: 'local', paint: { 'line-color': COLOUR, 'line-width': 1.5 } });
    resolve();
  }));
  const boxGeo = ([w, s, e, n]) => ({ type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] });
  return {
    show: x => ready.then(() => {
      const fam = familyBox(x);
      map.getSource('family').setData(boxGeo(fam));
      map.getSource('local').setData(boxGeo(localBox(x)));
      map.fitBounds([[fam[0], fam[1]], [fam[2], fam[3]]], { padding: 30 });
    })
  };
}
