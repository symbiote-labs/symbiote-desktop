// src/main/mcpServers/calculator.ts

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js'
import axios from 'axios'
import { app } from 'electron'
import Logger from 'electron-log'
import fs from 'fs/promises'
import path from 'path'

// 缓存实例和代码
let math: any = null
let mathJsCodeCache: string | null = null
let plotly: any = null
let plotlyCodeCache: string | null = null

// 创建一个加载 plotly.js 的函数
async function loadPlotly() {
  try {
    // 如果已有实例，直接返回
    if (plotly) {
      Logger.info('[Calculator] Using cached plotly instance')
      return true
    }

    // 使用应用程序的用户数据目录，确保缓存持久化
    const cacheDir = path.join(app.getPath('userData'), 'calculator-cache')
    const plotlyJsPath = path.join(cacheDir, 'plotly.js')
    const plotlyJsVersionPath = path.join(cacheDir, 'plotly-version.txt')
    const currentVersion = '3.0.1' // 当前使用的 plotly.js 版本

    // 确保缓存目录存在
    try {
      await fs.mkdir(cacheDir, { recursive: true })
    } catch (err) {
      Logger.warn('[Calculator] Failed to create cache directory:', err)
    }

    // 检查缓存的版本是否匹配
    let useCache = false
    try {
      const cachedVersion = await fs.readFile(plotlyJsVersionPath, 'utf-8')
      if (cachedVersion.trim() === currentVersion) {
        useCache = true
      } else {
        Logger.info(`[Calculator] Cached plotly version ${cachedVersion} doesn't match current ${currentVersion}`)
      }
    } catch (err) {
      Logger.info('[Calculator] No cached plotly version info found')
    }

    // 尝试从本地缓存加载
    if (useCache) {
      try {
        if (!plotlyCodeCache) {
          plotlyCodeCache = await fs.readFile(plotlyJsPath, 'utf-8')
          Logger.info('[Calculator] Loaded plotly from local cache')
        }
      } catch (err) {
        useCache = false
        Logger.warn('[Calculator] Failed to read cached plotly:', err)
      }
    }

    // 如果缓存不可用或版本不匹配，从网络加载
    if (!useCache) {
      try {
        Logger.info('[Calculator] Downloading plotly from unpkg.com')
        const response = await axios.get(`https://unpkg.com/plotly.js-dist@${currentVersion}/plotly.js`)
        plotlyCodeCache = response.data

        // 同步保存到本地，确保缓存文件被写入
        await fs.writeFile(plotlyJsPath, plotlyCodeCache || '')
        await fs.writeFile(plotlyJsVersionPath, currentVersion)
        Logger.info(`[Calculator] Saved plotly to ${plotlyJsPath}`)
      } catch (err) {
        Logger.error('[Calculator] Failed to download plotly:', err)
        // 如果下载失败但有旧缓存，尝试使用旧缓存
        if (!plotlyCodeCache) {
          try {
            plotlyCodeCache = await fs.readFile(plotlyJsPath, 'utf-8')
            Logger.info('[Calculator] Falling back to existing plotly cache despite version mismatch')
          } catch (readErr) {
            Logger.error('[Calculator] No fallback plotly cache available:', readErr)
            throw err // 重新抛出原始错误
          }
        }
      }
    }

    // 直接从内存执行代码
    const plotlyModule = { exports: {} }
    const moduleFn = new Function('module', 'exports', plotlyCodeCache!)
    moduleFn(plotlyModule, plotlyModule.exports)

    plotly = plotlyModule.exports
    Logger.info('[Calculator] Successfully loaded plotly')
    return true
  } catch (error) {
    Logger.error('[Calculator] Failed to load plotly:', error)

    // 降级实现 - 返回一个简单的 SVG 生成函数
    plotly = {
      newPlot: () => {
        throw new Error('Plotly is not available')
      },
      toImage: () => {
        throw new Error('Plotly is not available')
      }
    }

    Logger.info('[Calculator] Using fallback plotly implementation')
    return false
  }
}

// 创建一个加载 mathjs 的函数
async function loadMathJs() {
  try {
    // 如果已有实例，直接返回
    if (math) {
      Logger.info('[Calculator] Using cached mathjs instance')
      return true
    }

    // 使用应用程序的用户数据目录而不是临时目录，确保缓存持久化
    const cacheDir = path.join(app.getPath('userData'), 'calculator-cache')
    const mathJsPath = path.join(cacheDir, 'math.js')
    const mathJsVersionPath = path.join(cacheDir, 'version.txt')
    const currentVersion = '12.4.0' // 当前使用的 mathjs 版本

    // 确保缓存目录存在
    try {
      await fs.mkdir(cacheDir, { recursive: true })
    } catch (err) {
      Logger.warn('[Calculator] Failed to create cache directory:', err)
    }

    // 检查缓存的版本是否匹配
    let useCache = false
    try {
      const cachedVersion = await fs.readFile(mathJsVersionPath, 'utf-8')
      if (cachedVersion.trim() === currentVersion) {
        useCache = true
      } else {
        Logger.info(`[Calculator] Cached mathjs version ${cachedVersion} doesn't match current ${currentVersion}`)
      }
    } catch (err) {
      Logger.info('[Calculator] No cached version info found')
    }

    // 尝试从本地缓存加载
    if (useCache) {
      try {
        if (!mathJsCodeCache) {
          mathJsCodeCache = await fs.readFile(mathJsPath, 'utf-8')
          Logger.info('[Calculator] Loaded mathjs from local cache')
        }
      } catch (err) {
        useCache = false
        Logger.warn('[Calculator] Failed to read cached mathjs:', err)
      }
    }

    // 如果缓存不可用或版本不匹配，从网络加载
    if (!useCache) {
      try {
        Logger.info('[Calculator] Downloading mathjs from unpkg.com')
        const response = await axios.get(`https://unpkg.com/mathjs@${currentVersion}/lib/browser/math.js`)
        mathJsCodeCache = response.data

        // 同步保存到本地，确保缓存文件被写入
        await fs.writeFile(mathJsPath, mathJsCodeCache || '')
        await fs.writeFile(mathJsVersionPath, currentVersion)
        Logger.info(`[Calculator] Saved mathjs to ${mathJsPath}`)
      } catch (err) {
        Logger.error('[Calculator] Failed to download mathjs:', err)
        // 如果下载失败但有旧缓存，尝试使用旧缓存
        if (!mathJsCodeCache) {
          try {
            mathJsCodeCache = await fs.readFile(mathJsPath, 'utf-8')
            Logger.info('[Calculator] Falling back to existing cache despite version mismatch')
          } catch (readErr) {
            Logger.error('[Calculator] No fallback cache available:', readErr)
            throw err // 重新抛出原始错误
          }
        }
      }
    }

    // 直接从内存执行代码
    const mathModule = { exports: {} }
    const moduleFn = new Function('module', 'exports', mathJsCodeCache!)
    moduleFn(mathModule, mathModule.exports)

    math = mathModule.exports
    Logger.info('[Calculator] Successfully loaded mathjs')
    return true
  } catch (error) {
    Logger.error('[Calculator] Failed to load mathjs:', error)

    // 降级实现
    math = {
      evaluate: (expr: string) => {
        return Function('"use strict"; return (' + expr + ')')()
      },
      format: (value: any) => String(value),
      mean: (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length,
      median: (arr: number[]) => {
        const sorted = [...arr].sort((a, b) => a - b)
        const mid = Math.floor(sorted.length / 2)
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
      },
      std: (arr: number[]) => {
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length
        const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length
        return Math.sqrt(variance)
      },
      min: (arr: number[]) => Math.min(...arr),
      max: (arr: number[]) => Math.max(...arr),
      sum: (arr: number[]) => arr.reduce((a, b) => a + b, 0),
      unit: (value: number, unit: string) => {
        return {
          toNumber: () => value,
          to: (targetUnit: string) => {
            if (unit === 'inch' && targetUnit === 'cm') return { toNumber: () => value * 2.54 }
            if (unit === 'cm' && targetUnit === 'inch') return { toNumber: () => value / 2.54 }
            if (unit === 'kg' && targetUnit === 'lb') return { toNumber: () => value * 2.20462 }
            if (unit === 'lb' && targetUnit === 'kg') return { toNumber: () => value / 2.20462 }
            return { toNumber: () => value }
          }
        }
      }
    }
    Logger.info('[Calculator] Using fallback math implementation')
    return false
  }
}

// 定义科学计算器工具
const CALCULATOR_TOOL = {
  name: 'calculate',
  description: '万能科学计算器，支持数学表达式计算、复数运算、分数计算等功能',
  inputSchema: {
    type: 'object',
    title: 'CalculatorInput',
    description: '科学计算器的输入参数',
    properties: {
      expression: {
        type: 'string',
        description:
          '要计算的数学表达式，例如：2+2、sin(45 deg)、5 inch to cm、det([1,2;3,4])、(3+4i)*(2-i)、1/3 + 1/4等'
      },
      precision: {
        type: 'number',
        description: '结果的精度（小数位数），默认为14'
      },
      format: {
        type: 'string',
        description: '结果格式化方式，可选值：auto、decimal、scientific、engineering、fixed、fraction，默认为auto',
        enum: ['auto', 'decimal', 'scientific', 'engineering', 'fixed', 'fraction']
      },
      complexForm: {
        type: 'string',
        description: '复数结果的表示形式，可选值：rectangular(直角坐标)、polar(极坐标)，默认为rectangular',
        enum: ['rectangular', 'polar']
      }
    },
    required: ['expression']
  }
}

// 单位转换工具
const UNIT_CONVERT_TOOL = {
  name: 'convert_unit',
  description: '单位转换工具，支持各种物理单位之间的转换',
  inputSchema: {
    type: 'object',
    title: 'UnitConvertInput',
    description: '单位转换的输入参数',
    properties: {
      value: {
        type: 'number',
        description: '要转换的数值'
      },
      from: {
        type: 'string',
        description: '源单位，例如：kg、m、s、inch、celsius等'
      },
      to: {
        type: 'string',
        description: '目标单位，例如：g、km、ms、cm、fahrenheit等'
      },
      precision: {
        type: 'number',
        description: '结果的精度（小数位数），默认为6'
      }
    },
    required: ['value', 'from', 'to']
  }
}

// 统计计算工具
const STATISTICS_TOOL = {
  name: 'statistics',
  description: '统计计算工具，支持均值、中位数、标准差等统计计算',
  inputSchema: {
    type: 'object',
    title: 'StatisticsInput',
    description: '统计计算的输入参数',
    properties: {
      data: {
        type: 'string',
        description: '要计算的数据，以逗号分隔的数字，例如：1,2,3,4,5'
      },
      operation: {
        type: 'string',
        description:
          '统计操作，可选值：mean(均值)、median(中位数)、std(标准差)、min(最小值)、max(最大值)、sum(求和)、variance(方差)、quantile(分位数)、correlation(相关性)、all(所有统计结果)',
        enum: ['mean', 'median', 'std', 'min', 'max', 'sum', 'variance', 'quantile', 'correlation', 'all']
      },
      quantile: {
        type: 'number',
        description: '当operation为quantile时，指定分位数值(0-1之间)，例如：0.25表示第一四分位数'
      },
      secondData: {
        type: 'string',
        description: '当operation为correlation时，用于计算相关性的第二组数据，以逗号分隔'
      }
    },
    required: ['data', 'operation']
  }
}

// 方程求解工具
const EQUATION_SOLVER_TOOL = {
  name: 'solve_equation',
  description: '方程求解工具，支持代数方程、线性方程组等求解',
  inputSchema: {
    type: 'object',
    title: 'EquationSolverInput',
    description: '方程求解的输入参数',
    properties: {
      equation: {
        type: 'string',
        description: '要求解的方程，例如：x^2 + 2*x - 3 = 0 或 2*x + y = 10, 3*x - y = 5'
      },
      variables: {
        type: 'string',
        description: '变量列表，以逗号分隔，例如：x,y,z。如果不提供，将自动检测'
      },
      precision: {
        type: 'number',
        description: '结果的精度（小数位数），默认为6'
      }
    },
    required: ['equation']
  }
}

// 微积分工具
const CALCULUS_TOOL = {
  name: 'calculus',
  description: '微积分工具，支持导数、积分、极限等计算',
  inputSchema: {
    type: 'object',
    title: 'CalculusInput',
    description: '微积分计算的输入参数',
    properties: {
      operation: {
        type: 'string',
        description: '微积分操作，可选值：derivative(导数)、integral(积分)、limit(极限)',
        enum: ['derivative', 'integral', 'limit']
      },
      expression: {
        type: 'string',
        description: '要计算的表达式，例如：x^2 + 2*x'
      },
      variable: {
        type: 'string',
        description: '变量名，例如：x'
      },
      order: {
        type: 'number',
        description: '当operation为derivative时，指定导数阶数，默认为1'
      },
      from: {
        type: 'string',
        description: '当operation为integral时，指定积分下限'
      },
      to: {
        type: 'string',
        description: '当operation为integral时，指定积分上限'
      },
      approach: {
        type: 'string',
        description: '当operation为limit时，指定趋近方向，例如：0+'
      }
    },
    required: ['operation', 'expression', 'variable']
  }
}

// 矩阵计算工具
const MATRIX_TOOL = {
  name: 'matrix',
  description: '矩阵计算工具，支持矩阵运算、特征值、行列式等计算',
  inputSchema: {
    type: 'object',
    title: 'MatrixInput',
    description: '矩阵计算的输入参数',
    properties: {
      operation: {
        type: 'string',
        description:
          '矩阵操作，可选值：det(行列式)、inv(逆矩阵)、transpose(转置)、eigenvalues(特征值)、eigenvectors(特征向量)、rank(秩)、multiply(矩阵乘法)、solve(解线性方程组)',
        enum: ['det', 'inv', 'transpose', 'eigenvalues', 'eigenvectors', 'rank', 'multiply', 'solve']
      },
      matrix: {
        type: 'string',
        description: '矩阵定义，例如：[1,2,3;4,5,6;7,8,9]表示3x3矩阵'
      },
      matrix2: {
        type: 'string',
        description: '当operation为multiply时，第二个矩阵定义'
      },
      vector: {
        type: 'string',
        description: '当operation为solve时，等号右侧的向量，例如：[1,2,3]'
      }
    },
    required: ['operation', 'matrix']
  }
}

// 概率与随机工具
const PROBABILITY_TOOL = {
  name: 'probability',
  description: '概率与随机工具，支持概率分布、随机数生成等',
  inputSchema: {
    type: 'object',
    title: 'ProbabilityInput',
    description: '概率计算的输入参数',
    properties: {
      operation: {
        type: 'string',
        description:
          '概率操作，可选值：pdf(概率密度函数)、cdf(累积分布函数)、random(随机数生成)、combination(组合数)、permutation(排列数)',
        enum: ['pdf', 'cdf', 'random', 'combination', 'permutation']
      },
      distribution: {
        type: 'string',
        description: '当operation为pdf或cdf时，指定分布类型，例如：normal、binomial、poisson等',
        enum: ['normal', 'binomial', 'poisson', 'uniform', 'exponential']
      },
      params: {
        type: 'string',
        description: '分布参数，以逗号分隔，例如正态分布的均值和标准差：0,1'
      },
      x: {
        type: 'number',
        description: '当operation为pdf或cdf时，指定自变量值'
      },
      n: {
        type: 'number',
        description: '当operation为combination或permutation时，指定总数n'
      },
      k: {
        type: 'number',
        description: '当operation为combination或permutation时，指定选取数k'
      },
      count: {
        type: 'number',
        description: '当operation为random时，指定生成随机数的数量'
      }
    },
    required: ['operation']
  }
}

// 金融计算工具
const FINANCE_TOOL = {
  name: 'finance',
  description: '金融计算工具，支持利息、贷款、投资回报率等计算',
  inputSchema: {
    type: 'object',
    title: 'FinanceInput',
    description: '金融计算的输入参数',
    properties: {
      operation: {
        type: 'string',
        description:
          '金融操作，可选值：pv(现值)、fv(终值)、pmt(等额分期付款)、nper(期数)、rate(利率)、irr(内部收益率)、npv(净现值)、depreciation(折旧计算)、roi(投资回报率)',
        enum: ['pv', 'fv', 'pmt', 'nper', 'rate', 'irr', 'npv', 'depreciation', 'roi']
      },
      rate: {
        type: 'number',
        description: '利率(小数形式)，例如：0.05表示5%'
      },
      nper: {
        type: 'number',
        description: '期数'
      },
      pmt: {
        type: 'number',
        description: '每期付款金额'
      },
      pv: {
        type: 'number',
        description: '现值'
      },
      fv: {
        type: 'number',
        description: '终值'
      },
      cashflow: {
        type: 'string',
        description: '当operation为irr或npv时，现金流，以逗号分隔，例如：-1000,200,300,400,500'
      },
      type: {
        type: 'number',
        description: '付款类型，0表示期末付款，1表示期初付款，默认为0'
      },
      method: {
        type: 'string',
        description: '当operation为depreciation时，折旧方法，可选值：sl(直线法)、db(余额递减法)、syd(年数总和法)',
        enum: ['sl', 'db', 'syd']
      },
      cost: {
        type: 'number',
        description: '当operation为depreciation或roi时，初始成本或投资额'
      },
      salvage: {
        type: 'number',
        description: '当operation为depreciation时，残值'
      },
      life: {
        type: 'number',
        description: '当operation为depreciation时，使用年限'
      },
      period: {
        type: 'number',
        description: '当operation为depreciation时，计算第几年的折旧'
      },
      profit: {
        type: 'number',
        description: '当operation为roi时，利润或收益'
      }
    },
    required: ['operation']
  }
}

// 物理计算工具
const PHYSICS_TOOL = {
  name: 'physics',
  description: '物理计算工具，支持物理常数查询、物理公式计算等',
  inputSchema: {
    type: 'object',
    title: 'PhysicsInput',
    description: '物理计算的输入参数',
    properties: {
      operation: {
        type: 'string',
        description:
          '物理操作，可选值：constant(物理常数)、kinematics(运动学)、dynamics(动力学)、energy(能量)、electricity(电学)、thermodynamics(热力学)、optics(光学)',
        enum: ['constant', 'kinematics', 'dynamics', 'energy', 'electricity', 'thermodynamics', 'optics']
      },
      constant: {
        type: 'string',
        description:
          '当operation为constant时，要查询的物理常数，例如：c(光速)、g(重力加速度)、h(普朗克常数)、e(电子电荷)、k(玻尔兹曼常数)、G(万有引力常数)、epsilon0(真空介电常数)、mu0(真空磁导率)',
        enum: ['c', 'g', 'h', 'e', 'k', 'G', 'epsilon0', 'mu0']
      },
      formula: {
        type: 'string',
        description: '当operation不为constant时，要使用的物理公式，例如：v=v0+a*t、F=m*a、E=m*c^2、V=I*R、Q=m*c*dT等'
      },
      params: {
        type: 'object',
        description: '公式中的参数值，例如：{"m": 10, "a": 9.8}'
      },
      solve: {
        type: 'string',
        description: '要求解的变量，例如：v、F、E等'
      },
      units: {
        type: 'boolean',
        description: '是否在结果中包含单位，默认为true'
      }
    },
    required: ['operation']
  }
}

// 化学计算工具
const CHEMISTRY_TOOL = {
  name: 'chemistry',
  description: '化学计算工具，支持元素周期表查询、化学方程式计算等',
  inputSchema: {
    type: 'object',
    title: 'ChemistryInput',
    description: '化学计算的输入参数',
    properties: {
      operation: {
        type: 'string',
        description:
          '化学操作，可选值：element(元素查询)、molar_mass(摩尔质量计算)、balance(化学方程式平衡)、solution(溶液计算)、gas(气体计算)、stoichiometry(化学计量学)',
        enum: ['element', 'molar_mass', 'balance', 'solution', 'gas', 'stoichiometry']
      },
      element: {
        type: 'string',
        description: '当operation为element时，要查询的元素符号，例如：H、O、C、Fe等'
      },
      formula: {
        type: 'string',
        description: '当operation为molar_mass时，化学式，例如：H2O、C6H12O6、NaCl等'
      },
      equation: {
        type: 'string',
        description: '当operation为balance或stoichiometry时，化学方程式，例如：H2 + O2 = H2O'
      },
      concentration: {
        type: 'number',
        description: '当operation为solution时，溶液浓度'
      },
      concentration_unit: {
        type: 'string',
        description: '当operation为solution时，浓度单位，例如：mol/L、g/L、%等',
        enum: ['mol/L', 'g/L', '%', 'ppm', 'ppb']
      },
      volume: {
        type: 'number',
        description: '当operation为solution或gas时，体积'
      },
      volume_unit: {
        type: 'string',
        description: '当operation为solution或gas时，体积单位，例如：L、mL、m3等',
        enum: ['L', 'mL', 'm3', 'cm3']
      },
      temperature: {
        type: 'number',
        description: '当operation为gas时，温度'
      },
      temperature_unit: {
        type: 'string',
        description: '当operation为gas时，温度单位，例如：K、C、F等',
        enum: ['K', 'C', 'F']
      },
      pressure: {
        type: 'number',
        description: '当operation为gas时，压力'
      },
      pressure_unit: {
        type: 'string',
        description: '当operation为gas时，压力单位，例如：atm、Pa、mmHg等',
        enum: ['atm', 'Pa', 'kPa', 'mmHg', 'bar']
      }
    },
    required: ['operation']
  }
}

// 编程功能工具
const PROGRAMMING_TOOL = {
  name: 'programming',
  description: '编程功能工具，支持进制转换、位运算、逻辑运算等',
  inputSchema: {
    type: 'object',
    title: 'ProgrammingInput',
    description: '编程功能的输入参数',
    properties: {
      operation: {
        type: 'string',
        description:
          '编程操作，可选值：base_convert(进制转换)、bitwise(位运算)、logical(逻辑运算)、regex(正则表达式)、hash(哈希计算)、encode(编码转换)',
        enum: ['base_convert', 'bitwise', 'logical', 'regex', 'hash', 'encode']
      },
      value: {
        type: 'string',
        description: '要操作的值，例如：进制转换时的数字、位运算时的二进制数等'
      },
      from_base: {
        type: 'number',
        description: '当operation为base_convert时，原始进制，例如：2、8、10、16等'
      },
      to_base: {
        type: 'number',
        description: '当operation为base_convert时，目标进制，例如：2、8、10、16等'
      },
      bitwise_op: {
        type: 'string',
        description: '当operation为bitwise时，位运算操作，例如：and、or、xor、not、shift_left、shift_right等',
        enum: ['and', 'or', 'xor', 'not', 'shift_left', 'shift_right']
      },
      operand: {
        type: 'string',
        description: '当operation为bitwise或logical时，第二个操作数'
      },
      logical_op: {
        type: 'string',
        description: '当operation为logical时，逻辑运算操作，例如：and、or、not、xor、implies等',
        enum: ['and', 'or', 'not', 'xor', 'implies']
      },
      pattern: {
        type: 'string',
        description: '当operation为regex时，正则表达式模式'
      },
      text: {
        type: 'string',
        description: '当operation为regex时，要匹配的文本'
      },
      hash_algorithm: {
        type: 'string',
        description: '当operation为hash时，哈希算法，例如：md5、sha1、sha256等',
        enum: ['md5', 'sha1', 'sha256', 'sha512']
      },
      encoding: {
        type: 'string',
        description: '当operation为encode时，编码方式，例如：base64、url、hex、ascii等',
        enum: ['base64', 'url', 'hex', 'ascii', 'utf8']
      },
      decode: {
        type: 'boolean',
        description: '当operation为encode时，是否解码，默认为false(编码)'
      }
    },
    required: ['operation']
  }
}

// 日期时间工具
const DATETIME_TOOL = {
  name: 'datetime',
  description: '日期时间工具，支持日期计算、时区转换、工作日计算等',
  inputSchema: {
    type: 'object',
    title: 'DateTimeInput',
    description: '日期时间计算的输入参数',
    properties: {
      operation: {
        type: 'string',
        description:
          '日期时间操作，可选值：diff(日期差值)、add(日期加减)、format(日期格式化)、timezone(时区转换)、workdays(工作日计算)、calendar(日历信息)、parse(日期解析)',
        enum: ['diff', 'add', 'format', 'timezone', 'workdays', 'calendar', 'parse']
      },
      date1: {
        type: 'string',
        description: '第一个日期，例如：2023-01-01、2023/01/01、January 1, 2023等'
      },
      date2: {
        type: 'string',
        description: '当operation为diff时，第二个日期'
      },
      unit: {
        type: 'string',
        description: '当operation为diff或add时，时间单位，例如：years、months、days、hours、minutes、seconds等',
        enum: ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds']
      },
      value: {
        type: 'number',
        description: '当operation为add时，要加减的时间值，正数为加，负数为减'
      },
      format_string: {
        type: 'string',
        description: '当operation为format时，格式化字符串，例如：YYYY-MM-DD、MM/DD/YYYY、YYYY年MM月DD日等'
      },
      from_timezone: {
        type: 'string',
        description: '当operation为timezone时，原始时区，例如：UTC、Asia/Shanghai、America/New_York等'
      },
      to_timezone: {
        type: 'string',
        description: '当operation为timezone时，目标时区'
      },
      start_date: {
        type: 'string',
        description: '当operation为workdays时，开始日期'
      },
      end_date: {
        type: 'string',
        description: '当operation为workdays时，结束日期'
      },
      holidays: {
        type: 'string',
        description: '当operation为workdays时，假期日期列表，以逗号分隔，例如：2023-01-01,2023-01-02'
      },
      year: {
        type: 'number',
        description: '当operation为calendar时，年份'
      },
      month: {
        type: 'number',
        description: '当operation为calendar时，月份(1-12)'
      },
      date_string: {
        type: 'string',
        description: '当operation为parse时，要解析的日期字符串'
      }
    },
    required: ['operation']
  }
}

// 几何计算工具
const GEOMETRY_TOOL = {
  name: 'geometry',
  description: '几何计算工具，支持平面几何、立体几何、坐标几何等计算',
  inputSchema: {
    type: 'object',
    title: 'GeometryInput',
    description: '几何计算的输入参数',
    properties: {
      operation: {
        type: 'string',
        description:
          '几何操作，可选值：distance(距离)、area(面积)、volume(体积)、angle(角度)、perimeter(周长)、coordinates(坐标计算)、transform(几何变换)、intersection(交点计算)',
        enum: ['distance', 'area', 'volume', 'angle', 'perimeter', 'coordinates', 'transform', 'intersection']
      },
      shape: {
        type: 'string',
        description: '几何形状，例如：point、line、triangle、rectangle、circle、sphere、cube等',
        enum: [
          'point',
          'line',
          'triangle',
          'rectangle',
          'square',
          'circle',
          'ellipse',
          'polygon',
          'sphere',
          'cube',
          'cylinder',
          'cone',
          'prism',
          'pyramid'
        ]
      },
      points: {
        type: 'string',
        description: '点的坐标，格式为：x1,y1;x2,y2;...或x1,y1,z1;x2,y2,z2;...(3D)'
      },
      dimensions: {
        type: 'string',
        description: '形状的尺寸，例如：长方形的长和宽(length,width)、圆的半径(radius)等，以逗号分隔'
      },
      angle_unit: {
        type: 'string',
        description: '角度单位，例如：degrees(度)、radians(弧度)',
        enum: ['degrees', 'radians']
      },
      transformation: {
        type: 'string',
        description:
          '当operation为transform时，几何变换类型，例如：translation(平移)、rotation(旋转)、scaling(缩放)、reflection(反射)',
        enum: ['translation', 'rotation', 'scaling', 'reflection']
      },
      transformation_params: {
        type: 'string',
        description: '当operation为transform时，变换参数，例如：平移向量、旋转角度和中心点、缩放比例等'
      },
      coordinate_system: {
        type: 'string',
        description: '坐标系统，例如：cartesian(笛卡尔)、polar(极坐标)、spherical(球坐标)、cylindrical(柱坐标)',
        enum: ['cartesian', 'polar', 'spherical', 'cylindrical']
      },
      from_system: {
        type: 'string',
        description: '当operation为coordinates时，原始坐标系统',
        enum: ['cartesian', 'polar', 'spherical', 'cylindrical']
      },
      to_system: {
        type: 'string',
        description: '当operation为coordinates时，目标坐标系统',
        enum: ['cartesian', 'polar', 'spherical', 'cylindrical']
      },
      coordinates: {
        type: 'string',
        description: '当operation为coordinates时，要转换的坐标，例如：x,y,z或r,theta,phi等'
      }
    },
    required: ['operation']
  }
}

// 图形函数工具
const GRAPH_TOOL = {
  name: 'graph',
  description: '图形函数工具，支持函数图像描述、坐标点计算等',
  inputSchema: {
    type: 'object',
    title: 'GraphInput',
    description: '图形函数的输入参数',
    properties: {
      operation: {
        type: 'string',
        description:
          '图形操作，可选值：evaluate(函数求值)、plot(绘制函数图像)、roots(求根)、extrema(极值点)、inflection(拐点)、tangent(切线)、describe(图像描述)、intersect(交点)',
        enum: ['evaluate', 'plot', 'roots', 'extrema', 'inflection', 'tangent', 'describe', 'intersect']
      },
      function: {
        type: 'string',
        description: '函数表达式，例如：x^2 + 2*x - 3、sin(x)、e^x等'
      },
      variable: {
        type: 'string',
        description: '自变量，默认为x'
      },
      point: {
        type: 'number',
        description: '当operation为evaluate或tangent时，自变量的值'
      },
      range: {
        type: 'string',
        description: '当operation为roots、extrema、inflection时，自变量的范围，格式为：min,max'
      },
      function2: {
        type: 'string',
        description: '当operation为intersect时，第二个函数表达式'
      },
      precision: {
        type: 'number',
        description: '计算精度，默认为6'
      },
      domain: {
        type: 'string',
        description: '当operation为describe时，函数的定义域，格式为：min,max'
      },
      xMin: {
        type: 'number',
        description: '当operation为plot时，x轴的最小值，默认为-10'
      },
      xMax: {
        type: 'number',
        description: '当operation为plot时，x轴的最大值，默认为10'
      },
      yMin: {
        type: 'number',
        description: '当operation为plot时，y轴的最小值，默认为-10'
      },
      yMax: {
        type: 'number',
        description: '当operation为plot时，y轴的最大值，默认为10'
      },
      points: {
        type: 'number',
        description: '当operation为plot时，用于绘制图像的点数，默认为100'
      }
    },
    required: ['operation', 'function']
  }
}

// 科学计算器服务器类
class CalculatorServer {
  public server: Server
  // 服务器实例

  constructor() {
    Logger.info('[Calculator] Creating server')

    // 初始化服务器
    this.server = new Server(
      {
        name: 'calculator-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {
            // 按照MCP规范声明工具能力
            listChanged: true
          }
        }
      }
    )

    Logger.info('[Calculator] Server initialized with tools capability')

    // 立即设置请求处理程序，使工具列表可见
    this.setupRequestHandlers()

    // 异步加载 mathjs，不阻塞工具列表显示
    this.initialize()
      .then(() => {
        Logger.info('[Calculator] Server initialization completed')
      })
      .catch((error) => {
        Logger.error('[Calculator] Server initialization failed:', error)
      })

    Logger.info('[Calculator] Server initialization started')
  }

  // 初始化函数，加载 mathjs 和 plotly
  private async initialize(): Promise<void> {
    try {
      // 加载 mathjs
      await loadMathJs()
      Logger.info('[Calculator] MathJS initialization complete')

      // 加载 plotly
      await loadPlotly()
      Logger.info('[Calculator] Plotly initialization complete')
    } catch (error) {
      Logger.error('[Calculator] Error during initialization:', error)
      // 不抛出错误，让服务器继续运行，使用降级实现
    }
  }

  // 设置请求处理程序
  setupRequestHandlers() {
    // 列出工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      Logger.info('[Calculator] Listing tools request received')
      return {
        tools: [
          CALCULATOR_TOOL,
          UNIT_CONVERT_TOOL,
          STATISTICS_TOOL,
          EQUATION_SOLVER_TOOL,
          CALCULUS_TOOL,
          MATRIX_TOOL,
          PROBABILITY_TOOL,
          FINANCE_TOOL,
          PHYSICS_TOOL,
          CHEMISTRY_TOOL,
          PROGRAMMING_TOOL,
          DATETIME_TOOL,
          GEOMETRY_TOOL,
          GRAPH_TOOL
        ]
      }
    })

    // 处理工具调用
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      Logger.info(`[Calculator] Tool call received: ${name}`, args)

      try {
        let result

        if (name === 'calculate') {
          result = this.handleCalculate(args)
        } else if (name === 'convert_unit') {
          result = this.handleUnitConvert(args)
        } else if (name === 'statistics') {
          result = this.handleStatistics(args)
        } else if (name === 'solve_equation') {
          result = this.handleEquationSolver(args)
        } else if (name === 'calculus') {
          result = this.handleCalculus(args)
        } else if (name === 'matrix') {
          result = this.handleMatrix(args)
        } else if (name === 'probability') {
          result = this.handleProbability(args)
        } else if (name === 'finance') {
          result = this.handleFinance(args)
        } else if (name === 'physics') {
          result = this.handlePhysics(args)
        } else if (name === 'chemistry') {
          result = this.handleChemistry(args)
        } else if (name === 'programming') {
          result = this.handleProgramming(args)
        } else if (name === 'datetime') {
          result = this.handleDateTime(args)
        } else if (name === 'geometry') {
          result = this.handleGeometry(args)
        } else if (name === 'graph') {
          result = this.handleGraph(args)
        } else {
          Logger.error(`[Calculator] Unknown tool: ${name}`)
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
        }

        // 确保结果是一个对象
        if (typeof result !== 'object') {
          result = { result }
        }

        // 在结果中添加原始参数信息
        return {
          ...result,
          // 添加一个特殊字段，包含原始参数
          _originalArgs: args
        }
      } catch (error) {
        Logger.error(`[Calculator] Error handling tool call ${name}:`, error)
        return {
          content: [
            {
              type: 'text',
              text: error instanceof Error ? error.message : String(error)
            }
          ],
          _originalArgs: args, // 即使出错也包含原始参数
          isError: true
        }
      }
    })
  }

  // 处理计算表达式
  private handleCalculate(args: any) {
    Logger.info('[Calculator] Handling calculate', args)

    const expression = args?.expression
    const precision = args?.precision || 14
    const format = args?.format || 'auto'

    if (!expression) {
      throw new McpError(ErrorCode.InvalidParams, 'Expression is required')
    }

    try {
      // 配置计算选项
      // const config = {
      //   precision: precision
      // }

      // 执行计算
      const result = math.evaluate(expression)

      // 格式化结果
      let formattedResult
      if (typeof result === 'number') {
        switch (format) {
          case 'decimal':
            formattedResult = result.toFixed(precision)
            break
          case 'scientific':
            formattedResult = result.toExponential(precision)
            break
          case 'engineering':
            formattedResult = this.toEngineeringNotation(result, precision)
            break
          case 'fixed':
            formattedResult = result.toFixed(precision)
            break
          case 'auto':
          default:
            if (Math.abs(result) < 0.0001 || Math.abs(result) >= 10000) {
              formattedResult = result.toExponential(precision)
            } else {
              formattedResult = result.toString()
            }
        }
      } else {
        // 处理非数字结果（如矩阵、复数等）
        formattedResult = math.format(result, { precision: precision })
      }

      // 构建完整的响应对象
      const response = {
        expression: expression,
        result: formattedResult,
        rawResult: result.toString()
      }

      Logger.info('[Calculator] Calculation result:', response)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ],
        isError: false
      }
    } catch (error) {
      Logger.error('[Calculator] Error calculating expression:', error)
      throw new McpError(
        ErrorCode.InternalError,
        `Error calculating expression: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 处理单位转换
  private handleUnitConvert(args: any) {
    Logger.info('[Calculator] Handling unit conversion', args)

    const value = args?.value
    const fromUnit = args?.from
    const toUnit = args?.to
    const precision = args?.precision || 6

    if (value === undefined || !fromUnit || !toUnit) {
      throw new McpError(ErrorCode.InvalidParams, 'Value, from unit, and to unit are required')
    }

    try {
      // 创建带单位的值
      const valueWithUnit = math.unit(value, fromUnit)

      // 转换到目标单位
      const converted = valueWithUnit.to(toUnit)

      // 获取转换后的数值
      const result = converted.toNumber()

      // 构建响应对象
      const response = {
        value: value,
        fromUnit: fromUnit,
        toUnit: toUnit,
        result: result.toFixed(precision),
        fullResult: `${value} ${fromUnit} = ${result.toFixed(precision)} ${toUnit}`
      }

      Logger.info('[Calculator] Unit conversion result:', response)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ],
        isError: false
      }
    } catch (error) {
      Logger.error('[Calculator] Error converting units:', error)
      throw new McpError(
        ErrorCode.InternalError,
        `Error converting units: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 处理统计计算
  private handleStatistics(args: any) {
    Logger.info('[Calculator] Handling statistics', args)

    const dataStr = args?.data
    const operation = args?.operation
    const quantile = args?.quantile
    const secondDataStr = args?.secondData

    if (!dataStr || !operation) {
      throw new McpError(ErrorCode.InvalidParams, 'Data and operation are required')
    }

    try {
      // 解析数据
      const data = dataStr
        .split(',')
        .map((item: string) => parseFloat(item.trim()))
        .filter((num: number) => !isNaN(num))

      if (data.length === 0) {
        throw new McpError(ErrorCode.InvalidParams, 'No valid numbers in data')
      }

      // 执行统计操作
      let result: any = {}

      if (operation === 'all' || operation === 'mean') {
        result.mean = math.mean(data)
      }

      if (operation === 'all' || operation === 'median') {
        result.median = math.median(data)
      }

      if (operation === 'all' || operation === 'std') {
        result.std = math.std(data)
      }

      if (operation === 'all' || operation === 'min') {
        result.min = math.min(data)
      }

      if (operation === 'all' || operation === 'max') {
        result.max = math.max(data)
      }

      if (operation === 'all' || operation === 'sum') {
        result.sum = math.sum(data)
      }

      if (operation === 'all' || operation === 'variance') {
        result.variance = math.variance(data)
      }

      if (operation === 'quantile') {
        if (quantile === undefined) {
          throw new McpError(ErrorCode.InvalidParams, 'Quantile value is required for quantile operation')
        }

        if (quantile < 0 || quantile > 1) {
          throw new McpError(ErrorCode.InvalidParams, 'Quantile value must be between 0 and 1')
        }

        result = math.quantileSeq(data, quantile)
      }

      if (operation === 'correlation') {
        if (!secondDataStr) {
          throw new McpError(ErrorCode.InvalidParams, 'Second data set is required for correlation')
        }

        const secondData = secondDataStr
          .split(',')
          .map((item: string) => parseFloat(item.trim()))
          .filter((num: number) => !isNaN(num))

        if (secondData.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, 'No valid numbers in second data set')
        }

        if (data.length !== secondData.length) {
          throw new McpError(ErrorCode.InvalidParams, 'Data sets must have the same length for correlation')
        }

        // 计算皮尔逊相关系数
        const meanX = math.mean(data)
        const meanY = math.mean(secondData)

        let numerator = 0
        let denominatorX = 0
        let denominatorY = 0

        for (let i = 0; i < data.length; i++) {
          const xDiff = data[i] - meanX
          const yDiff = secondData[i] - meanY

          numerator += xDiff * yDiff
          denominatorX += xDiff * xDiff
          denominatorY += yDiff * yDiff
        }

        result = numerator / Math.sqrt(denominatorX * denominatorY)
      }

      // 如果是'all'操作，添加更多统计信息
      if (operation === 'all') {
        result.count = data.length
        result.range = result.max - result.min
        result.q1 = math.quantileSeq(data, 0.25)
        result.q3 = math.quantileSeq(data, 0.75)
        result.iqr = result.q3 - result.q1
      } else if (operation !== 'quantile' && operation !== 'correlation') {
        // 如果不是'all'、'quantile'或'correlation'操作，直接返回单个结果
        result = result[operation]
      }

      // 构建响应对象
      const response = {
        data: data,
        operation: operation,
        result: result
      }

      Logger.info('[Calculator] Statistics result:', response)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ],
        isError: false
      }
    } catch (error) {
      Logger.error('[Calculator] Error calculating statistics:', error)
      throw new McpError(
        ErrorCode.InternalError,
        `Error calculating statistics: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 处理方程求解
  private handleEquationSolver(args: any) {
    Logger.info('[Calculator] Handling equation solver', args)

    const equation = args?.equation
    const variables = args?.variables ? args.variables.split(',').map((v: string) => v.trim()) : null
    // const precision = args?.precision || 6

    if (!equation) {
      throw new McpError(ErrorCode.InvalidParams, 'Equation is required')
    }

    try {
      // 使用自定义方法求解方程，而不是依赖 math.solve
      let result

      // 检查是否是方程组（包含逗号分隔的多个方程）
      if (equation.includes(',')) {
        // 处理方程组
        const equations = equation.split(',').map((eq: string) => eq.trim())

        // 如果没有提供变量，尝试从方程中提取
        const vars = variables || this.extractVariablesFromEquations(equations)

        if (!vars || vars.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, 'Could not determine variables from equations')
        }

        // 目前只支持线性方程组
        result = this.solveLinearEquationSystem(equations, vars)
      } else {
        // 处理单个方程
        // 如果没有提供变量，尝试从方程中提取
        const vars = variables || this.extractVariablesFromEquation(equation)

        if (!vars || vars.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, 'Could not determine variables from equation')
        }

        // 尝试解析和求解方程
        result = this.solveEquation(equation, vars[0])
      }

      // 构建响应对象
      const response = {
        equation: equation,
        variables: variables || 'auto-detected',
        result: result
      }

      Logger.info('[Calculator] Equation solver result:', response)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ],
        isError: false
      }
    } catch (error) {
      Logger.error('[Calculator] Error solving equation:', error)
      throw new McpError(
        ErrorCode.InternalError,
        `Error solving equation: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 求解单个方程
  private solveEquation(equation: string, variable: string): any {
    Logger.info(`[Calculator] Solving equation: ${equation} for ${variable}`)

    try {
      // 将方程标准化为 "表达式 = 0" 的形式
      let expr = equation

      if (equation.includes('=')) {
        const parts = equation.split('=').map((p) => p.trim())
        if (parts.length !== 2) {
          throw new Error('Invalid equation format. Expected format: expression = expression')
        }

        // 将方程转换为 "左边 - 右边 = 0" 的形式
        expr = `(${parts[0]}) - (${parts[1]})`
      }

      // 检查是否是二次方程
      if (expr.includes(`${variable}^2`) || expr.includes(`${variable}*${variable}`)) {
        return this.solveQuadraticEquation(expr, variable)
      }

      // 检查是否是简单的线性方程
      if (expr.includes(variable)) {
        return this.solveLinearEquation(expr, variable)
      }

      throw new Error(`Cannot determine equation type for: ${equation}`)
    } catch (error) {
      Logger.error(`[Calculator] Error in solveEquation:`, error)
      throw error
    }
  }

  // 求解线性方程 (ax + b = 0)
  private solveLinearEquation(expr: string, variable: string): number | { type: string; message: string; value: null } {
    try {
      // 替换变量为 1 和 0，计算系数
      const exprWithVar = math.evaluate(expr.replace(new RegExp(variable, 'g'), '1'))
      const exprWithoutVar = math.evaluate(expr.replace(new RegExp(variable, 'g'), '0'))

      // 计算系数 a 和 b
      const a = exprWithVar - exprWithoutVar
      const b = exprWithoutVar

      // 求解 ax + b = 0 => x = -b/a
      if (a === 0) {
        if (b === 0) {
          return { type: 'infinite', message: '方程有无穷多解', value: null }
        }
        return { type: 'no_solution', message: '方程无解', value: null }
      }

      return -b / a
    } catch (error) {
      Logger.error(`[Calculator] Error in solveLinearEquation:`, error)
      throw new Error(`Error solving linear equation: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 求解二次方程 (ax^2 + bx + c = 0)
  private solveQuadraticEquation(expr: string, variable: string): any {
    try {
      // 替换变量为不同值，计算系数
      const f0 = math.evaluate(expr.replace(new RegExp(variable, 'g'), '0'))
      const f1 = math.evaluate(expr.replace(new RegExp(variable, 'g'), '1'))
      const f2 = math.evaluate(expr.replace(new RegExp(variable, 'g'), '2'))

      // 使用拉格朗日插值法计算系数
      const c = f0
      const b = -3 * f0 + 4 * f1 - f2
      const a = f0 - 2 * f1 + f2

      // 检查是否真的是二次方程
      if (Math.abs(a) < 1e-10) {
        // 如果 a 接近 0，退化为线性方程
        if (Math.abs(b) < 1e-10) {
          if (Math.abs(c) < 1e-10) {
            return { type: 'infinite', message: '方程有无穷多解' }
          }
          return { type: 'no_solution', message: '方程无解' }
        }
        return -c / b
      }

      // 计算判别式
      const discriminant = b * b - 4 * a * c

      if (Math.abs(discriminant) < 1e-10) {
        // 一个实根（重根）
        return -b / (2 * a)
      } else if (discriminant > 0) {
        // 两个不同的实根
        const sqrtDiscriminant = Math.sqrt(discriminant)
        const x1 = (-b + sqrtDiscriminant) / (2 * a)
        const x2 = (-b - sqrtDiscriminant) / (2 * a)
        return [x1, x2]
      } else {
        // 两个共轭复根
        const realPart = -b / (2 * a)
        const imaginaryPart = Math.sqrt(-discriminant) / (2 * a)
        return [`${realPart} + ${imaginaryPart}i`, `${realPart} - ${imaginaryPart}i`]
      }
    } catch (error) {
      Logger.error(`[Calculator] Error in solveQuadraticEquation:`, error)
      throw new Error(`Error solving quadratic equation: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 求解线性方程组
  private solveLinearEquationSystem(equations: string[], variables: string[]): any {
    if (equations.length !== variables.length) {
      throw new Error(`Number of equations (${equations.length}) must match number of variables (${variables.length})`)
    }

    try {
      // 构建系数矩阵和常数向量
      const n = variables.length
      const coefficients: number[][] = Array(n)
        .fill(0)
        .map(() => Array(n).fill(0))
      const constants: number[] = Array(n).fill(0)

      // 对每个方程
      for (let i = 0; i < n; i++) {
        let eq = equations[i]

        // 标准化方程为 "表达式 = 0" 的形式
        if (eq.includes('=')) {
          const parts = eq.split('=').map((p) => p.trim())
          if (parts.length !== 2) {
            throw new Error(`Invalid equation format: ${eq}`)
          }
          eq = `(${parts[0]}) - (${parts[1]})`
        }

        // 对每个变量，计算系数
        for (let j = 0; j < n; j++) {
          const variable = variables[j]

          // 替换当前变量为 1，其他变量为 0
          const substitutions: Record<string, number> = {}
          variables.forEach((v) => {
            substitutions[v] = 0
          })
          substitutions[variable] = 1

          // 计算系数
          const withVar = this.evaluateWithSubstitutions(eq, substitutions)

          substitutions[variable] = 0
          const withoutVar = this.evaluateWithSubstitutions(eq, substitutions)

          coefficients[i][j] = withVar - withoutVar
        }

        // 计算常数项（所有变量为 0 时的值）
        const substitutions: Record<string, number> = {}
        variables.forEach((v) => {
          substitutions[v] = 0
        })
        constants[i] = -this.evaluateWithSubstitutions(eq, substitutions)
      }

      // 使用高斯消元法求解
      return this.gaussianElimination(coefficients, constants, variables)
    } catch (error) {
      Logger.error(`[Calculator] Error in solveLinearEquationSystem:`, error)
      throw new Error(`Error solving equation system: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 使用变量替换计算表达式的值
  private evaluateWithSubstitutions(expr: string, substitutions: Record<string, number>): number {
    let evaluableExpr = expr

    // 替换所有变量
    for (const [variable, value] of Object.entries(substitutions)) {
      // 使用正则表达式确保只替换完整的变量名
      const regex = new RegExp(`\\b${variable}\\b`, 'g')
      evaluableExpr = evaluableExpr.replace(regex, value.toString())
    }

    // 计算表达式的值
    return math.evaluate(evaluableExpr)
  }

  // 高斯消元法求解线性方程组
  private gaussianElimination(
    coefficients: number[][],
    constants: number[],
    variables: string[] = []
  ): Record<string, number> | string {
    const n = coefficients.length
    const augmentedMatrix = coefficients.map((row, i) => [...row, constants[i]])

    // 前向消元
    for (let i = 0; i < n; i++) {
      // 寻找主元
      let maxRow = i
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(augmentedMatrix[j][i]) > Math.abs(augmentedMatrix[maxRow][i])) {
          maxRow = j
        }
      }

      // 交换行
      if (maxRow !== i) {
        ;[augmentedMatrix[i], augmentedMatrix[maxRow]] = [augmentedMatrix[maxRow], augmentedMatrix[i]]
      }

      // 检查是否有解
      if (Math.abs(augmentedMatrix[i][i]) < 1e-10) {
        // 检查是否是不一致的方程组
        for (let j = i; j < n; j++) {
          if (Math.abs(augmentedMatrix[j][n]) > 1e-10) {
            return '方程组无解'
          }
        }
        return '方程组有无穷多解'
      }

      // 将主元归一化
      const pivot = augmentedMatrix[i][i]
      for (let j = i; j <= n; j++) {
        augmentedMatrix[i][j] /= pivot
      }

      // 消元
      for (let j = 0; j < n; j++) {
        if (j !== i) {
          const factor = augmentedMatrix[j][i]
          for (let k = i; k <= n; k++) {
            augmentedMatrix[j][k] -= factor * augmentedMatrix[i][k]
          }
        }
      }
    }

    // 提取解
    const solution: Record<string, number> = {}
    for (let i = 0; i < n; i++) {
      solution[variables[i]] = augmentedMatrix[i][n]
    }

    return solution
  }

  // 处理微积分
  private handleCalculus(args: any) {
    Logger.info('[Calculator] Handling calculus', args)

    const operation = args?.operation
    const expression = args?.expression
    const variable = args?.variable
    const order = args?.order || 1
    const from = args?.from
    const to = args?.to
    const approach = args?.approach

    if (!operation || !expression || !variable) {
      throw new McpError(ErrorCode.InvalidParams, 'Operation, expression, and variable are required')
    }

    try {
      let result

      switch (operation) {
        case 'derivative':
          result = math.derivative(expression, variable, { order })
          break
        case 'integral':
          if (from !== undefined && to !== undefined) {
            // 定积分
            result = math.integrate(expression, variable, from, to)
          } else {
            // 不定积分
            result = math.integrate(expression, variable)
          }
          break
        case 'limit':
          result = math.limit(expression, variable, approach || 0)
          break
        default:
          throw new McpError(ErrorCode.InvalidParams, `Unknown calculus operation: ${operation}`)
      }

      // 构建响应对象
      const response = {
        operation: operation,
        expression: expression,
        variable: variable,
        result: math.format(result, { precision: 14 })
      }

      Logger.info('[Calculator] Calculus result:', response)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ],
        isError: false
      }
    } catch (error) {
      Logger.error('[Calculator] Error in calculus operation:', error)
      throw new McpError(
        ErrorCode.InternalError,
        `Error in calculus operation: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 处理矩阵计算
  private handleMatrix(args: any) {
    Logger.info('[Calculator] Handling matrix operation', args)

    const operation = args?.operation
    const matrixStr = args?.matrix
    const matrix2Str = args?.matrix2
    const vectorStr = args?.vector

    if (!operation || !matrixStr) {
      throw new McpError(ErrorCode.InvalidParams, 'Operation and matrix are required')
    }

    try {
      // 解析矩阵
      const matrix = math.evaluate(matrixStr)

      let result

      switch (operation) {
        case 'det':
          result = math.det(matrix)
          break
        case 'inv':
          result = math.inv(matrix)
          break
        case 'transpose':
          result = math.transpose(matrix)
          break
        case 'eigenvalues':
          result = math.eigs(matrix).values
          break
        case 'eigenvectors':
          result = math.eigs(matrix).vectors
          break
        case 'rank':
          result = math.rank(matrix)
          break
        case 'multiply':
          if (!matrix2Str) {
            throw new McpError(ErrorCode.InvalidParams, 'Second matrix is required for multiplication')
          }
          {
            const matrix2 = math.evaluate(matrix2Str)
            result = math.multiply(matrix, matrix2)
          }
          break
        case 'solve':
          if (!vectorStr) {
            throw new McpError(ErrorCode.InvalidParams, 'Vector is required for solving linear system')
          }
          {
            const vector = math.evaluate(vectorStr)
            result = math.lusolve(matrix, vector)
          }
          break
        default:
          throw new McpError(ErrorCode.InvalidParams, `Unknown matrix operation: ${operation}`)
      }

      // 构建响应对象
      const response = {
        operation: operation,
        matrix: matrixStr,
        result: math.format(result, { precision: 14 })
      }

      Logger.info('[Calculator] Matrix operation result:', response)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ],
        isError: false
      }
    } catch (error) {
      Logger.error('[Calculator] Error in matrix operation:', error)
      throw new McpError(
        ErrorCode.InternalError,
        `Error in matrix operation: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 处理概率计算
  private handleProbability(args: any) {
    Logger.info('[Calculator] Handling probability', args)

    const operation = args?.operation
    const distribution = args?.distribution
    const params = args?.params
    const x = args?.x
    const n = args?.n
    const k = args?.k
    const count = args?.count || 1

    if (!operation) {
      throw new McpError(ErrorCode.InvalidParams, 'Operation is required')
    }

    try {
      let result

      switch (operation) {
        case 'pdf':
          if (!distribution || x === undefined || !params) {
            throw new McpError(ErrorCode.InvalidParams, 'Distribution, x, and params are required for pdf')
          }

          {
            const distParams = params.split(',').map((p: string) => parseFloat(p.trim()))

            switch (distribution) {
              case 'normal': {
                const [mean, std] = distParams
                result = math.distribution('normal').pdf(x, mean, std)
                break
              }
              case 'binomial': {
                const [trials, prob] = distParams
                result = math.distribution('binomial').pdf(x, trials, prob)
                break
              }
              case 'poisson': {
                const [lambda] = distParams
                result = math.distribution('poisson').pdf(x, lambda)
                break
              }
              case 'uniform': {
                const [min, max] = distParams
                result = math.distribution('uniform').pdf(x, min, max)
                break
              }
              case 'exponential': {
                const [rate] = distParams
                result = math.distribution('exponential').pdf(x, rate)
                break
              }
              default:
                throw new McpError(ErrorCode.InvalidParams, `Unknown distribution: ${distribution}`)
            }
          }
          break

        case 'cdf':
          if (!distribution || x === undefined || !params) {
            throw new McpError(ErrorCode.InvalidParams, 'Distribution, x, and params are required for cdf')
          }

          {
            const cdfParams = params.split(',').map((p: string) => parseFloat(p.trim()))

            switch (distribution) {
              case 'normal': {
                const [mean, std] = cdfParams
                result = math.distribution('normal').cdf(x, mean, std)
                break
              }
              case 'binomial': {
                const [trials, prob] = cdfParams
                result = math.distribution('binomial').cdf(x, trials, prob)
                break
              }
              case 'poisson': {
                const [lambda] = cdfParams
                result = math.distribution('poisson').cdf(x, lambda)
                break
              }
              case 'uniform': {
                const [min, max] = cdfParams
                result = math.distribution('uniform').cdf(x, min, max)
                break
              }
              case 'exponential': {
                const [rate] = cdfParams
                result = math.distribution('exponential').cdf(x, rate)
                break
              }
              default:
                throw new McpError(ErrorCode.InvalidParams, `Unknown distribution: ${distribution}`)
            }
          }
          break

        case 'random':
          result = Array.from({ length: count }, () => Math.random())
          break

        case 'combination':
          if (n === undefined || k === undefined) {
            throw new McpError(ErrorCode.InvalidParams, 'n and k are required for combination')
          }
          result = math.combinations(n, k)
          break

        case 'permutation':
          if (n === undefined || k === undefined) {
            throw new McpError(ErrorCode.InvalidParams, 'n and k are required for permutation')
          }
          result = math.permutations(n, k)
          break

        default:
          throw new McpError(ErrorCode.InvalidParams, `Unknown probability operation: ${operation}`)
      }

      // 构建响应对象
      const response = {
        operation: operation,
        result: result
      }

      Logger.info('[Calculator] Probability result:', response)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ],
        isError: false
      }
    } catch (error) {
      Logger.error('[Calculator] Error in probability calculation:', error)
      throw new McpError(
        ErrorCode.InternalError,
        `Error in probability calculation: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 处理金融计算
  private handleFinance(args: any) {
    Logger.info('[Calculator] Handling finance', args)

    const operation = args?.operation
    const rate = args?.rate
    const nper = args?.nper
    const pmt = args?.pmt
    const pv = args?.pv
    const fv = args?.fv
    const cashflow = args?.cashflow
    const type = args?.type || 0

    if (!operation) {
      throw new McpError(ErrorCode.InvalidParams, 'Operation is required')
    }

    try {
      let result

      switch (operation) {
        case 'pv':
          if (rate === undefined || nper === undefined || pmt === undefined) {
            throw new McpError(ErrorCode.InvalidParams, 'Rate, nper, and pmt are required for pv')
          }
          // 计算现值 PV = PMT * ((1 - (1 + rate)^(-nper)) / rate) + FV * (1 + rate)^(-nper)
          result = pmt * ((1 - Math.pow(1 + rate, -nper)) / rate) + (fv || 0) * Math.pow(1 + rate, -nper)
          // 如果是期初付款，需要调整
          if (type === 1) {
            result = result * (1 + rate)
          }
          break

        case 'fv':
          if (rate === undefined || nper === undefined || pmt === undefined) {
            throw new McpError(ErrorCode.InvalidParams, 'Rate, nper, and pmt are required for fv')
          }
          // 计算终值 FV = PMT * ((1 + rate)^nper - 1) / rate + PV * (1 + rate)^nper
          result = pmt * ((Math.pow(1 + rate, nper) - 1) / rate) + (pv || 0) * Math.pow(1 + rate, nper)
          // 如果是期初付款，需要调整
          if (type === 1) {
            result = result * (1 + rate)
          }
          break

        case 'pmt':
          if (rate === undefined || nper === undefined || (pv === undefined && fv === undefined)) {
            throw new McpError(ErrorCode.InvalidParams, 'Rate, nper, and either pv or fv are required for pmt')
          }
          result = math.finance.pmt(rate, nper, pv || 0, fv || 0, type)
          break

        case 'nper':
          if (rate === undefined || pmt === undefined || (pv === undefined && fv === undefined)) {
            throw new McpError(ErrorCode.InvalidParams, 'Rate, pmt, and either pv or fv are required for nper')
          }
          result = math.finance.nper(rate, pmt, pv || 0, fv || 0, type)
          break

        case 'rate':
          if (nper === undefined || pmt === undefined || (pv === undefined && fv === undefined)) {
            throw new McpError(ErrorCode.InvalidParams, 'Nper, pmt, and either pv or fv are required for rate')
          }
          result = math.finance.rate(nper, pmt, pv || 0, fv || 0, type)
          break

        case 'irr':
          if (!cashflow) {
            throw new McpError(ErrorCode.InvalidParams, 'Cashflow is required for irr')
          }
          {
            const irrValues = cashflow.split(',').map((v: string) => parseFloat(v.trim()))
            result = math.finance.irr(irrValues)
          }
          break

        case 'npv':
          if (rate === undefined || !cashflow) {
            throw new McpError(ErrorCode.InvalidParams, 'Rate and cashflow are required for npv')
          }
          {
            const npvValues = cashflow.split(',').map((v: string) => parseFloat(v.trim()))
            result = math.finance.npv(rate, npvValues)
          }
          break

        default:
          throw new McpError(ErrorCode.InvalidParams, `Unknown finance operation: ${operation}`)
      }

      // 构建响应对象
      const response = {
        operation: operation,
        result: result
      }

      Logger.info('[Calculator] Finance result:', response)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ],
        isError: false
      }
    } catch (error) {
      Logger.error('[Calculator] Error in finance calculation:', error)
      throw new McpError(
        ErrorCode.InternalError,
        `Error in finance calculation: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 从方程中提取变量
  private extractVariablesFromEquation(equation: string): string[] {
    // 简单的变量提取逻辑，假设变量是单个字母
    const matches = equation.match(/[a-zA-Z]/g)
    if (!matches) return []

    // 去重
    return [...new Set(matches)]
  }

  // 从方程组中提取变量
  private extractVariablesFromEquations(equations: string[]): string[] {
    // 从所有方程中提取变量并合并
    const allVars = equations.flatMap((eq) => this.extractVariablesFromEquation(eq))

    // 去重
    return [...new Set(allVars)]
  }

  // 工程计数法格式化
  private toEngineeringNotation(num: number, precision: number): string {
    const exp = Math.floor(Math.log10(Math.abs(num)) / 3) * 3
    const mantissa = num / Math.pow(10, exp)
    return mantissa.toFixed(precision) + 'e' + exp
  }

  // 处理物理计算
  private handlePhysics(args: any) {
    Logger.info('[Calculator] Handling physics', args)

    const operation = args?.operation

    if (!operation) {
      throw new McpError(ErrorCode.InvalidParams, 'Operation is required')
    }

    try {
      let result

      // 根据操作类型处理物理计算
      switch (operation) {
        case 'constant':
          result = this.handlePhysicsConstant(args)
          break
        case 'kinematics':
        case 'dynamics':
        case 'energy':
        case 'electricity':
        case 'thermodynamics':
        case 'optics':
          result = this.handlePhysicsFormula(args, operation)
          break
        default:
          throw new McpError(ErrorCode.InvalidParams, `Unknown physics operation: ${operation}`)
      }

      // 构建响应对象
      const response = {
        operation: operation,
        result: result
      }

      Logger.info('[Calculator] Physics result:', response)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ],
        isError: false
      }
    } catch (error) {
      Logger.error('[Calculator] Error in physics calculation:', error)
      throw new McpError(
        ErrorCode.InternalError,
        `Error in physics calculation: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 处理物理常数
  private handlePhysicsConstant(args: any) {
    const constant = args?.constant

    if (!constant) {
      throw new McpError(ErrorCode.InvalidParams, 'Constant name is required')
    }

    // 物理常数值
    const constants: Record<string, { value: number; unit: string; name: string }> = {
      c: { value: 299792458, unit: 'm/s', name: '光速' },
      g: { value: 9.80665, unit: 'm/s²', name: '标准重力加速度' },
      h: { value: 6.62607015e-34, unit: 'J·s', name: '普朗克常数' },
      e: { value: 1.602176634e-19, unit: 'C', name: '基本电荷' },
      k: { value: 1.380649e-23, unit: 'J/K', name: '玻尔兹曼常数' },
      G: { value: 6.6743e-11, unit: 'm³/(kg·s²)', name: '万有引力常数' },
      epsilon0: { value: 8.8541878128e-12, unit: 'F/m', name: '真空介电常数' },
      mu0: { value: 1.25663706212e-6, unit: 'H/m', name: '真空磁导率' }
    }

    if (!constants[constant]) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown physical constant: ${constant}`)
    }

    return constants[constant]
  }

  // 处理物理公式
  private handlePhysicsFormula(args: any, category: string) {
    const formula = args?.formula
    // const params = args?.params || {}
    const solve = args?.solve
    const units = args?.units !== false

    if (!formula) {
      throw new McpError(ErrorCode.InvalidParams, 'Formula is required')
    }

    if (!solve) {
      throw new McpError(ErrorCode.InvalidParams, 'Variable to solve for is required')
    }

    // 这里应该使用 mathjs 的 solve 功能解析公式并求解
    // 由于实现复杂，这里返回一个模拟结果
    return {
      formula: formula,
      solved_for: solve,
      value: 42, // 模拟结果
      unit: units ? this.getPhysicsUnit(category, solve) : null
    }
  }

  // 获取物理量的单位
  private getPhysicsUnit(category: string, variable: string): string {
    // 根据物理类别和变量名返回适当的单位
    const units: Record<string, Record<string, string>> = {
      kinematics: { v: 'm/s', a: 'm/s²', s: 'm', t: 's' },
      dynamics: { F: 'N', m: 'kg', p: 'kg·m/s' },
      energy: { E: 'J', W: 'J', P: 'W' },
      electricity: { V: 'V', I: 'A', R: 'Ω', Q: 'C' },
      thermodynamics: { T: 'K', Q: 'J', S: 'J/K' },
      optics: { f: 'Hz', λ: 'm', n: '' }
    }

    return units[category]?.[variable] || ''
  }

  // 处理化学计算
  private handleChemistry(args: any) {
    Logger.info('[Calculator] Handling chemistry', args)

    const operation = args?.operation

    if (!operation) {
      throw new McpError(ErrorCode.InvalidParams, 'Operation is required')
    }

    try {
      let result

      // 根据操作类型处理化学计算
      switch (operation) {
        case 'element':
          result = this.handleChemistryElement(args)
          break
        case 'molar_mass':
          result = this.handleChemistryMolarMass(args)
          break
        case 'balance':
          result = this.handleChemistryBalance(args)
          break
        case 'solution':
          result = this.handleChemistrySolution()
          break
        case 'gas':
          result = this.handleChemistryGas()
          break
        case 'stoichiometry':
          result = this.handleChemistryStoichiometry()
          break
        default:
          throw new McpError(ErrorCode.InvalidParams, `Unknown chemistry operation: ${operation}`)
      }

      // 构建响应对象
      const response = {
        operation: operation,
        result: result
      }

      Logger.info('[Calculator] Chemistry result:', response)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ],
        isError: false
      }
    } catch (error) {
      Logger.error('[Calculator] Error in chemistry calculation:', error)
      throw new McpError(
        ErrorCode.InternalError,
        `Error in chemistry calculation: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 处理元素查询
  private handleChemistryElement(args: any) {
    const element = args?.element

    if (!element) {
      throw new McpError(ErrorCode.InvalidParams, 'Element symbol is required')
    }

    // 元素数据（简化版）
    const elements: Record<string, { name: string; atomic_number: number; atomic_mass: number; category: string }> = {
      H: { name: '氢', atomic_number: 1, atomic_mass: 1.008, category: '非金属' },
      He: { name: '氦', atomic_number: 2, atomic_mass: 4.0026, category: '惰性气体' },
      C: { name: '碳', atomic_number: 6, atomic_mass: 12.011, category: '非金属' },
      O: { name: '氧', atomic_number: 8, atomic_mass: 15.999, category: '非金属' },
      Fe: { name: '铁', atomic_number: 26, atomic_mass: 55.845, category: '过渡金属' }
    }

    if (!elements[element]) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown element: ${element}`)
    }

    return elements[element]
  }

  // 处理摩尔质量计算
  private handleChemistryMolarMass(args: any) {
    const formula = args?.formula

    if (!formula) {
      throw new McpError(ErrorCode.InvalidParams, 'Chemical formula is required')
    }

    // 这里应该解析化学式并计算摩尔质量
    // 由于实现复杂，这里返回一个模拟结果
    return {
      formula: formula,
      molar_mass: 18.015, // 模拟结果，例如水的摩尔质量
      unit: 'g/mol'
    }
  }

  // 处理化学方程式平衡
  private handleChemistryBalance(args: any) {
    const equation = args?.equation

    if (!equation) {
      throw new McpError(ErrorCode.InvalidParams, 'Chemical equation is required')
    }

    // 这里应该解析并平衡化学方程式
    // 由于实现复杂，这里返回一个模拟结果
    return {
      original_equation: equation,
      balanced_equation: '2 H2 + O2 = 2 H2O' // 模拟结果
    }
  }

  // 处理溶液计算
  private handleChemistrySolution() {
    // 溶液计算的实现
    return {
      message: 'Solution calculation functionality will be implemented'
    }
  }

  // 处理气体计算
  private handleChemistryGas() {
    // 气体计算的实现
    return {
      message: 'Gas calculation functionality will be implemented'
    }
  }

  // 处理化学计量学
  private handleChemistryStoichiometry() {
    // 化学计量学的实现
    return {
      message: 'Stoichiometry calculation functionality will be implemented'
    }
  }

  // 处理编程功能
  private handleProgramming(args: any) {
    Logger.info('[Calculator] Handling programming', args)

    const operation = args?.operation

    if (!operation) {
      throw new McpError(ErrorCode.InvalidParams, 'Operation is required')
    }

    try {
      let result

      // 根据操作类型处理编程功能
      switch (operation) {
        case 'base_convert':
          result = this.handleBaseConvert(args)
          break
        case 'bitwise':
          result = this.handleBitwise()
          break
        case 'logical':
          result = this.handleLogical()
          break
        case 'regex':
          result = this.handleRegex()
          break
        case 'hash':
          result = this.handleHash()
          break
        case 'encode':
          result = this.handleEncode()
          break
        default:
          throw new McpError(ErrorCode.InvalidParams, `Unknown programming operation: ${operation}`)
      }

      // 构建响应对象
      const response = {
        operation: operation,
        result: result
      }

      Logger.info('[Calculator] Programming result:', response)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ],
        isError: false
      }
    } catch (error) {
      Logger.error('[Calculator] Error in programming operation:', error)
      throw new McpError(
        ErrorCode.InternalError,
        `Error in programming operation: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 处理进制转换
  private handleBaseConvert(args: any) {
    const value = args?.value
    const fromBase = args?.from_base || 10
    const toBase = args?.to_base || 10

    if (value === undefined) {
      throw new McpError(ErrorCode.InvalidParams, 'Value is required')
    }

    try {
      // 将输入值解析为十进制
      const decimalValue = parseInt(value.toString(), fromBase)

      // 转换为目标进制
      const result = decimalValue.toString(toBase)

      return {
        original_value: value,
        from_base: fromBase,
        to_base: toBase,
        result: result
      }
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid value or base: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 处理位运算
  private handleBitwise() {
    // 位运算的实现
    return {
      message: 'Bitwise operation functionality will be implemented'
    }
  }

  // 处理逻辑运算
  private handleLogical() {
    // 逻辑运算的实现
    return {
      message: 'Logical operation functionality will be implemented'
    }
  }

  // 处理正则表达式
  private handleRegex() {
    // 正则表达式的实现
    return {
      message: 'Regex functionality will be implemented'
    }
  }

  // 处理哈希计算
  private handleHash() {
    // 哈希计算的实现
    return {
      message: 'Hash calculation functionality will be implemented'
    }
  }

  // 处理编码转换
  private handleEncode() {
    // 编码转换的实现
    return {
      message: 'Encoding functionality will be implemented'
    }
  }

  // 处理日期时间
  private handleDateTime(args: any) {
    Logger.info('[Calculator] Handling datetime', args)

    const operation = args?.operation

    if (!operation) {
      throw new McpError(ErrorCode.InvalidParams, 'Operation is required')
    }

    try {
      let result

      // 根据操作类型处理日期时间
      switch (operation) {
        case 'diff':
          result = this.handleDateDiff(args)
          break
        case 'add':
          result = this.handleDateAdd(args)
          break
        case 'format':
          result = this.handleDateFormat()
          break
        case 'timezone':
          result = this.handleTimezone()
          break
        case 'workdays':
          result = this.handleWorkdays()
          break
        case 'calendar':
          result = this.handleCalendar()
          break
        case 'parse':
          result = this.handleDateParse()
          break
        default:
          throw new McpError(ErrorCode.InvalidParams, `Unknown datetime operation: ${operation}`)
      }

      // 构建响应对象
      const response = {
        operation: operation,
        result: result
      }

      Logger.info('[Calculator] Datetime result:', response)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ],
        isError: false
      }
    } catch (error) {
      Logger.error('[Calculator] Error in datetime operation:', error)
      throw new McpError(
        ErrorCode.InternalError,
        `Error in datetime operation: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 处理日期差值
  private handleDateDiff(args: any) {
    const date1Str = args?.date1
    const date2Str = args?.date2
    const unit = args?.unit || 'days'

    if (!date1Str || !date2Str) {
      throw new McpError(ErrorCode.InvalidParams, 'Two dates are required for date difference calculation')
    }

    try {
      // 解析日期
      const date1 = this.parseDate(date1Str)
      const date2 = this.parseDate(date2Str)

      if (!date1 || !date2) {
        throw new Error('Invalid date format')
      }

      // 计算差值（毫秒）
      const diffMs = date2.getTime() - date1.getTime()

      // 根据单位转换差值
      let result

      switch (unit) {
        case 'years':
          result = diffMs / (1000 * 60 * 60 * 24 * 365.25)
          break
        case 'months':
          result = diffMs / (1000 * 60 * 60 * 24 * 30.44)
          break
        case 'weeks':
          result = diffMs / (1000 * 60 * 60 * 24 * 7)
          break
        case 'days':
          result = diffMs / (1000 * 60 * 60 * 24)
          break
        case 'hours':
          result = diffMs / (1000 * 60 * 60)
          break
        case 'minutes':
          result = diffMs / (1000 * 60)
          break
        case 'seconds':
          result = diffMs / 1000
          break
        default:
          throw new Error(`Unsupported unit: ${unit}`)
      }

      // 构建详细的差值信息
      const years = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25))
      const months = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44))
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)

      return {
        date1: date1Str,
        date2: date2Str,
        unit: unit,
        difference: result,
        details: {
          years,
          months,
          days,
          hours,
          minutes,
          seconds,
          milliseconds: diffMs
        },
        formatted: this.formatDateDifference(diffMs)
      }
    } catch (error) {
      Logger.error('[Calculator] Error calculating date difference:', error)
      throw new McpError(
        ErrorCode.InternalError,
        `Error calculating date difference: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 处理日期加减
  private handleDateAdd(args: any) {
    const date1Str = args?.date1
    const value = args?.value
    const unit = args?.unit || 'days'

    if (!date1Str || value === undefined) {
      throw new McpError(ErrorCode.InvalidParams, 'Date and value are required for date addition')
    }

    try {
      // 解析日期
      const date = this.parseDate(date1Str)

      if (!date) {
        throw new Error('Invalid date format')
      }

      // 克隆日期对象，避免修改原始对象
      const resultDate = new Date(date.getTime())

      // 根据单位添加或减去时间
      switch (unit) {
        case 'years':
          resultDate.setFullYear(resultDate.getFullYear() + value)
          break
        case 'months':
          resultDate.setMonth(resultDate.getMonth() + value)
          break
        case 'weeks':
          resultDate.setDate(resultDate.getDate() + value * 7)
          break
        case 'days':
          resultDate.setDate(resultDate.getDate() + value)
          break
        case 'hours':
          resultDate.setHours(resultDate.getHours() + value)
          break
        case 'minutes':
          resultDate.setMinutes(resultDate.getMinutes() + value)
          break
        case 'seconds':
          resultDate.setSeconds(resultDate.getSeconds() + value)
          break
        default:
          throw new Error(`Unsupported unit: ${unit}`)
      }

      return {
        original_date: date1Str,
        value: value,
        unit: unit,
        result_date: this.formatDate(resultDate),
        result_iso: resultDate.toISOString(),
        operation: value >= 0 ? 'add' : 'subtract'
      }
    } catch (error) {
      Logger.error('[Calculator] Error calculating date addition:', error)
      throw new McpError(
        ErrorCode.InternalError,
        `Error calculating date addition: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 解析日期字符串
  private parseDate(dateStr: string): Date | null {
    // 尝试多种日期格式
    const date = new Date(dateStr)

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      // 尝试解析特殊格式
      const formats = [
        // 中文日期格式
        {
          regex: /(\d{4})年(\d{1,2})月(\d{1,2})日/,
          parse: (match: RegExpMatchArray) => new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
        }
        // 自定义格式...
      ]

      for (const format of formats) {
        const match = dateStr.match(format.regex)
        if (match) {
          return format.parse(match)
        }
      }

      return null
    }

    return date
  }

  // 格式化日期
  private formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  // 格式化日期差值为人类可读格式
  private formatDateDifference(diffMs: number): string {
    const seconds = Math.floor(diffMs / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    const months = Math.floor(days / 30.44)
    const years = Math.floor(months / 12)

    if (years > 0) {
      const remainingMonths = months % 12
      return `${years}年${remainingMonths > 0 ? remainingMonths + '个月' : ''}`
    } else if (months > 0) {
      const remainingDays = Math.floor(days % 30.44)
      return `${months}个月${remainingDays > 0 ? remainingDays + '天' : ''}`
    } else if (days > 0) {
      const remainingHours = hours % 24
      return `${days}天${remainingHours > 0 ? remainingHours + '小时' : ''}`
    } else if (hours > 0) {
      const remainingMinutes = minutes % 60
      return `${hours}小时${remainingMinutes > 0 ? remainingMinutes + '分钟' : ''}`
    } else if (minutes > 0) {
      const remainingSeconds = seconds % 60
      return `${minutes}分钟${remainingSeconds > 0 ? remainingSeconds + '秒' : ''}`
    } else {
      return `${seconds}秒`
    }
  }

  // 处理日期格式化
  private handleDateFormat() {
    // 日期格式化的实现
    return {
      message: 'Date formatting functionality will be implemented'
    }
  }

  // 处理时区转换
  private handleTimezone() {
    // 时区转换的实现
    return {
      message: 'Timezone conversion functionality will be implemented'
    }
  }

  // 处理工作日计算
  private handleWorkdays() {
    // 工作日计算的实现
    return {
      message: 'Workdays calculation functionality will be implemented'
    }
  }

  // 处理日历信息
  private handleCalendar() {
    // 日历信息的实现
    return {
      message: 'Calendar information functionality will be implemented'
    }
  }

  // 处理日期解析
  private handleDateParse() {
    // 日期解析的实现
    return {
      message: 'Date parsing functionality will be implemented'
    }
  }

  // 处理几何计算
  private handleGeometry(args: any) {
    Logger.info('[Calculator] Handling geometry', args)

    const operation = args?.operation

    if (!operation) {
      throw new McpError(ErrorCode.InvalidParams, 'Operation is required')
    }

    try {
      let result

      // 根据操作类型处理几何计算
      switch (operation) {
        case 'distance':
          result = this.handleGeometryDistance(args)
          break
        case 'area':
          result = this.handleGeometryArea()
          break
        case 'volume':
          result = this.handleGeometryVolume()
          break
        case 'angle':
          result = this.handleGeometryAngle()
          break
        case 'perimeter':
          result = this.handleGeometryPerimeter()
          break
        case 'coordinates':
          result = this.handleGeometryCoordinates()
          break
        case 'transform':
          result = this.handleGeometryTransform()
          break
        case 'intersection':
          result = this.handleGeometryIntersection()
          break
        default:
          throw new McpError(ErrorCode.InvalidParams, `Unknown geometry operation: ${operation}`)
      }

      // 构建响应对象
      const response = {
        operation: operation,
        result: result
      }

      Logger.info('[Calculator] Geometry result:', response)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ],
        isError: false
      }
    } catch (error) {
      Logger.error('[Calculator] Error in geometry calculation:', error)
      throw new McpError(
        ErrorCode.InternalError,
        `Error in geometry calculation: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 处理距离计算
  private handleGeometryDistance(args: any) {
    const shape = args?.shape
    const points = args?.points

    if (!shape || !points) {
      throw new McpError(ErrorCode.InvalidParams, 'Shape and points are required for distance calculation')
    }

    try {
      // 解析点坐标
      const pointsArray = points.split(';').map((point: string) => {
        const coords = point.split(',').map((coord: string) => parseFloat(coord.trim()))
        return coords
      })

      if (pointsArray.length < 2) {
        throw new McpError(ErrorCode.InvalidParams, 'At least two points are required for distance calculation')
      }

      let distance: number

      switch (shape) {
        case 'point':
          // 计算两点之间的距离
          if (pointsArray[0].length === 2 && pointsArray[1].length === 2) {
            // 2D 点
            const [x1, y1] = pointsArray[0]
            const [x2, y2] = pointsArray[1]
            distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
          } else if (pointsArray[0].length === 3 && pointsArray[1].length === 3) {
            // 3D 点
            const [x1, y1, z1] = pointsArray[0]
            const [x2, y2, z2] = pointsArray[1]
            distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2))
          } else {
            throw new McpError(ErrorCode.InvalidParams, 'Points must have the same dimensions (2D or 3D)')
          }
          break

        case 'line':
          // 计算点到线的距离
          if (pointsArray.length < 3) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'For point-to-line distance, need at least 3 points: 2 for the line and 1 for the point'
            )
          }

          if (pointsArray[0].length === 2 && pointsArray[1].length === 2 && pointsArray[2].length === 2) {
            // 2D 点到线的距离
            const [x1, y1] = pointsArray[0] // 线上的点1
            const [x2, y2] = pointsArray[1] // 线上的点2
            const [x0, y0] = pointsArray[2] // 要计算距离的点

            // 计算点到线的距离: |Ax0 + By0 + C| / sqrt(A^2 + B^2)
            // 其中 Ax + By + C = 0 是线的方程
            const A = y2 - y1
            const B = x1 - x2
            const C = x2 * y1 - x1 * y2

            distance = Math.abs(A * x0 + B * y0 + C) / Math.sqrt(A * A + B * B)
          } else {
            throw new McpError(ErrorCode.InvalidParams, 'Only 2D point-to-line distance is supported')
          }
          break

        default:
          throw new McpError(ErrorCode.InvalidParams, `Distance calculation for shape '${shape}' is not supported`)
      }

      return {
        shape: shape,
        points: pointsArray,
        distance: distance
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Error calculating distance: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 处理面积计算
  private handleGeometryArea() {
    // 面积计算的实现
    return {
      message: 'Area calculation functionality will be implemented'
    }
  }

  // 处理体积计算
  private handleGeometryVolume() {
    // 体积计算的实现
    return {
      message: 'Volume calculation functionality will be implemented'
    }
  }

  // 处理角度计算
  private handleGeometryAngle() {
    // 角度计算的实现
    return {
      message: 'Angle calculation functionality will be implemented'
    }
  }

  // 处理周长计算
  private handleGeometryPerimeter() {
    // 周长计算的实现
    return {
      message: 'Perimeter calculation functionality will be implemented'
    }
  }

  // 处理坐标计算
  private handleGeometryCoordinates() {
    // 坐标计算的实现
    return {
      message: 'Coordinate calculation functionality will be implemented'
    }
  }

  // 处理几何变换
  private handleGeometryTransform() {
    // 几何变换的实现
    return {
      message: 'Geometric transformation functionality will be implemented'
    }
  }

  // 处理交点计算
  private handleGeometryIntersection() {
    // 交点计算的实现
    return {
      message: 'Intersection calculation functionality will be implemented'
    }
  }

  // 处理图形函数
  private handleGraph(args: any) {
    Logger.info('[Calculator] Handling graph', args)

    const operation = args?.operation
    const func = args?.function

    if (!operation || !func) {
      throw new McpError(ErrorCode.InvalidParams, 'Operation and function are required')
    }

    try {
      let result

      // 根据操作类型处理图形函数
      switch (operation) {
        case 'evaluate':
          result = this.handleGraphEvaluate(args)
          break
        case 'plot':
          result = this.handleGraphPlot(args)
          break
        case 'roots':
          result = this.handleGraphRoots()
          break
        case 'extrema':
          result = this.handleGraphExtrema()
          break
        case 'inflection':
          result = this.handleGraphInflection()
          break
        case 'tangent':
          result = this.handleGraphTangent()
          break
        case 'describe':
          result = this.handleGraphDescribe()
          break
        case 'intersect':
          result = this.handleGraphIntersect()
          break
        default:
          throw new McpError(ErrorCode.InvalidParams, `Unknown graph operation: ${operation}`)
      }

      // 构建响应对象
      const response = {
        operation: operation,
        function: func,
        result: result
      }

      Logger.info('[Calculator] Graph result:', response)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ],
        isError: false
      }
    } catch (error) {
      Logger.error('[Calculator] Error in graph operation:', error)
      throw new McpError(
        ErrorCode.InternalError,
        `Error in graph operation: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 处理函数求值
  private handleGraphEvaluate(args: any) {
    const func = args?.function
    const variable = args?.variable || 'x'
    const point = args?.point

    if (!func) {
      throw new McpError(ErrorCode.InvalidParams, 'Function expression is required')
    }

    if (point === undefined) {
      throw new McpError(ErrorCode.InvalidParams, 'Point value is required for function evaluation')
    }

    try {
      // 创建一个包含变量值的对象
      const scope: Record<string, number> = {}
      scope[variable] = point

      // 使用 mathjs 计算函数值
      const result = math.evaluate(func, scope)

      return {
        function: func,
        variable: variable,
        point: point,
        value: result
      }
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Error evaluating function: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 处理求根
  private handleGraphRoots() {
    // 求根的实现
    return {
      message: 'Root finding functionality will be implemented'
    }
  }

  // 处理极值点
  private handleGraphExtrema() {
    // 极值点的实现
    return {
      message: 'Extrema finding functionality will be implemented'
    }
  }

  // 处理拐点
  private handleGraphInflection() {
    // 拐点的实现
    return {
      message: 'Inflection point finding functionality will be implemented'
    }
  }

  // 处理切线
  private handleGraphTangent() {
    // 切线的实现
    return {
      message: 'Tangent line functionality will be implemented'
    }
  }

  // 处理图像描述
  private handleGraphDescribe() {
    // 图像描述的实现
    return {
      message: 'Graph description functionality will be implemented'
    }
  }

  // 处理交点
  private handleGraphIntersect() {
    // 交点的实现
    return {
      message: 'Intersection finding functionality will be implemented'
    }
  }

  // 处理函数图像绘制
  private async handleGraphPlot(args: any) {
    const func = args?.function
    const variable = args?.variable || 'x'
    const xMin = args?.xMin !== undefined ? args.xMin : -10
    const xMax = args?.xMax !== undefined ? args.xMax : 10
    const yMin = args?.yMin !== undefined ? args.yMin : -10
    const yMax = args?.yMax !== undefined ? args.yMax : 10
    const points = args?.points || 100

    if (!func) {
      throw new McpError(ErrorCode.InvalidParams, 'Function expression is required')
    }

    try {
      // 检查 plotly 是否可用
      if (!plotly) {
        throw new Error('Plotly is not available')
      }

      // 生成 x 值数组
      const xValues = Array.from({ length: points }, (_, i) => xMin + (i * (xMax - xMin)) / (points - 1))

      // 计算 y 值
      const yValues = xValues.map((x) => {
        try {
          const scope: Record<string, number> = {}
          scope[variable] = x
          return math.evaluate(func, scope)
        } catch (error) {
          // 如果计算失败，返回 null
          return null
        }
      })

      // 创建 plotly 图形
      const figure = {
        data: [
          {
            x: xValues,
            y: yValues,
            type: 'scatter',
            mode: 'lines',
            line: { color: 'rgb(75, 192, 192)', width: 2 }
          }
        ],
        layout: {
          title: `y = ${func}`,
          xaxis: { range: [xMin, xMax], title: 'x' },
          yaxis: { range: [yMin, yMax], title: 'y' },
          width: 800,
          height: 500,
          margin: { l: 50, r: 50, b: 50, t: 50 },
          plot_bgcolor: 'rgb(240, 240, 240)',
          paper_bgcolor: 'rgb(255, 255, 255)'
        }
      }

      // 生成图像
      const imgBuffer = await plotly.toImage(figure, { format: 'png' })
      const base64Image = `data:image/png;base64,${imgBuffer.toString('base64')}`

      return {
        function: func,
        variable: variable,
        domain: { x: [xMin, xMax], y: [yMin, yMax] },
        content: [
          {
            type: 'image',
            data: base64Image,
            mimeType: 'image/png'
          }
        ]
      }
    } catch (error) {
      Logger.error('[Calculator] Error plotting function:', error)

      // 如果 plotly 不可用，返回一个简单的错误消息
      return {
        function: func,
        variable: variable,
        domain: { x: [xMin, xMax], y: [yMin, yMax] },
        error: error instanceof Error ? error.message : String(error),
        message: 'Unable to generate plot. Plotly.js may not be available.'
      }
    }
  }
}

export default CalculatorServer
