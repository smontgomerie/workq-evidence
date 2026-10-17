import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WbResultsScreen from '../WbResultsScreen';
import { wbClient } from '../wbClient';
import { wbAssessClient } from '../wbAssessClient';
import { useLabSession } from '../../useLabSession';

jest.mock('../wbClient', () => ({
  wbClient: {
    listExperiments: jest.fn(),
    listRevisions: jest.fn(),
    getRevision: jest.fn(),
    getMedia: jest.fn(),
  },
}));

jest.mock('../wbAssessClient', () => ({
  wbAssessClient: {
    results: jest.fn(),
    aggregates: jest.fn(),
    protectedLosses: jest.fn(),
    recordAssessment: jest.fn(),
    findAssessmentReuse: jest.fn(),
  },
}));

jest.mock('../../useLabSession', () => ({ useLabSession: jest.fn() }));

const useLabSessionMock = useLabSession as jest.Mock;

const TIME = '2026-10-12T12:00:00.000Z';

/** Deterministic 64-char hashes, distinct per input. */
const SHA = (n: number) =>
  Array.from({ length: 64 }, (_, j) =>
    String.fromCharCode(97 + ((n * 7 + j * 13) % 26))
  ).join('');
const HCTX = (n: number) => SHA(n + 4000);

function humanAssessmentsFor(i: number): Record<string, unknown>[] {
  switch (i) {
    case 0:
      return [
        {
          assessmentId: 900,
          trialId: 400,
          executionId: 500,
          rubricRevisionId: 7,
          outputSha256: SHA(0),
          expectationContextHash: HCTX(0),
          assessor: { kind: 'human', id: '9' },
          target: 'scene',
          scores: [
            { dimensionId: 'likeness', value: 4 },
            { dimensionId: 'background', value: 3 },
          ],
          verdict: 'accept',
          source: 'fresh',
          uncertainty: undefined,
          conflict: undefined,
          notes: null,
        },
      ];
    case 1:
      return [
        {
          assessmentId: 901,
          trialId: 401,
          executionId: 501,
          rubricRevisionId: 7,
          outputSha256: SHA(1),
          expectationContextHash: HCTX(1),
          assessor: { kind: 'human', id: '9' },
          target: 'scene',
          scores: [
            { dimensionId: 'likeness', value: 4 },
            { dimensionId: 'background', value: 4 },
          ],
          verdict: 'accept',
          source: 'fresh',
          uncertainty: 'medium',
          conflict: undefined,
          notes: 'minor flicker on the second frame',
        },
      ];
    case 2:
      return [
        {
          assessmentId: 902,
          trialId: 402,
          executionId: 502,
          rubricRevisionId: 7,
          outputSha256: SHA(2),
          expectationContextHash: HCTX(2),
          assessor: { kind: 'human', id: '9' },
          target: 'scene',
          scores: [
            { dimensionId: 'likeness', value: 1 },
            { dimensionId: 'background', value: 2 },
          ],
          verdict: 'reject',
          source: 'fresh',
          uncertainty: undefined,
          conflict: undefined,
          notes: 'background drift across the sequence',
        },
      ];
    case 3:
      return [
        {
          assessmentId: 903,
          trialId: 403,
          executionId: 503,
          rubricRevisionId: 7,
          outputSha256: SHA(3),
          expectationContextHash: HCTX(3),
          assessor: { kind: 'human', id: '9' },
          target: 'scene',
          // Partial score never covers its required dimension.
          scores: [{ dimensionId: 'likeness', value: 2, partial: true }],
          verdict: 'uncertain',
          source: 'fresh',
          uncertainty: 'high',
          conflict: undefined,
          notes: null,
        },
      ];
    default:
      return [];
  }
}

function trialAt(i: number, revealed: boolean): Record<string, unknown> {
  const trialId = 400 + i;
  const ordinal = i % 2;
  const outputs =
    i === 0
      ? [
          {
            bindingId: 101,
            trialId,
            executionId: 500,
            mediaAssetId: 21,
            sha256: SHA(0),
            outputIndex: 0,
            provenance: 'fresh',
          },
          {
            bindingId: 102,
            trialId,
            executionId: 501,
            mediaAssetId: 22,
            sha256: SHA(1),
            outputIndex: 1,
            provenance: 'fresh',
          },
        ]
      : [
          {
            bindingId: 200 + i,
            trialId,
            executionId: 500 + i,
            mediaAssetId: 23 + (i % 2),
            sha256: SHA(i),
            outputIndex: 0,
            provenance: 'fresh',
          },
        ];
  const assessments: Record<string, unknown>[] = [...humanAssessmentsFor(i)];
  if (revealed && i === 0) {
    assessments.push({
      assessmentId: 800,
      trialId,
      executionId: 500,
      rubricRevisionId: 7,
      outputSha256: SHA(0),
      expectationContextHash: HCTX(0),
      assessor: { kind: 'llm', id: 'sol' },
      target: 'scene',
      scores: [],
      verdict: 'accept',
      source: 'fresh',
      uncertainty: undefined,
      conflict: undefined,
      notes: 'consistent with the references',
    });
  }
  return {
    trialId,
    caseRevisionId: 104,
    variantOrdinal: ordinal,
    variantLabel: revealed ? (ordinal === 0 ? 'klein9b' : 'krea2turbo') : null,
    variantDetails: revealed
      ? { workflowRevisionId: ordinal === 0 ? 40 : 41 }
      : null,
    seed: 11,
    trialStatus: 'succeeded',
    outputs,
    assessments,
    aiAssessmentCount: revealed && i === 0 ? 1 : 0,
  };
}

const AGGREGATES = [
  {
    stage: 'scene',
    sourceGroup: 'scenario-7',
    rubricRevisionId: 7,
    assessorKind: 'human',
    assessorId: '9',
    totalAssessments: 4,
    verdictTotals: { accept: 2, reject: 1, uncertain: 1 },
    dimensions: [
      {
        dimensionId: 'likeness',
        assessed: 4,
        partial: 1,
        min: 2,
        max: 4,
        average: 3,
        verdictCounts: { accept: 2, reject: 1, uncertain: 1 },
      },
      {
        dimensionId: 'background',
        assessed: 2,
        partial: 0,
        min: 3,
        max: 3,
        average: 3,
        verdictCounts: { accept: 2, reject: 0, uncertain: 0 },
      },
    ],
  },
  {
    stage: 'scene',
    sourceGroup: 'scenario-7',
    rubricRevisionId: 7,
    assessorKind: 'llm',
    assessorId: 'sol',
    totalAssessments: 12,
    verdictTotals: { accept: 8, reject: 2, uncertain: 2 },
    dimensions: [
      {
        dimensionId: 'likeness',
        assessed: 12,
        partial: 0,
        min: 1,
        max: 5,
        average: 3.5,
        verdictCounts: { accept: 8, reject: 2, uncertain: 2 },
      },
    ],
  },
];

function makeView(revealed: boolean): Record<string, unknown> {
  return {
    experimentId: 31,
    blind: true,
    revealed,
    trials: Array.from({ length: 12 }, (_, i) => trialAt(i, revealed)),
    aggregates: AGGREGATES,
    coverage: {
      requiredDimensions: ['likeness', 'background'],
      trialsTotal: 12,
      trialsCovered: 3,
    },
  };
}

const EXP_31 = {
  experimentId: 31,
  name: '2x2 action/clothing screening',
  datasetRevisionId: 8,
  baselineRevisionId: 12,
  variants: [
    { label: 'klein9b', workflowRevisionId: 40 },
    { label: 'krea2turbo', workflowRevisionId: 41 },
  ],
  seeds: [11],
  design: { type: 'screening' },
  evaluationPolicy: {
    blind: true,
    assessorKinds: ['human'],
    requiredDimensions: ['likeness', 'background'],
  },
  costConsent: { hosted: false },
  status: 'running',
};
const EXP_30 = {
  experimentId: 30,
  name: 'beard style ablation',
  datasetRevisionId: 8,
  baselineRevisionId: 12,
  variants: [{ label: 'baseline', workflowRevisionId: 39 }],
  seeds: [7],
  design: {
    type: 'factorial',
    factors: [{ label: 'beard', levels: ['none', 'short'] }],
  },
  evaluationPolicy: { blind: true, assessorKinds: ['human'] },
  costConsent: { hosted: false },
  status: 'finished',
};

const SUITE_14: Record<string, unknown> = {
  revisionId: 14,
  kind: 'suite',
  subjectKey: 'suite:scene-guards',
  version: 2,
  contentHash: SHA(50),
  parentRevisionId: 13,
  sourceProvenance: 'imported',
  createdAt: TIME,
  payload: {
    name: 'Scene guards suite',
    datasetRevisionId: 8,
    checks: [
      {
        dimensionId: 'likeness',
        minVerdict: 'accept',
        notes: 'must stay at or above accept',
      },
      { dimensionId: 'background' },
    ],
    protectedExampleRevisionIds: [21, 22],
  },
};
const SUITE_15: Record<string, unknown> = {
  ...SUITE_14,
  revisionId: 15,
  version: 3,
  parentRevisionId: 14,
  contentHash: SHA(51),
  payload: {
    ...SUITE_14.payload,
    name: 'Scene guards suite v2',
  },
};

const LOSS_REPORT = {
  suiteRevisionId: 14,
  suiteName: 'Scene guards suite',
  protectedExamples: 2,
  checks: 2,
  allClear: false,
  losses: [
    {
      exampleRevisionId: 21,
      exampleSubjectKey: 'example:scene-4-canonical',
      check: {
        dimensionId: 'likeness',
        minVerdict: 'accept',
        notes: 'must stay at or above accept',
      },
      expected: 'accept',
      actual: 'reject',
      reason: 'verdict-below-minimum',
    },
    {
      exampleRevisionId: 22,
      exampleSubjectKey: 'example:scene-7-quarantined',
      check: { dimensionId: 'background' },
      expected: 'accept',
      actual: null,
      reason: 'unassessed',
    },
  ],
};
const CLEAR_REPORT = {
  suiteRevisionId: 15,
  suiteName: 'Scene guards suite v2',
  protectedExamples: 2,
  checks: 2,
  allClear: true,
  losses: [],
};

function mockDefaults() {
  useLabSessionMock.mockReturnValue({
    status: 'ready',
    session: { userId: 9, isAdmin: true },
  });
  (wbClient.listExperiments as jest.Mock).mockResolvedValue({
    data: [EXP_31, EXP_30],
    nextCursor: null,
    hasMore: false,
  });
  (wbClient.listRevisions as jest.Mock).mockResolvedValue({
    data: [SUITE_14, SUITE_15],
    nextCursor: null,
    hasMore: false,
  });
  (wbAssessClient.results as jest.Mock).mockImplementation(
    (_expId: number, options?: { revealed?: boolean }) =>
      Promise.resolve(makeView(options?.revealed === true))
  );
  (wbAssessClient.aggregates as jest.Mock).mockResolvedValue(AGGREGATES);
  (wbAssessClient.protectedLosses as jest.Mock).mockImplementation(
    (_expId: number, suiteId: number) =>
      Promise.resolve(suiteId === 14 ? LOSS_REPORT : CLEAR_REPORT)
  );
}

describe('WbResultsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDefaults();
  });

  it('surfaces incomplete coverage, per-assessor aggregates and the trial table', async () => {
    render(<WbResultsScreen experimentId={31} />);
    const coverage = await screen.findByTestId('wb-results-coverage');
    expect(coverage).toHaveTextContent('3 of 12 trials assessed');
    expect(coverage).toHaveTextContent('likeness, background');
    expect(screen.getByTestId('wb-results-coverage-gap')).toHaveTextContent(
      'Incomplete coverage: 9 trials not fully assessed'
    );
    // Blind posture: the aggregates endpoint returns every assessor group,
    // but the screen renders human groups only until reveal — the AI group
    // is hidden even though the view carries it.
    const groups = await screen.findAllByTestId('wb-results-aggregate-group');
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveTextContent('assessor human/9');
    expect(groups[0]).toHaveTextContent('4 assessments');
    expect(groups[0]).toHaveTextContent('accept 2 · reject 1 · uncertain 1');
    expect(screen.queryByText('assessor llm/sol')).toBeNull();
    const dims = screen.getAllByTestId('wb-results-aggregate-dimension');
    expect(dims).toHaveLength(2);
    // 12 trials paginate 10 per page.
    expect(screen.getByTestId('wb-results-trials-page')).toHaveTextContent(
      'Page 1 of 2 · showing 1–10 of 12'
    );
    const rows = await screen.findAllByTestId('wb-results-trial-row');
    expect(rows).toHaveLength(10);
    // The first trial carries two outputs.
    expect(rows[0]).toHaveTextContent('2');
    // Trials 403 (partial likeness only) through 409 never fully cover a
    // required dimension -> 7 gap chips on the first page.
    const gaps = screen.getAllByTestId('wb-results-trial-coverage-gap');
    expect(gaps).toHaveLength(7);
    expect(gaps[0]).toHaveTextContent('missing: likeness, background');
  });

  it('paginates trials to the last page', async () => {
    render(<WbResultsScreen experimentId={31} />);
    await screen.findByTestId('wb-results-trials-pagination');
    fireEvent.click(screen.getByTestId('wb-results-trials-next'));
    const pageLabel = await screen.findByTestId('wb-results-trials-page');
    expect(pageLabel).toHaveTextContent('Page 2 of 2 · showing 11–12 of 12');
    const rows = await screen.findAllByTestId('wb-results-trial-row');
    expect(rows).toHaveLength(2);
    // Both last-page trials are unassessed: each row shows the gap chip.
    const gaps = screen.getAllByTestId('wb-results-trial-coverage-gap');
    expect(gaps).toHaveLength(2);
    expect(screen.getByTestId('wb-results-trials-next')).toBeDisabled();
  });

  it('reviewers see a blind view with no reveal control', async () => {
    useLabSessionMock.mockReturnValue({
      status: 'ready',
      session: { userId: 11, isAdmin: false },
    });
    render(<WbResultsScreen experimentId={31} />);
    expect(screen.queryByTestId('wb-results-reveal')).toBeNull();
    const chips = await screen.findAllByTestId('wb-results-variant-chip');
    expect(chips[0]).toHaveTextContent('arm 1 (blind)');
    expect(chips[1]).toHaveTextContent('arm 2 (blind)');
    // The server call stays blind: no reveal flag is ever requested.
    expect(wbAssessClient.results as jest.Mock).toHaveBeenCalledWith(31, {
      revealed: false,
    });
  });

  it('admin can reveal variant labels and AI results, then re-blind', async () => {
    render(<WbResultsScreen experimentId={31} />);
    const reveal = await screen.findByTestId('wb-results-reveal');
    fireEvent.click(reveal);
    const chips = await screen.findAllByTestId('wb-results-variant-chip');
    expect(chips[0]).toHaveTextContent('klein9b');
    // The revealed view carries the AI assessment for trial 400.
    expect(await screen.findByText('AI:sol → accept')).toBeInTheDocument();
    // Reveal also unlocks the AI assessor's aggregate group.
    const groups = screen.getAllByTestId('wb-results-aggregate-group');
    expect(groups).toHaveLength(2);
    expect(groups[1]).toHaveTextContent('assessor llm/sol');
    expect(groups[1]).toHaveTextContent('12 assessments');
    expect(wbAssessClient.results as jest.Mock).toHaveBeenCalledWith(31, {
      revealed: true,
    });
    // Re-blind returns to arm ordinals and drops the AI content.
    fireEvent.click(screen.getByTestId('wb-results-reveal'));
    const blindChips = await screen.findAllByTestId('wb-results-variant-chip');
    expect(blindChips[0]).toHaveTextContent('arm 1 (blind)');
    expect(screen.queryByText('AI:sol → accept')).toBeNull();
  });

  it('lists every protected loss and switches to an all-clear suite', async () => {
    render(<WbResultsScreen experimentId={31} />);
    const select = await screen.findByTestId('wb-results-suite-select');
    // The first suite matching the experiment's dataset auto-selects.
    expect(select).toHaveValue('14');
    const losses = await screen.findAllByTestId('wb-results-protected-loss');
    expect(losses).toHaveLength(2);
    expect(losses[0]).toHaveTextContent('example:scene-4-canonical');
    expect(losses[0]).toHaveTextContent('expects accept, got reject');
    expect(losses[0]).toHaveTextContent('verdict below minimum');
    expect(losses[1]).toHaveTextContent('example:scene-7-quarantined');
    expect(losses[1]).toHaveTextContent('never assessed this dimension');
    fireEvent.change(select, { target: { value: '15' } });
    expect(
      await screen.findByTestId('wb-results-protected-all-clear')
    ).toHaveTextContent('All protected examples pass their checks');
    expect(screen.queryAllByTestId('wb-results-protected-loss')).toHaveLength(
      0
    );
  });

  it('follows a deep-link change between experiments on the same mount', async () => {
    const exp32 = {
      ...EXP_31,
      experimentId: 32,
      name: 'clothing-only regression',
    };
    (wbClient.listExperiments as jest.Mock).mockResolvedValue({
      data: [EXP_31, EXP_30, exp32],
      nextCursor: null,
      hasMore: false,
    });
    const { rerender } = render(<WbResultsScreen experimentId={31} />);
    const select = await screen.findByTestId('wb-results-experiment-filter');
    expect(select).toHaveValue('31');
    // Deep-link ?experiment=32 on the same mount must re-point the view
    // and fetch that experiment's results/aggregates.
    rerender(<WbResultsScreen experimentId={32} />);
    await waitFor(() => expect(select).toHaveValue('32'));
    expect(wbAssessClient.results).toHaveBeenCalledWith(32, {
      revealed: false,
    });
  });
});


describe('self-review audit reproduction', () => {
  it('does not fetch unblinded AI aggregates before explicit reveal', async () => {
    jest.clearAllMocks(); mockDefaults();
    render(<WbResultsScreen experimentId={31} />);
    await screen.findByTestId('wb-results-coverage');
    expect(wbAssessClient.aggregates).not.toHaveBeenCalled();
  });
});
