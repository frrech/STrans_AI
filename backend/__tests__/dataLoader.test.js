import fs from "fs";
import { loadAllData } from "../services/dataLoader.js";

vi.mock("fs");

describe("dataLoader", () => {
  beforeEach(() => {
    fs.readFileSync.mockImplementation((path) => {
      if (path.includes("strans_clientes.csv")) {
        return "cliente_id,tipo_cliente,porte_empresa,regiao,volume_mensal_entregas,valor_medio_entrega,data_contrato\n1,E-commerce,Grande,SP,120,20,2020-01-10";
      }
      if (path.includes("strans_entregas.csv")) {
        return "data,total_entregas,entregas_pequenas,entregas_grandes\n2024-01-01,1000,800,200";
      }
      if (path.includes("strans_rotas.csv")) {
        return "data,rotas_ativas,distancia_media_rota_km,tempo_medio_rota_h\n2024-01-01,50,7.5,3.2";
      }
      if (path.includes("strans_veiculos.csv")) {
        return "data,total_veiculos,motos_ativas,bikes_ativas,vans_ativas,caminhoes_ativos\n2024-01-01,100,60,25,10,5";
      }
      return "";
    });
  });

  test("carrega e normaliza todos os CSVs corretamente", () => {
    const data = loadAllData();
    expect(data.clientes.length).toBe(1);
    expect(data.entregas.length).toBe(1);
    expect(data.rotas.length).toBe(1);
    expect(data.veiculos.length).toBe(1);

    expect(data.clientes[0]).toMatchObject({
      cliente_id: 1,
      tipo_cliente: "E-commerce",
      volume_mensal_entregas: 120
    });
  });
});
