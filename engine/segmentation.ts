export type ThinkingUnit = {
  id: string;
  text: string;
  sentence_index: number;
  unit_index: number;
};

export type SegmentationResult = {
  normalized_text: string;
  sentences: string[];
  units: ThinkingUnit[];
};

const UNIT_MARKERS = [
  'on the other hand',
  'for example',
  'for instance',
  'in contrast',
  'however',
  'because',
  'therefore',
  'although',
  'but',
  'if',
  'so',
] as const;

export function normalizeText(text: string): string {
  return String(text ?? '')
    .replace(/\r?\n/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitSentences(text: string): string[] {
  return normalizeText(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findMarkerPositions(sentence: string): number[] {
  const positions = new Set<number>();

  for (const marker of UNIT_MARKERS) {
    const escaped = escapeRegex(marker).replace(/\s+/g, '\\s+');
    const re = new RegExp(`(^|[\\s,;:()])(${escaped})\\b`, 'gi');
    let match: RegExpExecArray | null;

    while ((match = re.exec(sentence)) !== null) {
      const prefix = match[1] ?? '';
      const markerIndex = match.index + prefix.length;
      if (markerIndex > 0 && markerIndex < sentence.length) {
        positions.add(markerIndex);
      }
    }
  }

  return Array.from(positions).sort((a, b) => a - b);
}

export function splitThinkingUnits(sentence: string): string[] {
  const source = String(sentence ?? '').trim();
  if (!source) return [];

  const positions = findMarkerPositions(source);
  if (!positions.length) return [source];

  const units: string[] = [];
  let start = 0;

  for (const position of positions) {
    const previous = source.slice(start, position).trim();
    if (previous) units.push(previous);
    start = position;
  }

  const tail = source.slice(start).trim();
  if (tail) units.push(tail);

  return units.filter(Boolean);
}

export function buildUnits(sentences: string[]): ThinkingUnit[] {
  const out: ThinkingUnit[] = [];
  let unitIndex = 0;

  sentences.forEach((sentence, sentenceIndex) => {
    const parts = splitThinkingUnits(sentence);
    parts.forEach((part) => {
      out.push({
        id: `U${unitIndex + 1}`,
        text: part,
        sentence_index: sentenceIndex,
        unit_index: unitIndex,
      });
      unitIndex += 1;
    });
  });

  return out;
}

export function segmentText(text: string): SegmentationResult {
  const normalized_text = normalizeText(text);
  const sentences = splitSentences(normalized_text);
  const units = buildUnits(sentences);
  return { normalized_text, sentences, units };
}
