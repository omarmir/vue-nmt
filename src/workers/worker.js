const appBaseURL = new URL(import.meta.env.BASE_URL, self.location.origin)
const transformersURL = new URL('transformers/transformers.min.js?raw', appBaseURL).href
const { pipeline, env } = await import(transformersURL)

env.localModelPath = new URL('models/', appBaseURL).href
env.allowRemoteModels = false
env.allowLocalModels = true
env.useBrowserCache = false
env.useFSCache = false

if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = new URL('transformers/', appBaseURL).href
  env.backends.onnx.wasm.proxy = false
  env.backends.onnx.wasm.numThreads = 1
}

let translator = null
let activeTranslationModel = null
const glossaryAnchorCache = new Map()

async function loadTranslationModel(model, announceReady = true) {
  if (translator && activeTranslationModel === model) {
    if (announceReady) self.postMessage({ status: 'ready', model })
    return
  }

  await disposeTranslationModel()
  activeTranslationModel = model
  translator = await pipeline('translation', model, {
    dtype: 'q8',
    progress_callback: (progress) => {
      self.postMessage({ status: 'downloading', model, result: progress })
    },
  })
  if (announceReady) self.postMessage({ status: 'ready', model })
}

async function disposeTranslationModel() {
  await translator?.dispose?.()
  translator = null
  activeTranslationModel = null
}

async function translateItem(item, model, generation) {
  if (!translator || activeTranslationModel !== model) {
    await loadTranslationModel(model, false)
  }

  const originalInput = typeof item.text === 'string' ? item.text.trim() : ''
  const sourceText = item.text || ''
  const input = typeof sourceText === 'string' ? sourceText.trim() : ''
  if (!input) return item.text || ''

  if (originalInput && item.glossary?.replacements?.length) {
    const constrained = await translateWithGlossaryConstraints(
      originalInput,
      item.glossary.replacements,
      generation,
    )
    if (constrained) return constrained
  }

  return translatePlain(input, generation)
}

async function translatePlain(input, generation) {
  const output = await translator(input, {
    max_length: generation.max_length || 512,
    num_beams: generation.num_beams || 4,
    early_stopping: generation.early_stopping !== false,
  })
  return output?.[0]?.translation_text || ''
}

async function translateWithGlossaryConstraints(input, replacements, generation) {
  const baselineText = await translatePlain(input, generation)
  const constraints = await glossaryConstraints(replacements)
  const startedAt = now()

  if (!constraints.length) return cleanupGlossaryOutput(baselineText)
  if (containsAllGlossaryTargets(baselineText, constraints)) {
    logGlossaryConstraintResult({
      strategy: 'baseline',
      input,
      constraints,
      startedAt,
      candidates: [{ strategy: 'baseline', text: baselineText }],
    })
    return cleanupGlossaryOutput(baselineText)
  }

  const candidates = [{ strategy: 'baseline', text: baselineText }]
  const anchorStartedAt = now()
  const anchorText = await createAnchorReplacementCandidate(baselineText, constraints, generation)
  if (anchorText && anchorText !== baselineText) {
    candidates.push({
      strategy: 'anchor-replace',
      text: anchorText,
      elapsedMs: Math.round(now() - anchorStartedAt),
    })
  }

  const beamWidth = Math.max(4, Math.min(8, Number(generation.num_beams) || 4))
  const maxLength = constrainedGlossaryMaxLength(input, constraints, generation)
  const beamStrategies = [
    ['beam-soft-bias-6', createBeamAwareGlossaryProcessor(constraints, { bias: 6 }), beamWidth],
    ['beam-soft-bias-9', createBeamAwareGlossaryProcessor(constraints, { bias: 9 }), beamWidth],
  ]

  for (const [strategy, processor, numBeams] of beamStrategies) {
    const candidateStartedAt = now()
    try {
      const output = await translator(input, {
        max_length: maxLength,
        num_beams: numBeams,
        early_stopping: generation.early_stopping !== false,
        logits_processor: [processor],
      })
      candidates.push({
        strategy,
        text: output?.[0]?.translation_text || '',
        elapsedMs: Math.round(now() - candidateStartedAt),
      })
    } catch (error) {
      console.warn(`Glossary strategy ${strategy} failed`, error)
    }
  }

  const beamSelected = selectGlossaryCandidate(baselineText, candidates, constraints, {
    allowPartial: true,
  })
  if (beamSelected) {
    logGlossaryConstraintResult({ strategy: beamSelected.strategy, input, constraints, startedAt, candidates })
    return cleanupGlossaryOutput(beamSelected.text)
  }

  const fallbackStrategies = [
    ['append-eos', createAppendBeforeEosProcessor(constraints), 1],
    ['hard-force', createHardGlossaryConstraintProcessor(constraints), 1],
  ]

  for (const [strategy, processor, numBeams] of fallbackStrategies) {
    const candidateStartedAt = now()
    try {
      const output = await translator(input, {
        max_length: maxLength,
        num_beams: numBeams,
        early_stopping: generation.early_stopping !== false,
        logits_processor: [processor],
      })
      candidates.push({
        strategy,
        text: output?.[0]?.translation_text || '',
        elapsedMs: Math.round(now() - candidateStartedAt),
      })
    } catch (error) {
      console.warn(`Glossary strategy ${strategy} failed`, error)
    }
  }

  const selected = selectGlossaryCandidate(baselineText, candidates, constraints, { allowPartial: false })
  if (selected) {
    logGlossaryConstraintResult({ strategy: selected.strategy, input, constraints, startedAt, candidates })
    return cleanupGlossaryOutput(selected.text)
  }

  console.warn('Glossary-constrained generation did not satisfy all glossary terms; using baseline translation.')
  logGlossaryConstraintResult({ strategy: 'baseline-fallback', input, constraints, startedAt, candidates })
  return cleanupGlossaryOutput(baselineText)
}

function constrainedGlossaryMaxLength(input, constraints, generation) {
  const configured = Number(generation.max_length) || 512
  const targetTokens = constraints.reduce((sum, constraint) => sum + constraint.tokenIds.length, 0)
  const estimate = Math.ceil(String(input || '').length / 3) + targetTokens + 28
  return Math.max(48, Math.min(configured, 160, estimate))
}

async function createAnchorReplacementCandidate(baselineText, constraints, generation) {
  let candidate = String(baselineText || '')
  for (const constraint of constraints) {
    if (!constraint.source || containsGlossaryTarget(candidate, constraint)) continue
    const anchors = await glossaryTranslationAnchors(constraint, generation)
    candidate = replaceFirstGlossaryAnchor(candidate, anchors, constraint.target)
  }
  return candidate
}

async function glossaryTranslationAnchors(constraint, generation) {
  const source = String(constraint.source || '').trim()
  if (!source) return []
  const cacheKey = `${activeTranslationModel}:q8:${source}`
  if (glossaryAnchorCache.has(cacheKey)) return glossaryAnchorCache.get(cacheKey)

  const variants = [source, `the ${source}`]
  const anchors = new Set()
  for (const variant of variants) {
    const output = await translator(variant, {
      max_length: Math.min(Number(generation.max_length) || 512, 64),
      num_beams: generation.num_beams || 4,
      early_stopping: generation.early_stopping !== false,
    })
    for (const anchor of anchorVariants(output?.[0]?.translation_text || '')) {
      if (normalizeGlossaryText(anchor).length >= 4) anchors.add(anchor)
    }
  }

  const result = Array.from(anchors).sort((a, b) => b.length - a.length)
  glossaryAnchorCache.set(cacheKey, result)
  return result
}

function anchorVariants(text) {
  const cleaned = String(text || '').trim().replace(/[.!?]+$/g, '').trim()
  if (!cleaned) return []
  const variants = new Set([cleaned])
  const withoutArticle = cleaned
    .replace(/^(l['’]\s*|le\s+|la\s+|les\s+|un\s+|une\s+|des\s+|du\s+|de la\s+|the\s+|a\s+|an\s+)/i, '')
    .trim()
  if (withoutArticle && withoutArticle !== cleaned) variants.add(withoutArticle)
  return Array.from(variants)
}

function replaceFirstGlossaryAnchor(text, anchors, target) {
  let best = null
  for (const anchor of anchors) {
    const match = findNormalizedMatch(text, anchor)
    if (!match) continue
    if (!best || match.end - match.start > best.end - best.start) best = match
  }
  if (!best) return text
  return `${text.slice(0, best.start)}${adaptGlossaryTargetForContext(text.slice(0, best.start), target)}${text.slice(best.end)}`
}

function findNormalizedMatch(text, needle) {
  const haystack = normalizedMatchMap(text)
  const normalizedNeedle = normalizeGlossaryText(needle).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  if (!normalizedNeedle) return null
  const index = haystack.normalized.indexOf(normalizedNeedle)
  if (index === -1) return null
  return {
    start: haystack.map[index],
    end: haystack.map[index + normalizedNeedle.length - 1] + 1,
  }
}

function normalizedMatchMap(text) {
  let normalized = ''
  const map = []
  let previousWasSpace = true
  for (let index = 0; index < text.length; index++) {
    const expanded = text[index].toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    for (const char of expanded) {
      if (/[\p{L}\p{N}]/u.test(char)) {
        normalized += char
        map.push(index)
        previousWasSpace = false
      } else if (!previousWasSpace) {
        normalized += ' '
        map.push(index)
        previousWasSpace = true
      }
    }
  }
  if (normalized.endsWith(' ')) {
    normalized = normalized.slice(0, -1)
    map.pop()
  }
  return { normalized, map }
}

function adaptGlossaryTargetForContext(before, target) {
  const cleanedTarget = String(target || '').trim()
  if (/[lL]['’]\s*$/.test(before) && /^[aeiouhàâäéèêëîïôöùûü]/i.test(target)) {
    return cleanedTarget.replace(/^\s+/, '')
  }
  if (isSentenceInitialContext(before)) return capitalizeFirstLetter(cleanedTarget)
  return cleanedTarget
}

function isSentenceInitialContext(before) {
  return /(?:^|[.!?]\s+|[\r\n]+)\s*$/.test(String(before || ''))
}

function capitalizeFirstLetter(text) {
  return String(text || '').replace(/^(\P{L}*)(\p{L})/u, (_, prefix, letter) => `${prefix}${letter.toLocaleUpperCase()}`)
}

function cleanupGlossaryOutput(text) {
  return capitalizeFirstLetter(
    String(text || '')
      .replace(/\b([Ll])['’]\s+/g, "$1'")
      .replace(/\b([Dd])\s+(audit|acces|approvisionnement)\b/g, "$1'$2")
      .replace(/\bd\s+approbation\b/g, "d'approbation")
      .replace(/\bcontrole d['’]?access\b/gi, "contrôle d'accès")
      .replace(/\bcontrole d['’]?acces\b/gi, "contrôle d'accès")
      .replace(/\bsysteme de gestion\b/gi, 'système de gestion')
      .replace(/\breprise apres sinistre\b/gi, 'reprise après sinistre')
      .replace(/\bfacteurs relatifs a la vie privee\b/gi, 'facteurs relatifs à la vie privée')
      .replace(/\bconge annuel\b/gi, 'congé annuel')
      .replace(/\bconge de maladie\b/gi, 'congé de maladie')
      .replace(/\b[Ll]e ancien\b/g, (match) => (match[0] === 'L' ? "L'ancien" : "l'ancien"))
      .replace(/\b[Ll]a journal\b/g, (match) => (match[0] === 'L' ? 'Le journal' : 'le journal'))
      .replace(/\b[Uu]ne journal\b/g, (match) => (match[0] === 'U' ? 'Un journal' : 'un journal'))
      .replace(/\bpiste journal d(['’]|\s+)audit\b/gi, "journal d'audit")
      .replace(/\bdes conge annuel\b/gi, 'des congés annuels')
      .replace(/\baux conge annuel\b/gi, 'aux congés annuels')
      .replace(/\bles conge annuel\b/gi, 'les congés annuels')
      .replace(/\bdes conge de maladie\b/gi, 'des congés de maladie')
      .replace(/\baux conge de maladie\b/gi, 'aux congés de maladie')
      .replace(/\bdes compte utilisateur\b/g, 'des comptes utilisateur')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim(),
  )
}

async function glossaryConstraints(replacements) {
  const constraints = []
  const seen = new Set()
  for (const replacement of replacements || []) {
    const target = String(replacement?.target || '').trim()
    const key = target.toLocaleLowerCase()
    if (!target || seen.has(key)) continue
    const source = String(replacement?.source || '').trim()
    if (!isSafeGlossaryConstraint(source, target)) continue
    const tokenIds = await tokenizeGlossaryTarget(target)
    if (!tokenIds.length) continue
    seen.add(key)
    constraints.push({ source, target, tokenIds })
  }
  return constraints
}

function isSafeGlossaryConstraint(source, target) {
  const sourceWords = normalizeGlossaryText(source).split(/\s+/).filter(Boolean)
  const targetWords = normalizeGlossaryText(target).split(/\s+/).filter(Boolean)
  if (sourceWords.length >= 2 || targetWords.length >= 2) return true
  if (/[A-Z0-9_]{3,}/.test(target)) return true
  return /[A-Z]{2,}|[A-Z][a-z]+(?:[A-Z][a-z]+)+/.test(source)
}

async function tokenizeGlossaryTarget(target) {
  const encoded = await translator.tokenizer(target, { add_special_tokens: false })
  const ids = encoded?.input_ids?.tolist?.() || []
  return ids.flat().map(Number).filter((id) => Number.isInteger(id))
}

function createHardGlossaryConstraintProcessor(constraints) {
  return (inputIds, logits) => {
    forEachLogitRow(inputIds, logits, ({ generated, row }) => {
      const active = activeGlossaryConstraint(generated, constraints)
      if (active) forceLogitRow(logits, row, active.nextTokenId)
    })
    return logits
  }
}

function createBeamAwareGlossaryProcessor(constraints, options = {}) {
  const bias = Number(options.bias) || 8
  const forceAfterTokens = Number(options.forceAfterTokens) || 0
  return (inputIds, logits) => {
    forEachLogitRow(inputIds, logits, ({ generated, row }) => {
      const content = generated.slice(1)
      const continuation = activeGlossaryContinuation(content, constraints)
      if (continuation) {
        forceLogitRow(logits, row, continuation.nextTokenId)
        return
      }

      const missing = missingGlossaryConstraints(content, constraints)
      if (!missing.length) return
      if (forceAfterTokens > 0 && content.length >= forceAfterTokens) {
        forceLogitRow(logits, row, missing[0].tokenIds[0])
        return
      }

      suppressEos(logits, row)
      for (const constraint of missing) {
        addLogitBias(logits, row, constraint.tokenIds[0], bias + constraintStartBonus(content, constraint, constraints))
      }
    })
    return logits
  }
}

function createAppendBeforeEosProcessor(constraints) {
  return (inputIds, logits) => {
    forEachLogitRow(inputIds, logits, ({ generated, row }) => {
      const content = generated.slice(1)
      const continuation = activeGlossaryContinuation(content, constraints)
      if (continuation) {
        forceLogitRow(logits, row, continuation.nextTokenId)
        return
      }

      const missing = missingGlossaryConstraints(content, constraints)
      if (!missing.length) return
      if (shouldAppendGlossaryTerm(content, logits, row)) forceLogitRow(logits, row, missing[0].tokenIds[0])
      else suppressEos(logits, row)
    })
    return logits
  }
}

function activeGlossaryConstraint(generated, constraints) {
  const content = generated.slice(1)
  const continuation = activeGlossaryContinuation(content, constraints)
  if (continuation) return continuation
  const missing = missingGlossaryConstraints(content, constraints)[0]
  if (!missing || content.length < 2) return null
  return { nextTokenId: missing.tokenIds[0] }
}

function activeGlossaryContinuation(content, constraints) {
  for (const constraint of constraints) {
    if (containsSubsequence(content, constraint.tokenIds)) continue
    const prefixLength = suffixPrefixLength(content, constraint.tokenIds)
    if (prefixLength > 0) return { nextTokenId: constraint.tokenIds[prefixLength] }
  }
  return null
}

function missingGlossaryConstraints(content, constraints) {
  return constraints.filter((constraint) => !containsSubsequence(content, constraint.tokenIds))
}

function constraintStartBonus(content, constraint, constraints) {
  const satisfiedBefore = constraints.filter((item) => containsSubsequence(content, item.tokenIds)).length
  const orderIndex = constraints.indexOf(constraint)
  return -(Math.max(0, orderIndex - satisfiedBefore) * 1.2)
}

function shouldAppendGlossaryTerm(content, logits, row = 0) {
  const eosTokenIds = generationEosTokenIds()
  const eosScore = maxTokenScore(logits, eosTokenIds, false, row)
  const bestNonEos = maxTokenScore(logits, eosTokenIds, true, row)
  return content.length > 14 || eosScore >= bestNonEos - 0.5
}

function suppressEos(logits, row = null) {
  for (const id of generationEosTokenIds()) setLogit(logits, row, id, -Infinity)
}

function generationEosTokenIds() {
  const id = translator?.model?.generation_config?.eos_token_id ?? translator?.model?.config?.eos_token_id ?? null
  if (Array.isArray(id)) return id.map(Number)
  return id === null || typeof id === 'undefined' ? [] : [Number(id)]
}

function maxTokenScore(logits, excludedIds = [], invertExclusion = false, row = 0) {
  const excluded = new Set(excludedIds)
  let score = -Infinity
  const { offset, size } = logitRowBounds(logits, row)
  for (let index = 0; index < size; index++) {
    const isExcluded = excluded.has(index)
    if ((invertExclusion && isExcluded) || (!invertExclusion && excludedIds.length && !isExcluded)) continue
    if (logits.data[offset + index] > score) score = logits.data[offset + index]
  }
  return score
}

function forEachLogitRow(inputIds, logits, callback) {
  const rowCount = logitRowCount(logits)
  for (let row = 0; row < rowCount; row++) {
    callback({ row, generated: generatedIdsForRow(inputIds, row) })
  }
}

function generatedIdsForRow(inputIds, row) {
  const ids = Array.isArray(inputIds?.[row])
    ? inputIds[row]
    : Array.isArray(inputIds?.[0])
      ? inputIds[0]
      : Array.isArray(inputIds)
        ? inputIds
        : []
  return ids.map(Number).filter((id) => Number.isInteger(id))
}

function logitRowCount(logits) {
  const vocabSize = logitVocabSize(logits)
  return Math.max(1, Math.floor(logits.data.length / vocabSize))
}

function logitVocabSize(logits) {
  return Number(logits?.dims?.at?.(-1)) || logits.data.length
}

function logitRowBounds(logits, row = 0) {
  const size = logitVocabSize(logits)
  const count = logitRowCount(logits)
  const safeRow = row === null ? 0 : Math.max(0, Math.min(count - 1, row))
  return { offset: safeRow * size, size }
}

function forceLogitRow(logits, row, tokenId) {
  const { offset, size } = logitRowBounds(logits, row)
  logits.data.fill(-Infinity, offset, offset + size)
  setLogit(logits, row, tokenId, 0)
}

function addLogitBias(logits, row, tokenId, bias) {
  const { offset, size } = logitRowBounds(logits, row)
  if (tokenId >= 0 && tokenId < size) logits.data[offset + tokenId] += bias
}

function setLogit(logits, row, tokenId, value) {
  if (row === null) {
    const count = logitRowCount(logits)
    for (let index = 0; index < count; index++) setLogit(logits, index, tokenId, value)
    return
  }
  const { offset, size } = logitRowBounds(logits, row)
  if (tokenId >= 0 && tokenId < size) logits.data[offset + tokenId] = value
}

function selectGlossaryCandidate(baselineText, candidates, constraints, options = {}) {
  let best = null
  for (const candidate of candidates) {
    candidate.text = cleanupGlossaryOutput(candidate.text)
    const quality = scoreGlossaryCandidate(baselineText, candidate.text, constraints)
    quality.score -= glossaryStrategyPenalty(candidate.strategy)
    candidate.satisfiesGlossary = quality.satisfiesGlossary
    candidate.accepted = quality.accepted
    candidate.glossaryCoverage = Number(quality.glossaryCoverage.toFixed(3))
    candidate.score = Number(quality.score.toFixed(3))
    candidate.reasons = quality.reasons
    if (!quality.accepted && !(options.allowPartial && quality.partialAccepted)) continue
    if (!best || quality.score > best.quality.score) best = { ...candidate, quality }
  }
  return best
}

function glossaryStrategyPenalty(strategy) {
  if (strategy === 'hard-force') return 0.85
  if (strategy === 'append-eos') return 0.4
  if (strategy === 'anchor-replace') return 0.15
  return 0
}

function scoreGlossaryCandidate(baselineText, candidateText, constraints) {
  const reasons = []
  const baseline = String(baselineText || '').trim()
  const candidate = String(candidateText || '').trim()
  const satisfiesGlossary = containsAllGlossaryTargets(candidate, constraints)
  const glossaryCoverage = glossaryTargetCoverage(candidate, constraints)
  if (!candidate) reasons.push('blank')
  if (hasDegenerateRepetition(candidate)) reasons.push('degenerate-repetition')

  const baselineLength = Math.max(1, baseline.length)
  const lengthRatio = candidate.length / baselineLength
  if (lengthRatio > 2.4) reasons.push('too-long')
  if (lengthRatio < 0.35) reasons.push('too-short')

  const anchorCoverage = baselineAnchorCoverage(baseline, candidate)
  if (anchorCoverage < 0.35) reasons.push('low-anchor-coverage')

  const accepted = !reasons.length && satisfiesGlossary
  const partialAccepted =
    !reasons.length && glossaryCoverage > 0 && glossaryCoverage >= Math.min(0.68, 1 / Math.max(1, constraints.length))
  const punctuationPenalty = terminalPunctuation(candidate) === terminalPunctuation(baseline) ? 0 : 0.25
  const lengthPenalty = Math.abs(Math.log(Math.max(0.1, lengthRatio)))
  const anchorPenalty = 1 - anchorCoverage
  const missingPenalty = (1 - glossaryCoverage) * 5.6
  const exactBonus = satisfiesGlossary ? 1.2 : 0
  const score = 10 + exactBonus - missingPenalty - lengthPenalty * 2.5 - anchorPenalty * 1.5 - punctuationPenalty
  return { accepted, partialAccepted, satisfiesGlossary, glossaryCoverage, score, reasons }
}

function glossaryTargetCoverage(candidateText, constraints) {
  if (!constraints.length) return 1
  const normalized = normalizeGlossaryText(candidateText)
  const matched = constraints.filter((constraint) => glossaryTargetMatches(normalized, constraint))
  return matched.length / constraints.length
}

function glossaryTargetMatches(normalizedText, constraint) {
  return glossaryTargetVariants(constraint.target).some((variant) => normalizedText.includes(variant))
}

function glossaryTargetVariants(target) {
  const normalized = normalizeGlossaryText(target)
  const variants = new Set([normalized])
  if (normalized === 'conge annuel') variants.add('conges annuels')
  if (normalized === 'conge de maladie') variants.add('conges de maladie')
  if (normalized === 'compte utilisateur') {
    variants.add('compte d utilisateur')
    variants.add('comptes utilisateur')
    variants.add('comptes utilisateurs')
  }
  if (normalized === 'liste de controle d acces') {
    variants.add('liste des controles d acces')
    variants.add('liste de controles d acces')
  }
  if (normalized === 'accord sur les niveaux de service') variants.add('accord de service')
  if (normalized === 'politique d approvisionnement') variants.add('politique d achat')
  if (normalized === 'evaluation des facteurs relatifs a la vie privee') {
    variants.add('evaluation des repercussions sur la vie privee')
    variants.add('evaluation des impacts sur la vie privee')
  }
  if (normalized === 'evaluation du rendement') variants.add('examen du rendement')
  return Array.from(variants)
}

function baselineAnchorCoverage(baselineText, candidateText) {
  const baselineWords = contentWords(baselineText)
  if (!baselineWords.length) return 1
  const candidate = normalizeGlossaryText(candidateText)
  const matched = baselineWords.filter((word) => candidate.includes(word))
  return matched.length / baselineWords.length
}

function contentWords(text) {
  const stop = new Set(['avec', 'avant', 'dans', 'des', 'du', 'est', 'les', 'pour', 'que', 'qui', 'sur', 'the', 'and', 'for', 'that', 'this', 'with'])
  return normalizeGlossaryText(text)
    .split(/[^a-z0-9]+/i)
    .filter((word) => word.length >= 4 && !stop.has(word))
}

function hasDegenerateRepetition(text) {
  return /([_\-=])\1{6,}/.test(text) || /([^\s])\1{14,}/.test(text) || /(\b\w{3,}\b)(?:\s+\1){3,}/i.test(text)
}

function terminalPunctuation(text) {
  return String(text || '').trim().match(/[.!?]$/)?.[0] || ''
}

function containsAllGlossaryTargets(text, constraints) {
  const normalized = normalizeGlossaryText(text)
  return constraints.every((constraint) => glossaryTargetMatches(normalized, constraint))
}

function containsGlossaryTarget(text, constraint) {
  return glossaryTargetMatches(normalizeGlossaryText(text), constraint)
}

function containsSubsequence(sequence, target) {
  if (!target.length || target.length > sequence.length) return false
  for (let start = 0; start <= sequence.length - target.length; start++) {
    let matches = true
    for (let index = 0; index < target.length; index++) {
      if (sequence[start + index] !== target[index]) {
        matches = false
        break
      }
    }
    if (matches) return true
  }
  return false
}

function suffixPrefixLength(sequence, target) {
  const max = Math.min(sequence.length, target.length - 1)
  for (let length = max; length > 0; length--) {
    let matches = true
    for (let index = 0; index < length; index++) {
      if (sequence[sequence.length - length + index] !== target[index]) {
        matches = false
        break
      }
    }
    if (matches) return length
  }
  return 0
}

function normalizeGlossaryText(text) {
  return String(text || '')
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function logGlossaryConstraintResult({ strategy, input, constraints, startedAt, candidates }) {
  console.info(
    JSON.stringify({
      type: 'glossary-constraints',
      strategy,
      elapsedMs: Math.round(now() - startedAt),
      sourceLength: input.length,
      targets: constraints.map((constraint) => constraint.target),
      candidates: candidates.map((candidate) => ({
        strategy: candidate.strategy,
        accepted: candidate.accepted,
        satisfiesGlossary: candidate.satisfiesGlossary,
        score: candidate.score,
        elapsedMs: candidate.elapsedMs,
        reasons: candidate.reasons,
        text: candidate.text,
      })),
    }),
  )
}

async function translateBatch(message) {
  const items = Array.isArray(message.items) ? message.items : []
  const model = message.model || 'opus-mt-en-fr'
  const generation = message.generation || {}
  for (const item of items) {
    const result = await translateItem(item, model, generation)
    self.postMessage({
      status: 'result',
      batchId: message.batchId,
      index: item.index,
      workerId: message.workerId,
      result,
    })
  }

  await disposeTranslationModel()
  self.postMessage({ status: 'batch-complete', batchId: message.batchId, workerId: message.workerId })
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

self.addEventListener('message', async (event) => {
  const message = event.data || {}

  try {
    if (message.task === 'model') {
      await loadTranslationModel(message.model || 'opus-mt-en-fr', true)
      return
    }

    if (message.task === 'dispose') {
      await disposeTranslationModel()
      self.close()
      return
    }

    if (message.task === 'translate-batch') {
      await translateBatch(message)
    }
  } catch (error) {
    self.postMessage({
      status: 'error',
      workerId: message.workerId,
      batchId: message.batchId,
      error: error?.message || String(error),
    })
  }
})

self.postMessage({ status: 'init' })
