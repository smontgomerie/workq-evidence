import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import WbReviewScreen, { trialNeedsReview } from '../WbReviewScreen';
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
jest.mock('../../../../lib/config', () => ({
  getFullImageUrl: (path: string | null | undefined) => path ?? '',
}));

const useLabSessionMock = useLabSession as jest.Mock;

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

function trial(
  trialId: number,
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    trialId,
    caseRevisionId: 104,
    variantOrdinal: trialId % 2,
    variantLabel: null,
    variantDetails: null,
    seed: 11,
    trialStatus: 'succeeded',
    outputs: [
      {
        bindingId: trialId,
        trialId,
        executionId: 500 + trialId,
        mediaAssetId: 21,
        sha256: trialId === 400 ? SHA_A : SHA_B,
        outputIndex: 0,
        provenance: 'fresh',
      },
    ],
    assessments: [],
    aiAssessmentCount: 0,
    ...overrides,
  };
}

const FULL_HUMAN = {
  assessmentId: 900,
  trialId: 401,
  executionId: 901,
  rubricRevisionId: 7,
  outputSha256: SHA_B,
  expectationContextHash: 'c'.repeat(64),
  assessor: { kind: 'human', id: '9' },
  target: 'scene',
  scores: [
    { dimensionId: 'likeness', value: 4 },
    { dimensionId: 'background', value: 3 },
  ],
  verdict: 'accept',
  source: 'fresh',
  notes: null,
  uncertainty: undefined,
  conflict: undefined,
};

function makeView(overrides: Record<string, unknown> = {}) {
  return {
    experimentId: 31,
    blind: true,
    revealed: false,
    trials: [trial(400), { ...trial(401), assessments: [FULL_HUMAN] }],
    aggregates: [
      {
        stage: 'scene',
        sourceGroup: 'scenario-7',
        rubricRevisionId: 7,
        assessorKind: 'human',
        assessorId: '9',
        totalAssessments: 1,
        verdictTotals: { accept: 1, reject: 0, uncertain: 0 },
        dimensions: [],
      },
    ],
    coverage: {
      requiredDimensions: ['likeness', 'background'],
      trialsTotal: 2,
      trialsCovered: 1,
    },
    ...overrides,
  };
}

const EXPERIMENT = {
  experimentId: 31,
  name: '2x2 action/clothing screening',
  datasetRevisionId: 8,
  baselineRevisionId: 12,
  variants: [{ label: 'klein9b', workflowRevisionId: 40 }],
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

function mockDefaults() {
  useLabSessionMock.mockReturnValue({
    status: 'ready',
    session: { userId: 9, isAdmin: true },
  });
  (wbClient.listExperiments as jest.Mock).mockResolvedValue({
    data: [EXPERIMENT],
    nextCursor: null,
    hasMore: false,
  });
  (wbClient.listRevisions as jest.Mock).mockResolvedValue({
    data: [],
    nextCursor: null,
    hasMore: false,
  });
  (wbClient.getRevision as jest.Mock).mockResolvedValue({
    data: {
      revisionId: 104,
      kind: 'case',
      subjectKey: 'case:scene-7',
      version: 1,
      contentHash: 'd'.repeat(64),
      parentRevisionId: null,
      sourceProvenance: 'imported',
      createdAt: '2026-10-12T12:00:00.000Z',
      payload: {
        case: {
          taskIntent: 'sequential character insertion',
          input: {
            stage: 'scene',
            strategy: 'sequential',
            canonicals: [],
            background: { mediaAssetId: 0, sha256: SHA_B },
            prompt: 'two characters enter the scene',
          },
        },
      },
    },
  });
  (wbClient.getMedia as jest.Mock).mockResolvedValue({
    data: {
      assetId: 21,
      ownerUserId: 9,
      kind: 'output',
      url: '/asset-21.svg',
      sha256: SHA_A,
      label: 'OUT',
      contentType: 'image/svg+xml',
    },
  });
  (wbAssessClient.results as jest.Mock).mockResolvedValue(makeView());
  (wbAssessClient.aggregates as jest.Mock).mockResolvedValue([]);
  (wbAssessClient.recordAssessment as jest.Mock).mockResolvedValue({
    created: true,
    assessment: { assessmentId: 1 },
  });
}

describe('trialNeedsReview', () => {
  it('treats failed trials as not needing review', () => {
    const t = trial(400, { trialStatus: 'failed' });
    expect(trialNeedsReview(t as never, undefined)).toBe(false);
  });

  it('needs review when no human has scored a trial with outputs', () => {
    expect(trialNeedsReview(trial(400) as never, undefined)).toBe(true);
    expect(
      trialNeedsReview(
        trial(401, { assessments: [FULL_HUMAN] }) as never,
        undefined
      )
    ).toBe(false);
  });

  it('partial scores never count as covering a required dimension', () => {
    const partial = {
      ...FULL_HUMAN,
      scores: [{ dimensionId: 'likeness', value: 3, partial: true }],
    };
    expect(
      trialNeedsReview(trial(400, { assessments: [partial] }) as never, [
        'likeness',
        'background',
      ])
    ).toBe(true);
    expect(
      trialNeedsReview(trial(400, { assessments: [FULL_HUMAN] }) as never, [
        'likeness',
        'background',
      ])
    ).toBe(false);
  });

  it('a trial with no outputs never needs review', () => {
    expect(
      trialNeedsReview(trial(400, { outputs: [] }) as never, undefined)
    ).toBe(false);
  });
});

describe('WbReviewScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDefaults();
  });

  it('queues experiments with per-row missing counts and a prominent total', async () => {
    render(<WbReviewScreen experimentId={31} />);
    const row = await screen.findByTestId('wb-review-queue-row');
    expect(row).toHaveTextContent('2x2 action/clothing screening');
    expect(row).toHaveTextContent('1 of 2');
    expect(screen.getByTestId('wb-review-missing-total')).toHaveTextContent(
      '1 trial awaiting human review'
    );
    expect(screen.getByTestId('wb-review-trial-label')).toHaveTextContent(
      'trial #400'
    );
  });

  it('locks scoring until the current images and references have loaded', async () => {
    let resolveMedia!: (v: unknown) => void;
    (wbClient.getMedia as jest.Mock).mockReturnValue(
      new Promise(resolve => {
        resolveMedia = resolve;
      })
    );
    render(<WbReviewScreen experimentId={31} />);
    await screen.findByTestId('wb-review-trial-label');
    const locked = screen.getByTestId('wb-review-scoring-locked');
    expect(locked).toHaveTextContent('still loading');
    expect(screen.queryByTestId('wb-review-verdict-accept')).toBeNull();
    act(() => {
      resolveMedia({
        data: { url: '/asset-21.svg', label: 'OUT', kind: 'output' },
      });
    });
    await screen.findByTestId('wb-review-verdict-accept');
    expect(screen.queryByTestId('wb-review-scoring-locked')).toBeNull();
  });

  it('refuses a reject without a note and saves an accept without one', async () => {
    (wbClient.getMedia as jest.Mock).mockResolvedValue({
      data: { url: '/asset-21.svg', label: 'OUT', kind: 'output' },
    });
    render(<WbReviewScreen experimentId={31} />);
    const accept = await screen.findByTestId('wb-review-verdict-accept');
    // Reject with no note is refused client-side.
    fireEvent.click(screen.getByTestId('wb-review-verdict-reject'));
    fireEvent.click(screen.getByTestId('wb-review-save'));
    expect(screen.getByTestId('wb-review-save-error')).toHaveTextContent(
      'Reject verdict requires feedback'
    );
    // Accept with no note is allowed and posts cleanly.
    fireEvent.click(accept);
    fireEvent.click(screen.getByTestId('wb-review-save'));
    await screen.findByTestId('wb-review-saved');
    const call = (wbAssessClient.recordAssessment as jest.Mock).mock
      .calls[0][0];
    expect(call.trialId).toBe(400);
    expect(call.assessment.outputSha256).toBe(SHA_A);
    expect(call.assessment.verdict).toBe('accept');
    expect(call.assessment.notes).toBeUndefined();
    expect(call.assessment.target).toBe('scene');
    expect(call.context.caseRevisionId).toBe(104);
  });

  it('keeps an in-flight save bound to the trial it was built for', async () => {
    let resolveSave!: (v: unknown) => void;
    const pending = new Promise<unknown>(resolve => {
      resolveSave = resolve;
    });
    (wbClient.getMedia as jest.Mock).mockResolvedValue({
      data: { url: '/asset-21.svg', label: 'OUT', kind: 'output' },
    });
    (wbAssessClient.recordAssessment as jest.Mock).mockReturnValue(pending);

    render(<WbReviewScreen experimentId={31} />);
    await screen.findByTestId('wb-review-verdict-accept');
    fireEvent.click(screen.getByTestId('wb-review-verdict-accept'));
    fireEvent.click(screen.getByTestId('wb-review-save'));
    expect(screen.getByTestId('wb-review-save')).toHaveTextContent('Saving…');

    // Navigate to the next trial while the save is in flight.
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    await waitFor(() =>
      expect(screen.getByTestId('wb-review-trial-label')).toHaveTextContent(
        'trial #401'
      )
    );

    act(() => {
      resolveSave({ created: true, assessment: { assessmentId: 1 } });
    });
    const stale = await screen.findByTestId('wb-review-stale-save');
    expect(stale).toHaveTextContent('did not touch the current item');
    const call = (wbAssessClient.recordAssessment as jest.Mock).mock
      .calls[0][0];
    expect(call.trialId).toBe(400);
    expect(call.assessment.outputSha256).toBe(SHA_A);
  });

  it('follows a deep-link change between experiments on the same mount', async () => {
    const expB = {
      ...EXPERIMENT,
      experimentId: 32,
      name: 'Clothing-only regression',
    };
    (wbClient.listExperiments as jest.Mock).mockResolvedValue({
      data: [EXPERIMENT, expB],
      nextCursor: null,
      hasMore: false,
    });
    const viewB = { ...makeView(), experimentId: 32, trials: [trial(500)] };
    (wbAssessClient.results as jest.Mock).mockImplementation((id: number) =>
      Promise.resolve(id === 32 ? viewB : makeView())
    );
    const { rerender } = render(<WbReviewScreen experimentId={31} />);
    const select = await screen.findByTestId('wb-review-experiment-filter');
    expect(select).toHaveValue('31');
    // Deep-link ?experiment=32 on the same mount must re-point the queue
    // and fetch that experiment's blind results.
    rerender(<WbReviewScreen experimentId={32} />);
    await waitFor(() => expect(select).toHaveValue('32'));
    expect(
      await screen.findByTestId('wb-review-trial-label')
    ).toHaveTextContent('trial #500');
    expect(wbAssessClient.results).toHaveBeenCalledWith(32, {
      revealed: false,
    });
  });
});


describe('self-review audit reproduction', () => {
  beforeEach(() => { jest.clearAllMocks(); mockDefaults(); });
  it('keeps scoring locked after metadata resolves but image pixels have not loaded', async () => {
    render(<WbReviewScreen experimentId={31} />);
    await screen.findByAltText('Output 1');
    expect(screen.queryByTestId('wb-review-verdict-accept')).toBeNull();
  });
  it('keeps scoring locked while the case reference inventory is unresolved', async () => {
    (wbClient.getRevision as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<WbReviewScreen experimentId={31} />);
    await screen.findByAltText('Output 1');
    expect(screen.queryByTestId('wb-review-verdict-accept')).toBeNull();
  });
  it('keeps a multi-output trial in the queue when only its first output was reviewed', () => {
    const t = trial(400, {
      outputs: [{ mediaAssetId: 21, sha256: SHA_A }, { mediaAssetId: 22, sha256: SHA_B }],
      assessments: [{ ...FULL_HUMAN, outputSha256: SHA_A }],
    });
    expect(trialNeedsReview(t as never, ['likeness', 'background'])).toBe(true);
  });
});
