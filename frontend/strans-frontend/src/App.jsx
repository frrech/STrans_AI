import { useState } from 'react';
import { Truck, Bike, Package, Zap, MapPin, Navigation, Info } from 'lucide-react';

function App() {
  const [formData, setFormData] = useState({
    origem: '',
    destino: '',
    distancia: '',
    tipoCarga: 'pequena',
    urgencia: false
  });

  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResultado(null);

    try {
      const response = await fetch('http://localhost:3000/api/rotas/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
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
      case 'moto': return '🏍️';
      case 'bike': return '🚲';
      case 'van': return '🚐';
      case 'caminhao': return '🚛';
      default: return '📦';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-blue-900 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tighter">STrans<span className="text-orange-500">.</span></h1>
            <p className="text-xs text-blue-200">Logística Inteligente &copy; 2025</p>
          </div>
          <div className="text-sm bg-blue-800 px-3 py-1 rounded-full flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            IA Online
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Otimizador de Rotas</h2>
          <p className="text-slate-500 max-w-lg mx-auto">
            Nossa IA analisa sua entrega e escolhe entre Moto, Bike, Van ou Caminhão para garantir o menor custo e maior eficiência.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          
          {/* FORMULÁRIO */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-slate-700">
              <Navigation size={20} className="text-blue-600"/> Dados da Entrega
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Origem</label>
                  <input 
                    required name="origem" placeholder="Ex: Centro" 
                    className="w-full p-2.5 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Destino</label>
                  <input 
                    required name="destino" placeholder="Ex: Zona Sul" 
                    className="w-full p-2.5 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Distância Estimada (Km)</label>
                <div className="relative">
                  <MapPin size={18} className="absolute left-3 top-3 text-slate-400" />
                  <input 
                    required name="distancia" type="number" step="0.1" placeholder="Ex: 12.5" 
                    className="w-full pl-10 p-2.5 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Tamanho da Carga</label>
                  <select 
                    name="tipoCarga" 
                    value={formData.tipoCarga} // Garanta que o value esteja ligado ao state
                    className="w-full p-2.5 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                    onChange={handleChange}
                  >
                    <option value="pequena">✉️ Pequena (Docs/Envelopes)</option>
                    <option value="media">📦 Média (Caixas/Compras)</option> {/* NOVA OPÇÃO */}
                    <option value="grande">🚛 Grande (Móveis/Paletes)</option>
                  </select>
                </div>
                
                <div className="flex items-end">
                   <label className={`flex items-center justify-center w-full p-2.5 border rounded-lg cursor-pointer transition select-none ${formData.urgencia ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                      <input 
                        type="checkbox" name="urgencia" 
                        className="hidden" 
                        onChange={handleChange}
                      />
                      <Zap size={18} className={`mr-2 ${formData.urgencia ? 'fill-orange-500' : ''}`} />
                      {formData.urgencia ? 'Urgente!' : 'Normal'}
                   </label>
                </div>
              </div>

              <button 
                type="submit" disabled={loading}
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
                <p>Preencha os dados ao lado para ver a mágica da STrans.</p>
              </div>
            )}

            {error && (
               <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-2">
                 <Info size={20} /> {error}
               </div>
            )}

            {resultado && (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-blue-100 animate-fade-in-up">
                <div className="bg-blue-600 p-6 text-white text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-full bg-white opacity-5 transform -skew-y-6 scale-150"></div>
                  <p className="text-blue-100 text-sm uppercase tracking-widest font-semibold mb-1">Melhor Opção</p>
                  <div className="text-6xl mb-2 filter drop-shadow-md">
                    {getVehicleIcon(resultado.escolha)}
                  </div>
                  <h2 className="text-3xl font-bold capitalize">{resultado.escolha}</h2>
                </div>
                
                <div className="p-6 space-y-6">
                  <div className="flex justify-between items-center pb-6 border-b border-slate-100">
                    <div>
                      <p className="text-slate-400 text-xs uppercase font-bold">Custo Estimado</p>
                      <p className="text-3xl font-bold text-slate-800">
                        R$ {resultado.precoEstimado.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400 text-xs uppercase font-bold">Tempo Estimado</p>
                      <p className="text-3xl font-bold text-slate-800">
                        {resultado.tempoEstimadoMin} <span className="text-lg text-slate-500 font-normal">min</span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs text-slate-400 font-bold uppercase mb-2">Detalhes da IA (DQN)</p>
                    {resultado.qvals && (
                      <div className="grid grid-cols-4 gap-2 h-20 items-end">
                         {/* Visualizador de Q-Values (Gráfico de barras simples) */}
                         {resultado.qvals.map((val, idx) => {
                           const veiculos = ['Moto', 'Bike', 'Van', 'Truck'];
                           // Normalizar para visualização (apenas visual)
                           const height = Math.min(100, Math.max(10, 100 + val * 10)); 
                           const isSelected = resultado.actionIndex === idx;
                           
                           return (
                             <div key={idx} className="flex flex-col items-center group">
                                <div 
                                  className={`w-full rounded-t-md transition-all duration-500 ${isSelected ? 'bg-blue-500' : 'bg-slate-200'}`}
                                  style={{ height: `${height}%` }}
                                ></div>
                                <span className={`text-[10px] mt-1 ${isSelected ? 'font-bold text-blue-600' : 'text-slate-400'}`}>
                                  {veiculos[idx]}
                                </span>
                             </div>
                           )
                         })}
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-500 flex justify-between">
                     <span>Distância: <strong>{resultado.distanciaKm} km</strong></span>
                     <span>Modelo: <strong>{resultado.meta}</strong></span>
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