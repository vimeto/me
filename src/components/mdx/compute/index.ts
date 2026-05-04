import type { ComputeFn } from './types'
import { gptqFlippingRange } from './gptq'
import { servingLatencyTail } from './latency'
import {
  quantMemoryMath,
  quantRtnError,
  quantGptqFeedback,
  quantSmoothquantRescale,
  quantAwqSalience,
} from './quant'
import {
  mixedPrecLayerSensitivity,
  mixedPrecBitAllocation,
  mixedPrecPplFrontier,
  mixedPrecHwLatency,
} from './mixedPrec'
import { tttLoraCapture, tttTrajectory, tttAdaptCurve, tttBudget } from './ttt'
import {
  archRmsVsLayerNorm,
  archSwiglu,
  archRopeSimilarity,
  archBlockQualityPerFlop,
  archPreVsPostNorm,
  archGluVariants,
  archTokenizerCompression,
  archEmbeddingShare,
  archBlockEdge,
} from './arch'
import { attnCacheCompare, attnThroughputCompare, attnRecallVsThroughput } from './attn'
import { ssmEdgeMemoryFootprint, ssmHybridRatioSweep, ssmStreamingDecodeLatency } from './ssm'
import {
  quantHwBandwidthGap,
  quantParetoQuality,
  quantEntropyView,
  quantCompressionRatios,
} from './quantHw'
import { embedSizeVsLoss, embedZipfPrecision } from './embed'
import {
  memcompCompositionError,
  memcompLayerInjectionSensitivity,
  memcompMultiInjectionCompounding,
} from './memcomp'
import { ssdSemiSeparable, ssdDualityCheck, ssdThroughputRoofline, ssdSelectiveGating } from './ssd'
import {
  kimiKvCacheVsContext,
  kimiDecodeRoofline,
  kimiKdaRecurrence,
  kimiHybridRatio,
} from './kimi'
import {
  posencAttnVsOffset,
  posencExtrapolationGap,
  posencLayerHybrid,
  posencBaseScaling,
} from './posenc'
import {
  sinksNormalizationShape,
  sinksSinkMass,
  sinksStreamingStability,
  sinksSinkEmergence,
} from './sinks'

export const computeRegistry: Record<string, ComputeFn> = {
  'gptq.flippingRange': gptqFlippingRange,
  'serving.latencyTail': servingLatencyTail,
  'quant.memoryMath': quantMemoryMath,
  'quant.rtnError': quantRtnError,
  'quant.gptqFeedback': quantGptqFeedback,
  'quant.smoothquantRescale': quantSmoothquantRescale,
  'quant.awqSalience': quantAwqSalience,
  'mixedPrec.layerSensitivity': mixedPrecLayerSensitivity,
  'mixedPrec.bitAllocation': mixedPrecBitAllocation,
  'mixedPrec.pplFrontier': mixedPrecPplFrontier,
  'mixedPrec.hwLatency': mixedPrecHwLatency,
  'ttt.loraCapture': tttLoraCapture,
  'ttt.trajectory': tttTrajectory,
  'ttt.adaptCurve': tttAdaptCurve,
  'ttt.budget': tttBudget,
  'arch.rmsVsLayerNorm': archRmsVsLayerNorm,
  'arch.swiglu': archSwiglu,
  'arch.ropeSimilarity': archRopeSimilarity,
  'arch.blockQualityPerFlop': archBlockQualityPerFlop,
  'ssd.semiSeparable': ssdSemiSeparable,
  'ssd.dualityCheck': ssdDualityCheck,
  'ssd.throughputRoofline': ssdThroughputRoofline,
  'ssd.selectiveGating': ssdSelectiveGating,
  'kimi.kvCacheVsContext': kimiKvCacheVsContext,
  'kimi.decodeRoofline': kimiDecodeRoofline,
  'kimi.kdaRecurrence': kimiKdaRecurrence,
  'kimi.hybridRatio': kimiHybridRatio,
  'posenc.attnVsOffset': posencAttnVsOffset,
  'posenc.extrapolationGap': posencExtrapolationGap,
  'posenc.layerHybrid': posencLayerHybrid,
  'posenc.baseScaling': posencBaseScaling,
  'sinks.normalizationShape': sinksNormalizationShape,
  'sinks.sinkMass': sinksSinkMass,
  'sinks.streamingStability': sinksStreamingStability,
  'sinks.sinkEmergence': sinksSinkEmergence,
  'arch.preVsPostNorm': archPreVsPostNorm,
  'arch.gluVariants': archGluVariants,
  'arch.tokenizerCompression': archTokenizerCompression,
  'arch.embeddingShare': archEmbeddingShare,
  'arch.blockEdge': archBlockEdge,
  'attn.cacheCompare': attnCacheCompare,
  'attn.throughputCompare': attnThroughputCompare,
  'attn.recallVsThroughput': attnRecallVsThroughput,
  'ssm.edgeMemoryFootprint': ssmEdgeMemoryFootprint,
  'ssm.hybridRatioSweep': ssmHybridRatioSweep,
  'ssm.streamingDecodeLatency': ssmStreamingDecodeLatency,
  'quantHw.bandwidthGap': quantHwBandwidthGap,
  'quantHw.paretoQuality': quantParetoQuality,
  'quantHw.entropyView': quantEntropyView,
  'quantHw.compressionRatios': quantCompressionRatios,
  'embed.sizeVsLoss': embedSizeVsLoss,
  'embed.zipfPrecision': embedZipfPrecision,
  'memcomp.compositionError': memcompCompositionError,
  'memcomp.layerInjectionSensitivity': memcompLayerInjectionSensitivity,
  'memcomp.multiInjectionCompounding': memcompMultiInjectionCompounding,
}

export function getCompute(key: string): ComputeFn | undefined {
  return computeRegistry[key]
}

export type { ComputeFn, ComputeParams, ComputeResult, Point } from './types'
