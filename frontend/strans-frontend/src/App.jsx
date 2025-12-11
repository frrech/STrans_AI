import { useState, useEffect } from 'react';
import { Truck, Zap, MapPin, Navigation, Info } from 'lucide-react';

// Leaflet / React-Leaflet
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Corrige ícones padrão do Leaflet em bundlers (Vite, CRA etc.)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// ----------------- Helpers de Geolocalização -----------------

// Bounding boxes aproximados das regiões metropolitanas
const REGIOES = [
  {
    nome: 'São Paulo (Região Metropolitana)',
    sigla: 'SP',
    // lat, lng (aprox)
    bounds: {
      latMin: -24.2,
      latMax: -22.8,
      lngMin: -47.5,
      lngMax: -45.8,
    },
  },
  {
    nome: 'Rio de Janeiro (Região Metropolitana)',
    sigla: 'RJ',
    bounds: {
      latMin: -23.2,
      latMax: -22.6,
      lngMin: -43.8,
      lngMax: -43.0,
    },
  },
  {
    nome: 'Belo Horizonte (Região Metropolitana)',
    sigla: 'BH',
    bounds: {
      latMin: -20.1,
      latMax: -19.7,
      lngMin: -44.2,
      lngMax: -43.7,
    },
  },
];

function encontrarRegiao(lat, lng) {
  for (const reg of REGIOES) {
    const { latMin, latMax, lngMin, lngMax } = reg.bounds;
    if (lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax) {
      return reg;
    }
  }
  return null;
}

// Distância Haversine em km
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // raio da Terra em km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Componente interno para capturar cliques no mapa
function ClickHandler({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng);
    },
  });
  return null;
}

// ----------------- App -----------------

function App() {
  const [formData, setFormData] = useState({
    origem: '',
    destino: '',
    distancia: '',
    tipoCarga: 'pequena',
    urgencia: false,
  });

  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // coordenadas brutas das escolhas
  const [origemCoord, setOrigemCoord] = useState(null);
  const [destinoCoord, setDestinoCoord] = useState(null);

  // qual ponto estamos selecionando no mapa agora?
  const [selectionMode, setSelectionMode] = useState('origem'); // 'origem' | 'destino'

  // Atualiza distância automaticamente quando origem e destino mudam
  useEffect(() => {
    if (origemCoord && destinoCoord) {
      const dist = haversineKm(
        origemCoord.lat,
        origemCoord.lng,
        destinoCoord.lat,
        destinoCoord.lng
      );
      // arredonda para 3 casas para enviar para a API
      const distFixed = dist.toFixed(3);
      setFormData((prev) => ({
        ...prev,
        distancia: distFixed,
      }));
    }
  }, [origemCoord, destinoCoord]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResultado(null);

    if (!formData.distancia) {
      setError('Selecione origem e destino no mapa para calcular a distância.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/rotas/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Erro ao conectar com a IA da STrans.');

      const data = await response.json();
      setResultado(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getVehicleIcon = (vehicle) => {
    if (!vehicle) return null;
    switch (vehicle.toLowerCase()) {
      case 'moto':
        return '🏍️';
      case 'bike':
        return '🚲';
      case 'van':
        return '🚐';
      case 'caminhao':
        return '🚛';
      default:
        return '📦';
    }
  };

  // Quando o usuário clica no mapa
  const handleMapClick = (latlng) => {
    const { lat, lng } = latlng;
    const regiao = encontrarRegiao(lat, lng);

    if (!regiao) {
      setError(
        'Apenas pontos dentro das regiões metropolitanas de São Paulo, Rio de Janeiro e Belo Horizonte são permitidos.'
      );
      return;
    }

    setError(null); // limpa erros anteriores

    if (selectionMode === 'origem') {
      setOrigemCoord({ lat, lng });
      setFormData((prev) => ({
        ...prev,
        origem: `${regiao.sigla} - (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      }));
    } else {
      setDestinoCoord({ lat, lng });
      setFormData((prev) => ({
        ...prev,
        destino: `${regiao.sigla} - (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      }));
    }
  };

  // labels amigáveis para mostrar abaixo do mapa
  const origemLabel =
    origemCoord &&
    `Origem: ${formData.origem || ''}`;
  const destinoLabel =
    destinoCoord &&
    `Destino: ${formData.destino || ''}`;

  // Centro inicial do mapa: São Paulo
  const initialCenter = [-23.55, -46.63];
  const initialZoom = 7;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-blue-900 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tighter">
              STrans<span className="text-orange-500">.</span>
            </h1>
            <p className="text-xs text-blue-200">
              Logística Inteligente &copy; 2025
            </p>
          </div>
          <div className="text-sm bg-blue-800 px-3 py-1 rounded-full flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            IA Online
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-slate-800 mb-2">
            Otimizador de Transporte
          </h2>
          <p className="text-slate-500 max-w-lg mx-auto">
            Nossa IA analisa sua entrega e escolhe entre Moto, Bike, Van ou
            Caminhão para garantir o menor custo e maior eficiência.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* FORMULÁRIO */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-slate-700">
              <Navigation size={20} className="text-blue-600" /> Dados da
              Entrega
            </h3>

            {/* MAPA */}
            <div className="mb-5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-600">
                  Selecione Origem e Destino no mapa
                </span>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectionMode('origem')}
                    className={`px-2 py-1 rounded-full border ${
                      selectionMode === 'origem'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    Origem
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectionMode('destino')}
                    className={`px-2 py-1 rounded-full border ${
                      selectionMode === 'destino'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    Destino
                  </button>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden border border-slate-200">
                <MapContainer
                  center={initialCenter}
                  zoom={initialZoom}
                  style={{ height: '260px', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <ClickHandler onSelect={handleMapClick} />

                  {origemCoord && (
                    <Marker position={origemCoord}>
                      <Popup>Origem</Popup>
                    </Marker>
                  )}

                  {destinoCoord && (
                    <Marker
                      position={destinoCoord}
                      icon={L.icon({
                        iconUrl: markerIcon,
                        iconRetinaUrl: markerIcon2x,
                        shadowUrl: markerShadow,
                        iconAnchor: [12, 41],
                      })}
                    >
                      <Popup>Destino</Popup>
                    </Marker>
                  )}
                </MapContainer>
              </div>

              <div className="mt-2 text-[11px] text-slate-500 space-y-1">
                {origemLabel && <p>{origemLabel}</p>}
                {destinoLabel && <p>{destinoLabel}</p>}
              </div>
            </div>

            {/* FORMULARIO TEXTO */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Origem (preenchido pelo mapa)
                  </label>
                  <input
                    name="origem"
                    value={formData.origem}
                    readOnly
                    className="w-full p-2.5 bg-slate-100 border rounded-lg text-xs text-slate-600 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Destino (preenchido pelo mapa)
                  </label>
                  <input
                    name="destino"
                    value={formData.destino}
                    readOnly
                    className="w-full p-2.5 bg-slate-100 border rounded-lg text-xs text-slate-600 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Distância Calculada (Km)
                </label>
                <div className="relative">
                  <MapPin
                    size={18}
                    className="absolute left-3 top-3 text-slate-400"
                  />
                  <input
                    name="distancia"
                    value={formData.distancia}
                    readOnly
                    className="w-full pl-10 p-2.5 bg-slate-100 border rounded-lg text-sm text-slate-700 cursor-not-allowed"
                    placeholder="Selecione origem e destino no mapa"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Tamanho da Carga
                  </label>
                  <select
                    name="tipoCarga"
                    value={formData.tipoCarga}
                    className="w-full p-2.5 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                    onChange={handleChange}
                  >
                    <option value="pequena">✉️ Pequena</option>
                    <option value="media">📦 Média</option>
                    <option value="grande">🚛 Grande</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <label
                    className={`flex items-center justify-center w-full p-2.5 border rounded-lg cursor-pointer transition select-none ${
                      formData.urgencia
                        ? 'bg-orange-50 border-orange-200 text-orange-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="urgencia"
                      className="hidden"
                      onChange={handleChange}
                    />
                    <Zap
                      size={18}
                      className={`mr-2 ${
                        formData.urgencia ? 'fill-orange-500' : ''
                      }`}
                    />
                    {formData.urgencia ? 'Urgente!' : 'Normal'}
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {loading ? 'Processando com IA...' : 'Calcular Melhor Veículo'}
              </button>
            </form>
          </div>

          {/* RESULTADO */}
          <div className="relative">
            {!resultado && !loading && !error && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl p-6">
                <Truck size={48} className="mb-4 opacity-20" />
                <p>
                  Preencha os dados ao lado e selecione origem/destino no mapa
                  para obter uma análise completa da sua entrega.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-2 mb-4">
                <Info size={20} /> {error}
              </div>
            )}

            {resultado && (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-blue-100 animate-fade-in-up">
                <div
                  className={`p-6 text-white text-center relative overflow-hidden transition-colors duration-500 ${
                    formData.urgencia ? 'bg-orange-600' : 'bg-blue-600'
                  }`}
                >
                  <div className="absolute top-0 left-0 w-full h-full bg-white opacity-5 transform -skew-y-6 scale-150"></div>
                  <p className="text-white/80 text-sm uppercase tracking-widest font-semibold mb-1">
                    Melhor Opção
                  </p>
                  <div className="text-6xl mb-2 filter drop-shadow-md">
                    {getVehicleIcon(resultado.escolha)}
                  </div>
                  <h2 className="text-3xl font-bold capitalize">
                    {resultado.escolha}
                  </h2>
                  {formData.urgencia && (
                    <span className="inline-block mt-2 text-xs bg-white/20 px-2 py-1 rounded font-bold">
                      ⏱️ Prioridade Alta
                    </span>
                  )}
                </div>

                <div className="p-6 space-y-6">
                  <div className="flex justify-between items-center pb-6 border-b border-slate-100">
                    <div>
                      <p className="text-slate-400 text-xs uppercase font-bold">
                        Custo Estimado
                      </p>
                      <p className="text-3xl font-bold text-slate-800">
                        R$ {resultado.precoEstimado.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400 text-xs uppercase font-bold">
                        Tempo Estimado
                      </p>
                      <p className="text-3xl font-bold text-slate-800">
                        {resultado.tempoEstimadoMin}{' '}
                        <span className="text-lg text-slate-500 font-normal">
                          min
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-center text-xs text-slate-400 font-bold uppercase mb-2">
                      Comparativo de Custo
                    </p>

                    {resultado.qvals && (
                      <div className="grid grid-cols-4 gap-2 h-32 items-end bg-slate-50 p-2 rounded-lg border border-slate-100">
                        {(() => {
                          const costs = resultado.qvals.map((v) => Math.abs(v));
                          const maxCost = Math.max(...costs);
                          const minCost = Math.min(...costs);
                          const range = maxCost - minCost || 1;

                          const veiculos = ['Moto', 'Bike', 'Van', 'Caminhão'];

                          return costs.map((cost, idx) => {
                            const isSelected =
                              (resultado.actionIndex ?? -1) === idx;

                            const relativePct = (cost - minCost) / range;
                            const heightCss = 15 + relativePct * 85;

                            return (
                              <div
                                key={idx}
                                className="flex flex-col items-center group h-full justify-end relative"
                              >
                                <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] py-1 px-2 rounded shadow-lg pointer-events-none z-10 whitespace-nowrap">
                                  Pontuação: {cost.toFixed(0)}
                                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 w-2 h-2 bg-slate-800 rotate-45"></div>
                                </div>

                                <div
                                  className={`w-full rounded-t-md transition-all duration-700 ${
                                    isSelected
                                      ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]'
                                      : 'bg-red-300 opacity-60 hover:opacity-100 hover:bg-red-400'
                                  }`}
                                  style={{ height: `${heightCss}%` }}
                                ></div>

                                <div className="text-center mt-2">
                                  <span
                                    className={`block text-[10px] font-bold uppercase ${
                                      isSelected
                                        ? 'text-green-700'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    {veiculos[idx]}
                                  </span>
                                  <span className="text-[9px] text-slate-300">
                                    {cost.toFixed(0)}
                                  </span>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-500 flex justify-between">
                    <span>
                      Distância:{' '}
                      <strong>{resultado.distanciaKm.toFixed(3)} km</strong>
                    </span>
                    <span>
                      Modelo: <strong>{resultado.meta}</strong>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
