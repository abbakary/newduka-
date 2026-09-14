import React, { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatTSh } from '@/utils/translations';

// Fix default marker assets when bundled with Vite
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import icon from 'leaflet/dist/images/marker-icon.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetina,
  iconUrl: icon,
  shadowUrl: shadow,
});

export interface TerritoryMapPoint {
  locationName: string;
  region: string;
  lat: number;
  lng: number;
  totalRevenue: number;
  totalUnitsSold: number;
  activeCustomerCount: number;
}

interface TerritoryLeafletMapProps {
  points: TerritoryMapPoint[];
  isSw?: boolean;
  height?: number;
}

export const TerritoryLeafletMap: React.FC<TerritoryLeafletMapProps> = ({
  points,
  isSw = false,
  height = 320,
}) => {
  const validPoints = useMemo(
    () => points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.totalRevenue > 0),
    [points],
  );

  const center = useMemo((): [number, number] => {
    if (!validPoints.length) return [-6.7924, 39.2083];
    const lat = validPoints.reduce((s, p) => s + p.lat, 0) / validPoints.length;
    const lng = validPoints.reduce((s, p) => s + p.lng, 0) / validPoints.length;
    return [lat, lng];
  }, [validPoints]);

  const maxRev = useMemo(
    () => Math.max(...validPoints.map(p => p.totalRevenue), 1),
    [validPoints],
  );

  if (!validPoints.length) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500"
        style={{ height }}
      >
        {isSw
          ? 'Hakuna data ya mauzo kwa maeneo bado — ongeza anwani za wateja.'
          : 'No territory sales data yet — add customer addresses to see the map.'}
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-inner" style={{ height }}>
      <MapContainer center={center} zoom={11} scrollWheelZoom className="h-full w-full z-0">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validPoints.map(p => {
          const radius = 8 + Math.round((p.totalRevenue / maxRev) * 22);
          return (
            <CircleMarker
              key={`${p.locationName}-${p.lat}-${p.lng}`}
              center={[p.lat, p.lng]}
              radius={radius}
              pathOptions={{
                color: '#0078D4',
                fillColor: '#0078D4',
                fillOpacity: 0.55,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-xs space-y-1 min-w-[140px]">
                  <div className="font-bold text-slate-900">{p.locationName}</div>
                  <div className="text-slate-600">{p.region}</div>
                  <div>
                    {isSw ? 'Mapato' : 'Revenue'}: <strong>{formatTSh(p.totalRevenue)}</strong>
                  </div>
                  <div>
                    {isSw ? 'Vipande' : 'Units'}: <strong>{p.totalUnitsSold}</strong>
                  </div>
                  <div>
                    {isSw ? 'Wateja' : 'Customers'}: <strong>{p.activeCustomerCount}</strong>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
};
