import { NextResponse } from 'next/server';
import { deriveAll } from '@/engine/derive';
import { EXTRACTION_PROMPT } from '@/engine/extraction';
import { segmentText, ThinkingUnit } from '@/engine/segmentation';

type AnalyzeRequest = { text?: string };

function buildExtractionInput(inputText: string, units: ThinkingUnit[]): string {
  return [
    'Original Text:',
    inputText,
    '',
    'Thinking Units:',
    ...units.map((u) => `${u.id}: ${u.text}`),
  ].join('\n');
}

function pickJsonObject(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    // continue
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const sliced = text.slice(start, end + 1);
    try {
      return JSON.parse(sliced);
    } catch {
      // continue
    }
  }

  throw new Error('Model did not return valid JSON.');
}

async function callOpenAI(prompt: string, userText: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY environment variable.');

  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

  const body = {
    model,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: userText },
    ],
    temperature: 0,
    response_format: { type: 'json_object' },
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message || `OpenAI API error (${res.status})`;
    throw new Error(msg);
  }

  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('OpenAI returned empty content.');
  }

  return content;
}

function detectInputLanguage(inputText: string): string {
  if (/[\u3131-\u318E\uAC00-\uD7A3]/.test(inputText)) return 'KO';
  if (/[A-Za-z]/.test(inputText)) return 'EN';
  return 'EN';
}

function makeVerificationId(now: Date): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const rand = Math.random().toString().slice(2, 6).padStart(4, '0');
  return `NP-${yyyy}-${mm}${dd}-${rand}`;
}

function toReportSchema(extraction: any, derived: any, inputText: string) {
  const now = new Date();
  const output = derived && typeof derived === 'object' && 'output' in derived ? derived.output : derived;
  const rcd = output?.rc?.reasoning_control_distribution || {};
  const cffPattern = output?.cff?.pattern || {};
  const cffDefinition = cffPattern?.definition || {};

  const humanDist = rcd?.Human ?? rcd?.human ?? null;
  const hybridDist = rcd?.Hybrid ?? rcd?.hybrid ?? null;
  const aiDist = rcd?.AI ?? rcd?.ai ?? null;

  return {
    meta: {
      input_language: detectInputLanguage(inputText),
      generated_at_utc: now.toISOString(),
      verify_url: 'https://neuprint.ai/verify',
      verification_id: makeVerificationId(now),
      input_text: inputText,
      decision_compression_quote: extraction?.decision_compression_quote || '',
    },
    chips: {
      rsl_level_short_name: output?.rsl?.level?.short_name || '',
      rsl_fri_score: output?.rsl?.fri?.score ?? null,
      cff_final_type_chip_label: output?.cff?.final_type?.chip_label || output?.cff?.final_type?.label || '',
      rc_final_determination: rcd?.final_determination || '',
      rfs_top_group_name: Array.isArray(output?.rfs?.top_groups) && output.rfs.top_groups[0]
        ? (output.rfs.top_groups[0].group_name || '')
        : '',
    },
    rsl: {
      level: {
        short_name: output?.rsl?.level?.short_name || '',
        full_name: output?.rsl?.level?.full_name || '',
        definition: output?.rsl?.level?.definition || '',
      },
      fri: {
        score: output?.rsl?.fri?.score ?? null,
        interpretation: output?.rsl?.fri?.interpretation || '',
      },
      cohort: {
        top_percent_label: output?.rsl?.cohort?.top_percent_label || '',
        interpretation: output?.rsl?.cohort?.interpretation || '',
        percentile_0to1: output?.rsl?.cohort?.percentile_0to1 ?? null,
      },
      percentile_0to1: output?.rsl?.cohort?.percentile_0to1 ?? null,
      sri: {
        score: output?.rsl?.sri?.score ?? null,
        interpretation: output?.rsl?.sri?.interpretation || '',
      },
      summary: {
        one_line: extraction?.rsl?.summary?.one_line || '',
        paragraph: extraction?.rsl?.summary?.paragraph || '',
      },
      dimensions: Array.isArray(extraction?.rsl?.dimensions) ? extraction.rsl.dimensions : [],
    },
    cff: {
      final_type: {
        chip_label: output?.cff?.final_type?.chip_label || output?.cff?.final_type?.label || '',
        label: output?.cff?.final_type?.label || '',
        type_code: output?.cff?.final_type?.type_code || '',
        confidence: output?.cff?.final_type?.confidence ?? null,
        interpretation: output?.cff?.final_type?.interpretation || '',
      },
      pattern: {
        primary_label: cffPattern?.primary_label || '',
        secondary_label: cffPattern?.secondary_label || '',
        primary_description: cffDefinition?.primary || '',
        secondary_description: cffDefinition?.secondary || '',
        definition: {
          primary: cffDefinition?.primary || '',
          secondary: cffDefinition?.secondary || '',
          line1: cffDefinition?.line1 || cffDefinition?.primary || '',
          line2: cffDefinition?.line2 || cffDefinition?.secondary || '',
        },
        explanation: cffPattern?.explanation || '',
        key_observation: cffPattern?.key_observation || '',
      },
      labels: Array.isArray(output?.cff?.labels) ? output.cff.labels : [],
      values_0to1: Array.isArray(output?.cff?.values_0to1) ? output.cff.values_0to1 : [],
      scores: output?.cff?.scores || {},
      matched_reasons: Array.isArray(output?.cff?.matched_reasons) ? output.cff.matched_reasons : [],
      confidence_note: output?.cff?.confidence_note || '',
    },
    rc: {
      reasoning_control_distribution: {
        human: humanDist,
        hybrid: hybridDist,
        ai: aiDist,
        Human: humanDist,
        Hybrid: hybridDist,
        AI: aiDist,
        final_determination: rcd?.final_determination || '',
        determination_sentence: rcd?.determination_sentence || '',
      },
      structural_pattern: output?.rc?.structural_pattern || output?.rc?.control_pattern || '',
      control_pattern: output?.rc?.control_pattern || output?.rc?.structural_pattern || '',
      reliability_band: output?.rc?.reliability_band || '',
      band_rationale: output?.rc?.band_rationale || '',
      summary: output?.rc?.summary || '',
      observed_structural_signals: {
        '1': output?.rc?.observed_structural_signals?.['1'] || '',
        '2': output?.rc?.observed_structural_signals?.['2'] || '',
        '3': output?.rc?.observed_structural_signals?.['3'] || '',
        '4': output?.rc?.observed_structural_signals?.['4'] || '',
      },
      pattern_interpretation: output?.rc?.pattern_interpretation || '',
      structural_control_signals: {
        structural_variance: output?.rc?.structural_control_signals?.structural_variance ?? null,
        human_rhythm_index: output?.rc?.structural_control_signals?.human_rhythm_index ?? null,
        transition_flow: output?.rc?.structural_control_signals?.transition_flow ?? null,
        revision_depth: output?.rc?.structural_control_signals?.revision_depth ?? null,
      },
      determination_sentence: output?.rc?.determination_sentence || rcd?.determination_sentence || '',
    },
    rfs: {
      top_groups: Array.isArray(output?.rfs?.top_groups) ? output.rfs.top_groups : [],
      primary_pattern: output?.rfs?.primary_pattern || '',
      representative_phrase: output?.rfs?.representative_phrase || '',
      summary_lines: Array.isArray(output?.rfs?.summary_lines) ? output.rfs.summary_lines : [],
      recommended_roles_top3: Array.isArray(output?.rfs?.recommended_roles_top3) ? output.rfs.recommended_roles_top3 : [],
      recommended_roles_line: output?.rfs?.recommended_roles_line || '',
      pattern_interpretation: output?.rfs?.pattern_interpretation || '',
    },
  };
}

export async function POST(req: Request) {
  try {
    const { text }: AnalyzeRequest = await req.json();
    const inputText = (text || '').trim();

    if (!inputText) {
      return NextResponse.json({ ok: false, error: 'Please enter text.' }, { status: 400 });
    }

    const segmented = segmentText(inputText);
    const extractionInput = buildExtractionInput(inputText, segmented.units);
    const modelContent = await callOpenAI(EXTRACTION_PROMPT, extractionInput);
    const extraction = pickJsonObject(modelContent);

    const derived = deriveAll(
      {
        raw_features: extraction,
        rsl: extraction?.rsl,
        rsl_rubric: extraction?.rsl_rubric,
        raw_signals_quotes: extraction?.raw_signals_quotes,
        input_text: inputText,
        segmented_sentences: segmented.sentences,
        segmented_units: segmented.units,
      } as any,
    );

    const report = toReportSchema(extraction, derived, inputText);
    return NextResponse.json(report, { status: 200 });
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : 'Unknown error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
