import { EventEmitter } from 'events';
import { AccountBalance, RebalanceStrategy, OptimizationSettings } from './CrossAccountRebalancer';

/**
 * 最適化制約条件
 */
export interface OptimizationConstraints {
  maxPositionSizeChange: number;
  maxTotalCost: number;
  maxRiskIncrease: number;
  minMarginLevel: number;
  blacklistAccounts: string[];
  mandatoryPairs: Array<{
    source: string;
    target: string;
    minAmount: number;
  }>;
  timeConstraints: {
    maxExecutionTime: number; // 分
    marketHours: boolean;
    weekendExecution: boolean;
  };
}

/**
 * 最適化解
 */
export interface OptimizationSolution {
  solutionId: string;
  strategies: RebalanceStrategy[];
  objectives: {
    riskReduction: number;
    costEfficiency: number;
    balanceImprovement: number;
    overallScore: number;
  };
  constraints: {
    satisfied: boolean;
    violations: string[];
  };
  metadata: {
    algorithm: string;
    iterations: number;
    convergenceTime: number;
    solutionQuality: 'optimal' | 'good' | 'acceptable' | 'poor';
  };
}

/**
 * 最適化パフォーマンス
 */
export interface OptimizationPerformance {
  algorithm: string;
  executionTime: number;
  memoryUsage: number;
  solutionQuality: number;
  convergenceRate: number;
  stabilityScore: number;
}

/**
 * 最適化エンジン
 */
export class OptimizationEngine extends EventEmitter {
  private settings: OptimizationSettings;
  private constraints: OptimizationConstraints;
  private performanceMetrics = new Map<string, OptimizationPerformance[]>();

  constructor(
    settings: OptimizationSettings,
    constraints?: Partial<OptimizationConstraints>
  ) {
    super();
    
    this.settings = settings;
    this.constraints = {
      maxPositionSizeChange: 0.3,
      maxTotalCost: 1000,
      maxRiskIncrease: 0.1,
      minMarginLevel: 150,
      blacklistAccounts: [],
      mandatoryPairs: [],
      timeConstraints: {
        maxExecutionTime: 30,
        marketHours: true,
        weekendExecution: false
      },
      ...constraints
    };
  }

  /**
   * 最適化実行
   */
  async optimize(
    accounts: AccountBalance[],
    algorithm: 'genetic' | 'simulated_annealing' | 'greedy' | 'hybrid' = 'hybrid'
  ): Promise<OptimizationSolution> {
    const startTime = Date.now();
    
    this.emit('optimizationStarted', { algorithm, accounts: accounts.length });

    let solution: OptimizationSolution;

    try {
      switch (algorithm) {
        case 'genetic':
          solution = await this.geneticAlgorithm(accounts);
          break;
        case 'simulated_annealing':
          solution = await this.simulatedAnnealing(accounts);
          break;
        case 'greedy':
          solution = await this.greedyAlgorithm(accounts);
          break;
        case 'hybrid':
          solution = await this.hybridAlgorithm(accounts);
          break;
        default:
          throw new Error(`Unknown algorithm: ${algorithm}`);
      }

      // パフォーマンス記録
      const executionTime = Date.now() - startTime;
      this.recordPerformance(algorithm, solution, executionTime);

      this.emit('optimizationCompleted', solution);

    } catch (error) {
      this.emit('optimizationFailed', { algorithm, error });
      throw error;
    }

    return solution;
  }

  /**
   * 遺伝的アルゴリズム
   */
  private async geneticAlgorithm(accounts: AccountBalance[]): Promise<OptimizationSolution> {
    const populationSize = 50;
    const generations = 100;
    const mutationRate = 0.1;
    const crossoverRate = 0.8;

    // 初期集団の生成
    let population = this.generateInitialPopulation(accounts, populationSize);
    let bestSolution: OptimizationSolution | null = null;
    let stagnationCounter = 0;
    const maxStagnation = 20;

    for (let generation = 0; generation < generations; generation++) {
      // 評価
      const evaluatedPopulation = population.map(individual => 
        this.evaluateSolution(accounts, individual)
      );

      // 最良解の更新
      const currentBest = evaluatedPopulation.reduce((best, current) => 
        current.objectives.overallScore > best.objectives.overallScore ? current : best
      );

      if (!bestSolution || currentBest.objectives.overallScore > bestSolution.objectives.overallScore) {
        bestSolution = currentBest;
        stagnationCounter = 0;
      } else {
        stagnationCounter++;
      }

      // 早期終了
      if (stagnationCounter >= maxStagnation) {
        break;
      }

      // 選択
      const selectedPopulation = this.tournamentSelection(evaluatedPopulation, populationSize);

      // 交叉と変異
      const newPopulation: RebalanceStrategy[][] = [];
      for (let i = 0; i < populationSize; i += 2) {
        let parent1 = selectedPopulation[i].strategies;
        let parent2 = selectedPopulation[Math.min(i + 1, populationSize - 1)].strategies;

        let offspring1 = [...parent1];
        let offspring2 = [...parent2];

        // 交叉
        if (Math.random() < crossoverRate) {
          [offspring1, offspring2] = this.crossover(parent1, parent2);
        }

        // 変異
        if (Math.random() < mutationRate) {
          offspring1 = this.mutate(accounts, offspring1);
        }
        if (Math.random() < mutationRate) {
          offspring2 = this.mutate(accounts, offspring2);
        }

        newPopulation.push(offspring1);
        if (newPopulation.length < populationSize) {
          newPopulation.push(offspring2);
        }
      }

      population = newPopulation;

      // 進捗通知
      if (generation % 10 === 0) {
        this.emit('optimizationProgress', {
          algorithm: 'genetic',
          generation,
          totalGenerations: generations,
          bestScore: bestSolution?.objectives.overallScore || 0
        });
      }
    }

    if (!bestSolution) {
      throw new Error('Failed to find solution in genetic algorithm');
    }

    bestSolution.metadata = {
      algorithm: 'genetic',
      iterations: generations,
      convergenceTime: Date.now(),
      solutionQuality: this.assessSolutionQuality(bestSolution)
    };

    return bestSolution;
  }

  /**
   * シミュレーテッドアニーリング
   */
  private async simulatedAnnealing(accounts: AccountBalance[]): Promise<OptimizationSolution> {
    const maxIterations = 1000;
    const initialTemperature = 100;
    const coolingRate = 0.995;

    // 初期解の生成
    let currentStrategies = this.generateRandomSolution(accounts);
    let currentSolution = this.evaluateSolution(accounts, currentStrategies);
    let bestSolution = { ...currentSolution };

    let temperature = initialTemperature;
    let iterations = 0;

    while (iterations < maxIterations && temperature > 0.01) {
      // 近傍解の生成
      const neighborStrategies = this.generateNeighborSolution(accounts, currentStrategies);
      const neighborSolution = this.evaluateSolution(accounts, neighborStrategies);

      // 解の受容判定
      const scoreDelta = neighborSolution.objectives.overallScore - currentSolution.objectives.overallScore;
      
      if (scoreDelta > 0 || Math.random() < Math.exp(scoreDelta / temperature)) {
        currentStrategies = neighborStrategies;
        currentSolution = neighborSolution;

        // 最良解の更新
        if (currentSolution.objectives.overallScore > bestSolution.objectives.overallScore) {
          bestSolution = { ...currentSolution };
        }
      }

      // 温度の更新
      temperature *= coolingRate;
      iterations++;

      // 進捗通知
      if (iterations % 100 === 0) {
        this.emit('optimizationProgress', {
          algorithm: 'simulated_annealing',
          iteration: iterations,
          totalIterations: maxIterations,
          temperature,
          bestScore: bestSolution.objectives.overallScore
        });
      }
    }

    bestSolution.metadata = {
      algorithm: 'simulated_annealing',
      iterations,
      convergenceTime: Date.now(),
      solutionQuality: this.assessSolutionQuality(bestSolution)
    };

    return bestSolution;
  }

  /**
   * 貪欲アルゴリズム
   */
  private async greedyAlgorithm(accounts: AccountBalance[]): Promise<OptimizationSolution> {
    const strategies: RebalanceStrategy[] = [];
    const remainingAccounts = [...accounts];
    let iterations = 0;

    while (remainingAccounts.length >= 2 && strategies.length < this.settings.maxStrategiesPerRebalance) {
      let bestStrategy: RebalanceStrategy | null = null;
      let bestScore = 0;

      // 全ての可能なペアを評価
      for (let i = 0; i < remainingAccounts.length; i++) {
        for (let j = i + 1; j < remainingAccounts.length; j++) {
          const sourceAccount = remainingAccounts[i];
          const targetAccount = remainingAccounts[j];

          // 双方向で戦略を評価
          const strategy1 = this.createStrategy(sourceAccount, targetAccount);
          const strategy2 = this.createStrategy(targetAccount, sourceAccount);

          for (const strategy of [strategy1, strategy2]) {
            if (strategy && this.validateConstraints([strategy])) {
              const score = this.calculateStrategyScore(strategy);
              if (score > bestScore) {
                bestScore = score;
                bestStrategy = strategy;
              }
            }
          }
        }
      }

      if (bestStrategy) {
        strategies.push(bestStrategy);
        
        // 使用したアカウントを一時的に除外（重複を避けるため）
        const sourceIndex = remainingAccounts.findIndex(acc => acc.accountId === bestStrategy!.sourceAccount);
        if (sourceIndex >= 0) {
          remainingAccounts.splice(sourceIndex, 1);
        }
      } else {
        break; // 有効な戦略が見つからない場合は終了
      }

      iterations++;
    }

    const solution = this.evaluateSolution(accounts, strategies);
    solution.metadata = {
      algorithm: 'greedy',
      iterations,
      convergenceTime: Date.now(),
      solutionQuality: this.assessSolutionQuality(solution)
    };

    return solution;
  }

  /**
   * ハイブリッドアルゴリズム
   */
  private async hybridAlgorithm(accounts: AccountBalance[]): Promise<OptimizationSolution> {
    // 1. 貪欲アルゴリズムで初期解を生成
    const greedySolution = await this.greedyAlgorithm(accounts);
    
    // 2. 遺伝的アルゴリズムで改善
    const geneticSolution = await this.geneticAlgorithm(accounts);
    
    // 3. シミュレーテッドアニーリングで微調整
    const finalSolution = await this.simulatedAnnealing(accounts);

    // 最良解を選択
    const solutions = [greedySolution, geneticSolution, finalSolution];
    const bestSolution = solutions.reduce((best, current) =>
      current.objectives.overallScore > best.objectives.overallScore ? current : best
    );

    bestSolution.metadata = {
      algorithm: 'hybrid',
      iterations: greedySolution.metadata.iterations + geneticSolution.metadata.iterations + finalSolution.metadata.iterations,
      convergenceTime: Date.now(),
      solutionQuality: this.assessSolutionQuality(bestSolution)
    };

    return bestSolution;
  }

  /**
   * 解の評価
   */
  private evaluateSolution(accounts: AccountBalance[], strategies: RebalanceStrategy[]): OptimizationSolution {
    const riskReduction = this.calculateRiskReduction(accounts, strategies);
    const costEfficiency = this.calculateCostEfficiency(strategies);
    const balanceImprovement = this.calculateBalanceImprovement(accounts, strategies);
    
    // 重み付き総合スコア
    const overallScore = 
      riskReduction * 0.4 + 
      costEfficiency * 0.3 + 
      balanceImprovement * 0.3;

    const constraintsResult = this.validateConstraints(strategies);

    return {
      solutionId: this.generateSolutionId(),
      strategies,
      objectives: {
        riskReduction,
        costEfficiency,
        balanceImprovement,
        overallScore
      },
      constraints: constraintsResult,
      metadata: {
        algorithm: '',
        iterations: 0,
        convergenceTime: 0,
        solutionQuality: 'acceptable'
      }
    };
  }

  /**
   * 制約条件の検証
   */
  private validateConstraints(strategies: RebalanceStrategy[]): { satisfied: boolean; violations: string[] } {
    const violations: string[] = [];

    // コスト制約
    const totalCost = strategies.reduce((sum, s) => sum + s.estimatedCost, 0);
    if (totalCost > this.constraints.maxTotalCost) {
      violations.push(`Total cost ${totalCost} exceeds limit ${this.constraints.maxTotalCost}`);
    }

    // ブラックリスト制約
    for (const strategy of strategies) {
      if (this.constraints.blacklistAccounts.includes(strategy.sourceAccount)) {
        violations.push(`Source account ${strategy.sourceAccount} is blacklisted`);
      }
      if (this.constraints.blacklistAccounts.includes(strategy.targetAccount)) {
        violations.push(`Target account ${strategy.targetAccount} is blacklisted`);
      }
    }

    // ポジションサイズ制約
    for (const strategy of strategies) {
      if (strategy.amount > this.constraints.maxPositionSizeChange * 100000) {
        violations.push(`Strategy amount ${strategy.amount} exceeds position size limit`);
      }
    }

    return {
      satisfied: violations.length === 0,
      violations
    };
  }

  // ユーティリティメソッド
  private generateInitialPopulation(accounts: AccountBalance[], size: number): RebalanceStrategy[][] {
    const population: RebalanceStrategy[][] = [];
    
    for (let i = 0; i < size; i++) {
      population.push(this.generateRandomSolution(accounts));
    }
    
    return population;
  }

  private generateRandomSolution(accounts: AccountBalance[]): RebalanceStrategy[] {
    const strategies: RebalanceStrategy[] = [];
    const maxStrategies = Math.min(this.settings.maxStrategiesPerRebalance, accounts.length);
    const numStrategies = Math.floor(Math.random() * maxStrategies) + 1;

    for (let i = 0; i < numStrategies; i++) {
      const sourceIndex = Math.floor(Math.random() * accounts.length);
      let targetIndex = Math.floor(Math.random() * accounts.length);
      
      while (targetIndex === sourceIndex) {
        targetIndex = Math.floor(Math.random() * accounts.length);
      }

      const strategy = this.createStrategy(accounts[sourceIndex], accounts[targetIndex]);
      if (strategy) {
        strategies.push(strategy);
      }
    }

    return strategies;
  }

  private createStrategy(sourceAccount: AccountBalance, targetAccount: AccountBalance): RebalanceStrategy | null {
    const actions: RebalanceStrategy['action'][] = ['transfer_position', 'close_and_reopen', 'hedge_create', 'reduce_exposure'];
    const action = actions[Math.floor(Math.random() * actions.length)];
    
    const maxAmount = Math.min(sourceAccount.totalEquity * 0.3, targetAccount.totalEquity * 0.2);
    if (maxAmount < 100) return null;

    const amount = Math.random() * maxAmount + 100;

    return {
      sourceAccount: sourceAccount.accountId,
      targetAccount: targetAccount.accountId,
      action,
      amount,
      priority: Math.floor(Math.random() * 3) + 1,
      estimatedBenefit: amount * 0.1,
      estimatedCost: amount * 0.01,
      riskImpact: amount * 0.05,
      reason: `Generated strategy: ${action}`,
      dependencies: []
    };
  }

  private tournamentSelection(population: OptimizationSolution[], size: number): OptimizationSolution[] {
    const selected: OptimizationSolution[] = [];
    const tournamentSize = 3;

    for (let i = 0; i < size; i++) {
      const tournament: OptimizationSolution[] = [];
      
      for (let j = 0; j < tournamentSize; j++) {
        const randomIndex = Math.floor(Math.random() * population.length);
        tournament.push(population[randomIndex]);
      }
      
      const winner = tournament.reduce((best, current) =>
        current.objectives.overallScore > best.objectives.overallScore ? current : best
      );
      
      selected.push(winner);
    }

    return selected;
  }

  private crossover(parent1: RebalanceStrategy[], parent2: RebalanceStrategy[]): [RebalanceStrategy[], RebalanceStrategy[]] {
    const minLength = Math.min(parent1.length, parent2.length);
    if (minLength < 2) return [parent1, parent2];

    const crossoverPoint = Math.floor(Math.random() * (minLength - 1)) + 1;
    
    const offspring1 = [...parent1.slice(0, crossoverPoint), ...parent2.slice(crossoverPoint)];
    const offspring2 = [...parent2.slice(0, crossoverPoint), ...parent1.slice(crossoverPoint)];

    return [offspring1, offspring2];
  }

  private mutate(accounts: AccountBalance[], strategies: RebalanceStrategy[]): RebalanceStrategy[] {
    const mutated = [...strategies];
    const mutationTypes = ['modify_amount', 'change_action', 'add_strategy', 'remove_strategy'];
    const mutationType = mutationTypes[Math.floor(Math.random() * mutationTypes.length)];

    switch (mutationType) {
      case 'modify_amount':
        if (mutated.length > 0) {
          const index = Math.floor(Math.random() * mutated.length);
          mutated[index] = { ...mutated[index] };
          mutated[index].amount *= (0.8 + Math.random() * 0.4); // ±20%の変動
        }
        break;

      case 'change_action':
        if (mutated.length > 0) {
          const actions: RebalanceStrategy['action'][] = ['transfer_position', 'close_and_reopen', 'hedge_create', 'reduce_exposure'];
          const index = Math.floor(Math.random() * mutated.length);
          mutated[index] = { ...mutated[index] };
          mutated[index].action = actions[Math.floor(Math.random() * actions.length)];
        }
        break;

      case 'add_strategy':
        if (mutated.length < this.settings.maxStrategiesPerRebalance && accounts.length >= 2) {
          const sourceIndex = Math.floor(Math.random() * accounts.length);
          let targetIndex = Math.floor(Math.random() * accounts.length);
          while (targetIndex === sourceIndex) {
            targetIndex = Math.floor(Math.random() * accounts.length);
          }
          
          const newStrategy = this.createStrategy(accounts[sourceIndex], accounts[targetIndex]);
          if (newStrategy) {
            mutated.push(newStrategy);
          }
        }
        break;

      case 'remove_strategy':
        if (mutated.length > 1) {
          const index = Math.floor(Math.random() * mutated.length);
          mutated.splice(index, 1);
        }
        break;
    }

    return mutated;
  }

  private generateNeighborSolution(accounts: AccountBalance[], strategies: RebalanceStrategy[]): RebalanceStrategy[] {
    return this.mutate(accounts, strategies);
  }

  private calculateRiskReduction(accounts: AccountBalance[], strategies: RebalanceStrategy[]): number {
    return strategies.reduce((sum, s) => sum + Math.max(0, s.riskImpact), 0) / strategies.length;
  }

  private calculateCostEfficiency(strategies: RebalanceStrategy[]): number {
    const totalBenefit = strategies.reduce((sum, s) => sum + s.estimatedBenefit, 0);
    const totalCost = strategies.reduce((sum, s) => sum + s.estimatedCost, 0);
    
    return totalCost > 0 ? Math.min(1, totalBenefit / totalCost) : 0;
  }

  private calculateBalanceImprovement(accounts: AccountBalance[], strategies: RebalanceStrategy[]): number {
    // 簡易実装：戦略数と効果の関係
    return Math.min(1, strategies.length * 0.2);
  }

  private calculateStrategyScore(strategy: RebalanceStrategy): number {
    return strategy.riskImpact * 10 + (10 - strategy.priority);
  }

  private assessSolutionQuality(solution: OptimizationSolution): 'optimal' | 'good' | 'acceptable' | 'poor' {
    const score = solution.objectives.overallScore;
    
    if (score > 0.8) return 'optimal';
    if (score > 0.6) return 'good';
    if (score > 0.4) return 'acceptable';
    return 'poor';
  }

  private recordPerformance(algorithm: string, solution: OptimizationSolution, executionTime: number): void {
    const performance: OptimizationPerformance = {
      algorithm,
      executionTime,
      memoryUsage: process.memoryUsage().heapUsed,
      solutionQuality: solution.objectives.overallScore,
      convergenceRate: solution.metadata.iterations > 0 ? 1 / solution.metadata.iterations : 0,
      stabilityScore: Math.random() // 簡易実装
    };

    const existing = this.performanceMetrics.get(algorithm) || [];
    existing.push(performance);
    
    // 履歴制限
    if (existing.length > 100) {
      existing.shift();
    }
    
    this.performanceMetrics.set(algorithm, existing);
  }

  private generateSolutionId(): string {
    return `solution_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * パフォーマンス統計の取得
   */
  getPerformanceStats(algorithm?: string): Map<string, OptimizationPerformance[]> {
    if (algorithm) {
      const stats = this.performanceMetrics.get(algorithm);
      return new Map(stats ? [[algorithm, stats]] : []);
    }
    
    return new Map(this.performanceMetrics);
  }

  /**
   * 制約条件の更新
   */
  updateConstraints(constraints: Partial<OptimizationConstraints>): void {
    this.constraints = { ...this.constraints, ...constraints };
    this.emit('constraintsUpdated', this.constraints);
  }

  /**
   * 設定の更新
   */
  updateSettings(settings: Partial<OptimizationSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.emit('settingsUpdated', this.settings);
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.performanceMetrics.clear();
    this.removeAllListeners();
  }
}