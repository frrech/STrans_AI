import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { fileURLToPath } from 'url';

// Configuração para __dirname em ES Modules (caso precise)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ajuste o caminho se sua pasta data estiver na raiz
const DATA_DIR = path.resolve("./data");

/**
 * Função auxiliar para converter "10,50" (PT-BR) em 10.50 (JS Number)
 */
function parseNum(val) {
  if (!val) return 0;
  // Se já for número, retorna ele
  if (typeof val === 'number') return val;
  
  // Troca vírgula por ponto e converte
  const cleanVal = val.toString().replace(',', '.');
  const number = Number(cleanVal);
  
  // Se der erro (NaN), retorna 0
  return isNaN(number) ? 0 : number;
}

function readCSV(fileName) {
  const csv = fs.readFileSync(path.join(DATA_DIR, fileName), "utf8");
  return parse(csv, { columns: true, skip_empty_lines: true, delimiter: ";" });
}

export function loadAllData() {
  console.log("Carregando dados de:", DATA_DIR);

  const clientes = readCSV("strans_clientes.csv");
  const entregas = readCSV("strans_entregas.csv");
  const rotas = readCSV("strans_rotas.csv");
  const veiculos = readCSV("strans_veiculos.csv");

  // --- 1. Clientes ---
  const clientesNorm = clientes.map(r => ({
    cliente_id: parseNum(r.cliente_id),
    tipo_cliente: r.tipo_cliente,
    porte_empresa: r.porte_empresa,
    regiao: r.regiao,
    // Numéricos tratados:
    volume_mensal_entregas: parseNum(r.volume_mensal_entregas),
    valor_medio_entrega: parseNum(r.valor_medio_entrega),
    satisfacao_cliente: parseNum(r.satisfacao_cliente), // Adicionei baseado no seu erro anterior
    data_contrato: r.data_contrato
  }));

  // --- 2. Entregas ---
  const entregasNorm = entregas.map(r => ({
    data: r.data,
    total_entregas: parseNum(r.total_entregas),
    entregas_pequenas: parseNum(r.entregas_pequenas),
    entregas_grandes: parseNum(r.entregas_grandes),
    entregas_moto: parseNum(r.entregas_moto),
    entregas_bike: parseNum(r.entregas_bike),
    entregas_van: parseNum(r.entregas_van),
    entregas_caminhao: parseNum(r.entregas_caminhao),
    valor_medio_pequena: parseNum(r.valor_medio_pequena),
    valor_medio_grande: parseNum(r.valor_medio_grande),
    receita_total: parseNum(r.receita_total)
  }));

  // --- 3. Rotas ---
  const rotasNorm = rotas.map(r => ({
    data: r.data,
    rotas_ativas: parseNum(r.rotas_ativas),
    distancia_media_rota_km: parseNum(r.distancia_media_rota_km),
    tempo_medio_rota_h: parseNum(r.tempo_medio_rota_h),
    custo_combustivel_medio_rota: parseNum(r.custo_combustivel_medio_rota),
    custo_pedagio_medio_rota: parseNum(r.custo_pedagio_medio_rota)
  }));

  // --- 4. Veículos ---
  const veiculosNorm = veiculos.map(r => ({
    data: r.data,
    total_veiculos: parseNum(r.total_veiculos),
    motos_ativas: parseNum(r.motos_ativas),
    bikes_ativas: parseNum(r.bikes_ativas),
    vans_ativas: parseNum(r.vans_ativas),
    caminhoes_ativos: parseNum(r.caminhoes_ativos),
    custo_operacional_moto_dia: parseNum(r.custo_operacional_moto_dia),
    custo_operacional_bike_dia: parseNum(r.custo_operacional_bike_dia),
    custo_operacional_van_dia: parseNum(r.custo_operacional_van_dia),
    custo_operacional_caminhao_dia: parseNum(r.custo_operacional_caminhao_dia)
  }));

  return {
    clientes: clientesNorm,
    entregas: entregasNorm,
    rotas: rotasNorm,
    veiculos: veiculosNorm
  };
}