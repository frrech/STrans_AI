import * as tf from '@tensorflow/tfjs';

// Número de variáveis de Estado (ex: Tipo de Carga, Utilização, Pico, Tipo de Cliente, Eficiência)
const NUM_STATE_FEATURES = 5; 
// Número de Ações possíveis (ex: +10%, +5%, 0%, -5%, -10%)
const NUM_ACTIONS = 5; 
const LEARNING_RATE = 0.001;

/**
 * Cria e compila o modelo Deep Q-Network.
 * @returns {tf.Sequential} O modelo DQN.
 */
function createDQNModel() {
    const model = tf.sequential();
    
    // Camada de entrada (Input Layer)
    model.add(tf.layers.dense({
        inputShape: [NUM_STATE_FEATURES], 
        units: 32, 
        activation: 'relu'
    }));

    // Camada Oculta (Hidden Layer)
    model.add(tf.layers.dense({
        units: 32, 
        activation: 'relu'
    }));

    // Camada de saída (Output Layer): Uma saída para o valor Q de cada Ação
    model.add(tf.layers.dense({
        units: NUM_ACTIONS, 
        activation: 'linear' // Linear para estimar valores Q
    }));

    model.compile({
        optimizer: tf.train.adam(LEARNING_RATE),
        loss: 'meanSquaredError' // MSE para perda de Regressão
    });

    return model;
}

const q_network = createDQNModel();
const target_network = createDQNModel();
target_network.setWeights(q_network.getWeights()); // Inicializa com os mesmos pesos

class ReplayMemory {
    constructor(capacity) {
        this.capacity = capacity;
        this.memory = [];
        this.position = 0;
    }

    push(state, action, reward, nextState) {
        if (this.memory.length < this.capacity) {
            this.memory.push(null);
        }
        // Armazena a transição de experiência
        this.memory[this.position] = { state, action, reward, nextState };
        this.position = (this.position + 1) % this.capacity;
    }

    sample(batchSize) {
        // Seleciona uma amostra aleatória (batch) da memória
        return tf.util.random.sample(this.memory, batchSize);
    }
}

const memory = new ReplayMemory(10000);

const GAMMA = 0.95; // Fator de Desconto (Importância da recompensa futura)
const BATCH_SIZE = 32;

/**
 * Executa uma única etapa de otimização no modelo DQN.
 */
async function trainDQNStep() {
    if (memory.memory.length < BATCH_SIZE) {
        return; // Espera ter dados suficientes
    }

    // 1. Amostra aleatória de experiências (Batch)
    const transitions = memory.sample(BATCH_SIZE);
    
    // Extrai os componentes da transição
    const states = transitions.map(t => t.state);
    const actions = transitions.map(t => t.action);
    const rewards = transitions.map(t => t.reward);
    const nextStates = transitions.map(t => t.nextState);
    
    // Converte para Tensores
    const stateTensor = tf.tensor2d(states);
    const nextStateTensor = tf.tensor2d(nextStates);
    const rewardTensor = tf.tensor1d(rewards);

    // 2. Cálculo do Q-Target (Valor Alvo)
    // Usando a Target Network para estabilizar o treinamento:
    await tf.tidy(async () => {
        // Previsão dos valores Q para o Próximo Estado (S_t+1)
        const nextQValues = target_network.predict(nextStateTensor); 
        // Encontra o máximo Q (max_a Q(S_t+1, a))
        const maxNextQ = nextQValues.max(1); 
        // Cálculo do Q-Target: R_t+1 + gamma * max_a Q(S_t+1, a)
        const targetQ = rewardTensor.add(maxNextQ.mul(GAMMA)); 

        // 3. Previsão dos valores Q do Estado Atual (Q(S_t, a))
        const currentQValues = q_network.predict(stateTensor);
        const targetValues = currentQValues.clone();

        // 4. Atualização da Tabela Q (Q(S_t, A_t) é o único valor alterado para o target)
        // Isso simula a atualização Q-Learning para o target network.
        for (let i = 0; i < BATCH_SIZE; i++) {
            const actionIndex = actions[i];
            const target = targetQ.arraySync()[i];
            
            // O valor Q real que a rede deveria ter previsto
            targetValues.buffer().set(target, i * NUM_ACTIONS + actionIndex);
        }

        // 5. Treinamento da Q-Network
        await q_network.fit(stateTensor, targetValues, {
            batchSize: BATCH_SIZE,
            epochs: 1,
            verbose: 0 
        });
    });
}

const EPISODES = 1000;
const SYNC_FREQ = 100; // Sincronizar Target Network a cada 100 passos

async function runTrainingSimulation(historicalData) {
    let epsilon = 1.0; // Epsilon inicial para Epsilon-Greedy

    for (let episode = 0; episode < EPISODES; episode++) {
        // Reinicializa o Estado (Simula uma nova solicitação de precificação)
        let currentState = discretizeState(historicalData.getNewRequest()); 
        
        let done = false; // Se o episódio terminou (e.g., fim do mês simulado)
        let totalReward = 0;

        while (!done) {
            // 1. Escolha da Ação (Epsilon-Greedy)
            const action = chooseAction(currentState, epsilon);

            // 2. Interação com o Ambiente (Simulação da decisão de preço)
            const { nextState, reward, isDone } = simulateEnvironment(currentState, action); 
            
            // 3. Armazenar na Memória
            memory.push(currentState, action, reward, nextState);
            
            // 4. Treinar
            await trainDQNStep();

            currentState = nextState;
            totalReward += reward;
            done = isDone;

            if (episode % SYNC_FREQ === 0) {
                // Sincronizar pesos (Q-Network -> Target Network)
                target_network.setWeights(q_network.getWeights());
            }
        }
        
        // Reduzir Epsilon (diminuir exploração, aumentar explotação)
        epsilon = Math.max(0.01, epsilon * 0.995); 

        console.log(`Episódio ${episode}, Recompensa Total: ${totalReward.toFixed(2)}`);
    }
}

// Mapeamento de categorias para índices numéricos para one-hot encoding
const TIPO_CARGA_MAP = {
    'entregas_pequenas': 0,
    'entregas_grandes': 1
};

const UTILIZACAO_MAP = {
    'baixa': 0, // <= 65%
    'media': 1, // 65% - 85%
    'alta': 2   // >= 85%
};

const PICO_MAP = {
    'nao_pico': 0, 
    'pico': 1 // 14h-18h
};

const TIPO_CLIENTE_MAP = {
    'E-commerce': 0,
    'Varejo': 1,
    'Restaurante': 2,
    'Farmácia': 3,
    'Outros': 4
};

const EFICIENCIA_MAP = {
    'abaixo_meta': 0, // < 0.8 entregas/km
    'acima_meta': 1  // >= 0.8 entregas/km
};

// Parâmetros de negócio do manual
const MARGEM_BRUTA_META = 0.28; 
const SUCESSO_ENTREGA_META = 0.92;
const CUSTO_MOTO_DIA = 46.0; // Exemplo de 'custo_operacional_moto_dia' de janeiro
const HORAS_DIA_OPERACIONAL = 8;

// Funções Auxiliares:
/**
 * Transforma os dados brutos de uma solicitação de entrega em um vetor de Estado (Tensor).
 * @param {Object} data - Objeto contendo as features da entrega e do ambiente.
 * @returns {tf.Tensor} Vetor one-hot do estado.
 */
function discretizeState(data) {
    // 1. Tipo de Carga
    const tipoCargaIndex = TIPO_CARGA_MAP[data.tipoCarga];
    
    // 2. Utilização da Frota (focando em Motos como exemplo de Last-Mile)
    let utilizacaoLevel;
    if (data.utilizacaoFrota < 0.65) {
        utilizacaoLevel = 'baixa';
    } else if (data.utilizacaoFrota <= 0.85) {
        utilizacaoLevel = 'media';
    } else {
        utilizacaoLevel = 'alta';
    }
    const utilizacaoIndex = UTILIZACAO_MAP[utilizacaoLevel];
    
    // 3. Horário de Pico
    const picoIndex = PICO_MAP[data.isHorarioPico ? 'pico' : 'nao_pico'];

    // 4. Tipo de Cliente
    const tipoClienteIndex = TIPO_CLIENTE_MAP[data.tipoCliente] || TIPO_CLIENTE_MAP['Outros'];

    // 5. Eficiência da Rota
    const eficienciaLevel = data.eficienciaRota >= 0.8 ? 'acima_meta' : 'abaixo_meta';
    const eficienciaIndex = EFICIENCIA_MAP[eficienciaLevel];

    // O vetor de estado é a concatenação das representações one-hot de cada feature
    // A rede neural será treinada para interpretar essa entrada.
    const stateVector = [
        tipoCargaIndex, utilizacaoIndex, picoIndex, tipoClienteIndex, eficienciaIndex
    ];
    
    // Em uma implementação real, o vetor seria one-hot codificado antes de ser um Tensor:
    // Exemplo: [1, 0] para tipoCarga pequena, [0, 1, 0] para utilização média, etc.
    // Simplificação para este exemplo conceitual:
    return tf.tensor2d([stateVector]);
}

/**
 * Escolhe uma ação usando a política Epsilon-Greedy.
 * @param {tf.Tensor} state - O vetor de Estado atual.
 * @param {number} epsilon - A probabilidade de exploração.
 * @returns {number} O índice da Ação (0 a 4).
 */
function chooseAction(state, epsilon) {
    if (Math.random() < epsilon) {
        // Exploração: Escolhe uma ação aleatória
        return Math.floor(Math.random() * NUM_ACTIONS);
    } else {
        // Explotação: Escolhe a melhor ação (max Q)
        return tf.tidy(() => {
            // q_network.predict(state) retorna um tensor com os 5 valores Q
            const qValues = q_network.predict(state);
            // .argMax(1) encontra o índice da maior previsão Q (a melhor ação)
            return qValues.argMax(1).dataSync()[0]; 
        });
    }
}

// Array que mapeia o índice da ação para o fator de ajuste de preço
const ACTION_FACTORS = [0.90, 0.95, 1.00, 1.05, 1.10]; // -10%, -5%, 0%, +5%, +10%

/**
 * Simula a transição do estado S_t para S_t+1, calcula a Recompensa R_t+1.
 * NOTA: Esta é uma grande simplificação da dinâmica real do mercado.
 * @param {tf.Tensor} currentState - O vetor de Estado no tempo t.
 * @param {number} actionIndex - O índice da Ação tomada.
 * @returns {Object} { nextState, reward, isDone }
 */
function simulateEnvironment(currentState, actionIndex) {
    // 1. Decodificar Estado e Ação
    // Simplesmente desempacotamos o vetor de estado (simplificado)
    const stateArray = currentState.arraySync()[0];
    const actionFactor = ACTION_FACTORS[actionIndex]; 
    
    // Exemplo de Preço Base (Estimativa VRP/Custo):
    const CUSTO_ROTA_BASE = 15; // R$15.00
    const RECEITA_BASE = 25;    // R$25.00 (Ex: valor_medio_pequena)
    
    // 2. Determinar a Nova Receita e Custo
    let receita = RECEITA_BASE * actionFactor;
    
    // Simulação: Utilização Alta (State[1] == 2) aumenta o custo por tempo
    let custo = CUSTO_ROTA_BASE;
    if (stateArray[1] === 2) { 
        custo += (CUSTO_MOTO_DIA / HORAS_DIA_OPERACIONAL) * 0.5; // Aumento de 50% do custo/hora
    }
    
    // 3. Simular Demanda e Taxa de Sucesso (Feedback)
    // O ajuste de preço afeta a chance de o cliente aceitar (Probabilidade de Venda)
    let probVenda = 0.8; // Base
    if (actionFactor > 1.0) probVenda -= 0.1; // Aumentou preço: chance de venda cai
    if (actionFactor < 1.0) probVenda += 0.05; // Reduziu preço: chance de venda sobe
    
    const vendaRealizada = Math.random() < probVenda;

    // 4. Calcular Recompensa (R_t+1)
    let reward = 0;
    if (vendaRealizada) {
        // Recompensa Primária: Lucro (Receita - Custo)
        const lucro = receita - custo;
        reward = lucro; 

        // Incentivo 1: Bônus por Margem Bruta alta
        const margemBruta = lucro / receita;
        if (margemBruta > MARGEM_BRUTA_META) {
            reward += 5; // Bônus de R$5.00 por otimizar a margem
        }
    } else {
        // Punição: Perde a entrega (Custo de Oportunidade)
        reward = -custo; 
    }
    
    // 5. Determinar Próximo Estado (S_t+1)
    // O próximo estado é baseado em como o ambiente muda após a decisão
    const nextStateData = {
        tipoCarga: stateArray[0] === 0 ? 'entregas_pequenas' : 'entregas_grandes',
        // Simulação de que a utilização da frota cai se a entrega for aceita
        utilizacaoFrota: stateArray[1] === 2 ? 0.80 : 0.70, 
        isHorarioPico: stateArray[2] === 1,
        tipoCliente: 'E-commerce', // Simplificação
        eficienciaRota: 0.85 // Simulação de otimização contínua
    };
    
    const nextState = discretizeState(nextStateData);
    const isDone = false; // O episódio só termina após um período (ex: 1 mês)

    return { nextState, reward, isDone };
}