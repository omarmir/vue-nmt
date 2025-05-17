import winkNLPfromLib, { type ItemSentence } from 'wink-nlp' // Renamed to avoid potential conflict if winkNLP itself was a type
// Load english language model — light version.
import model from 'wink-eng-lite-web-model'

// Derive types from the winkNLP default export.
// This provides type safety based on the actual signature of the library's main function
// and the objects it produces, which is helpful if named type exports are not available or recognized.
type NlpType = ReturnType<typeof winkNLPfromLib>
type ItsType = NlpType['its']
type DocType = ReturnType<NlpType['readDoc']>

// This interface defines the structure for each entry (sentence or formatting)
export interface SentenceEntry {
  /** The 0-based order/index of this entry in the sequence. */
  index: number
  /** The text content of this entry (could be a sentence or formatting). */
  text: string
  /** Flag indicating if this sentence/text part should be translated. */
  shouldTranslate: boolean
}

export class SmartTextSplitter {
  // Static members for WinkNLP instance to ensure it's initialized only once
  private static nlpEngine: NlpType | null = null
  private static itsLogic: ItsType | null = null
  private static nlpInitializationPromise: Promise<void> | null = null

  /**
   * Initializes the splitter with the text to be processed.
   * Ensures that the underlying NLP engine is initialized.
   * @param text The input plain text in English.
   */
  constructor() {
    // Static initialization ensures it only runs once across all instances
    SmartTextSplitter.ensureNLPInitialized()
  }

  /**
   * Initializes the WinkNLP engine if it hasn't been already.
   * This is a static method to manage a single shared NLP instance.
   */
  private static ensureNLPInitialized(): Promise<void> {
    if (!SmartTextSplitter.nlpInitializationPromise) {
      SmartTextSplitter.nlpInitializationPromise = (async () => {
        if (!SmartTextSplitter.nlpEngine) {
          // console.log("Initializing WinkNLP engine..."); // For debugging
          SmartTextSplitter.nlpEngine = winkNLPfromLib(model) // Use the imported function
          SmartTextSplitter.itsLogic = SmartTextSplitter.nlpEngine.its
          // console.log("WinkNLP engine initialized."); // For debugging
        }
      })()
    }
    return SmartTextSplitter.nlpInitializationPromise
  }

  /**
   * Asynchronously gets the WinkNLP engine. Ensures it's initialized.
   * @returns A promise that resolves with the WinkNLPEngine.
   */
  private async getNLPEngine(): Promise<{ nlp: NlpType; its: ItsType }> {
    await SmartTextSplitter.ensureNLPInitialized()
    if (!SmartTextSplitter.nlpEngine || !SmartTextSplitter.itsLogic) {
      throw new Error('WinkNLP engine failed to initialize.')
    }
    return { nlp: SmartTextSplitter.nlpEngine, its: SmartTextSplitter.itsLogic }
  }

  /**
   * Splits the input text into sentences and formatting blocks.
   * The result is an array of objects, each containing its order (index),
   * text content, and a flag indicating if it's translatable.
   * The result is cached after the first call for this instance.
   * @returns A Promise resolving to an array of SentenceEntry objects.
   */
  public async getSentenceMap(text: string): Promise<SentenceEntry[]> {
    const { nlp, its } = await this.getNLPEngine() // Ensure NLP is ready

    const entries: SentenceEntry[] = []
    let globalIndex = 0

    if (text === null || text === undefined || text.length === 0) {
      return []
    }

    const newlineRegexPattern = /(\r\n|\r|\n)+/
    const segments: string[] = text.split(newlineRegexPattern)

    for (const segment of segments) {
      if (segment === undefined || segment === '') {
        continue
      }

      const isPurelyNewline = /^(?:\r\n|\r|\n)+$/.test(segment)

      if (isPurelyNewline) {
        entries.push({
          index: globalIndex++,
          text: segment,
          shouldTranslate: false,
        })
      } else {
        if (segment.trim() === '') {
          entries.push({
            index: globalIndex++,
            text: segment,
            shouldTranslate: false,
          })
        } else {
          const subDoc: DocType = nlp.readDoc(segment)
          let currentPointerInSegment = 0

          subDoc.sentences().each((sentence: ItemSentence) => {
            const tokenIndexes = sentence.out(its.span) as [number, number]

            const allSubDocTokens = subDoc.tokens()

            let sentenceCharStartIndexInSegment = 0
            for (let i = 0; i < tokenIndexes[0]; i++) {
              sentenceCharStartIndexInSegment += allSubDocTokens
                .itemAt(i)
                .out(its.precedingSpaces).length
              sentenceCharStartIndexInSegment += allSubDocTokens.itemAt(i).out(its.value).length
            }
            sentenceCharStartIndexInSegment += allSubDocTokens
              .itemAt(tokenIndexes[0])
              .out(its.precedingSpaces).length

            if (sentenceCharStartIndexInSegment > currentPointerInSegment) {
              const leadingWhitespaceText = segment.substring(
                currentPointerInSegment,
                sentenceCharStartIndexInSegment,
              )
              if (leadingWhitespaceText.length > 0) {
                entries.push({
                  index: globalIndex++,
                  text: leadingWhitespaceText,
                  shouldTranslate: false,
                })
              }
            }

            let exactSentenceText = ''
            for (let i = tokenIndexes[0]; i <= tokenIndexes[1]; i++) {
              const currentToken = allSubDocTokens.itemAt(i)
              if (i > tokenIndexes[0]) {
                exactSentenceText += currentToken.out(its.precedingSpaces)
              }
              exactSentenceText += currentToken.out(its.value)
            }

            if (exactSentenceText.length > 0) {
              entries.push({
                index: globalIndex++,
                text: exactSentenceText,
                shouldTranslate: true,
              })
            }
            currentPointerInSegment = sentenceCharStartIndexInSegment + exactSentenceText.length
          })

          if (currentPointerInSegment < segment.length) {
            const trailingTextInSegment = segment.substring(currentPointerInSegment)
            if (trailingTextInSegment.length > 0) {
              entries.push({
                index: globalIndex++,
                text: trailingTextInSegment,
                shouldTranslate: trailingTextInSegment.trim() !== '',
              })
            }
          }
        }
      }
    }
    return entries
  }
}
