/**
 * U05 — generic experiment planning and durable execution kernel tests.
 *
 * Proves with fake adapters and the in-memory fake store that:
 *  - all four stage kinds share the same planning/execution lifecycle;
 *  - preview reports compatibility, diffs, availability, counts, scope and cost;
 *  - start is transactional and idempotent;
 *  - claim/cancel/restart fencing discards in-flight writes;
 *  - exact-payload dedup is explicit-only and fail-closed;
 *  - model-unavailable / consent-missing fail closed (no hosted fallback);
 *  - ambiguous external submissions are preserved, never replayed;
 *  - legacy workers are isolated from workbench claims.
 */
import {
  createWbAdapterRegistry,
  type WbAdapterRegistry,
  type WbExecutedOutput,
  type WbExecutionResult,
  type WbPreparedPayload,
  type WbWorkbenchAdapter,
} from '@storybookmagic/shared/image-workbench-abi';
import type { WbStageInput } from '@storybookmagic/shared/image-workbench';
import {
  createWbCasePayload,
  createWbCharacterCreationInput,
  createWbCharacterViewsInput,
  createWbCreateExperimentRequest,
  createWbDatasetPayload,
  createWbEnvironmentInput,
  createWbMediaRef,
  createWbSceneInput,
  createWbWorkflowPayload,
  wbTestSha256,
} from '@storybookmagic/shared/image-workbench-factories';
import {
  createFakeWbStore,
  type FakeWbStore,
} from './image-workbench-fake-store';
import {
  createWbExperiment,
  wbContentHash,
  type WbStore,
} from '../image-workbench-store';
import { createWbExecutionKernel } from '../image-workbench-kernel';

type Stage = 'character-creation' | 'character-views' | 'environment' | 'scene';

/** A prepared payload whose hash is internally consistent. */
function validPrepared(
  prompt: string,
  imageRefs: WbPreparedPayload['imageRefs'] = [],
  settings: Record<string, unknown> = {}
): WbPreparedPayload {
  const base = { prompt, imageRefs, settings };
  return { ...base, payloadHash: wbContentHash(base) };
}

function makeAdapter(
  overrides: Partial<WbWorkbenchAdapter> = {}
): WbWorkbenchAdapter {
  const base: WbWorkbenchAdapter = {
    id: 'fixture-adapter',
    revision: 'r1',
    stages: ['character-views'],
    capabilities: {
      prepare: true,
      validate: true,
      execute: true,
      presentation: true,
    },
    resources: () => ({ pool: 'local-gpu', concurrency: 1 }),
    consent: () => ({ kind: 'none', recordIds: [] }),
    availability: () => ({ available: true }),
    prepare: async () => validPrepared('fixture prompt'),
    validate: async () => ({ ok: true, errors: [] }),
    execute: async () =>
      ({ outputs: [] as WbExecutedOutput[] }) satisfies WbExecutionResult,
    presentation: () => ({ title: 'Fixture adapter' }),
  };
  return { ...base, ...overrides } as WbWorkbenchAdapter;
}

function registryWithAdapters(
  adapters: Array<
    Partial<WbWorkbenchAdapter> & { id?: string; revision?: string }
  >
): WbAdapterRegistry {
  const registry = createWbAdapterRegistry();
  for (const a of adapters) registry.register(makeAdapter(a));
  return registry;
}

const inputForStage: Record<Stage, () => WbStageInput> = {
  'character-creation': createWbCharacterCreationInput,
  'character-views': createWbCharacterViewsInput,
  environment: createWbEnvironmentInput,
  scene: createWbSceneInput,
};

/**
 * Seed the frozen revisions + one experiment the kernel can run.
 * Optionally point the two workflow revisions at custom adapters
 * (used by the model-warm selection test).
 */
async function seedExperiment(
  fake: FakeWbStore,
  opts: {
    stage?: Stage;
    seeds?: number[];
    mediaAssetId?: number;
    workflowAdapters?: [string, string];
    requestId?: string;
  } = {}
) {
  const {
    stage = 'character-views',
    seeds = [0, 1009],
    mediaAssetId = 500,
  } = opts;
  const makeInput = inputForStage[stage];

  fake.seed.revision({
    id: 1,
    kind: 'case',
    subjectKey: 'case-1',
    payload: createWbCasePayload({ input: makeInput() }),
  });
  fake.seed.revision({
    id: 2,
    kind: 'case',
    subjectKey: 'case-2',
    payload: createWbCasePayload({ input: makeInput() }),
  });
  fake.seed.revision({
    id: 11,
    kind: 'dataset',
    subjectKey: 'dataset',
    payload: createWbDatasetPayload({ caseRevisionIds: [1, 2] }),
  });
  fake.seed.revision({
    id: 21,
    kind: 'workflow',
    subjectKey: 'wf-baseline',
    payload: createWbWorkflowPayload({
      stage,
      adapterId: opts.workflowAdapters?.[0] ?? 'fixture-adapter',
      config: {},
    }),
  });
  fake.seed.revision({
    id: 22,
    kind: 'workflow',
    subjectKey: 'wf-action',
    payload: createWbWorkflowPayload({
      stage,
      adapterId: opts.workflowAdapters?.[1] ?? 'fixture-adapter',
      config: { emphasis: 'action' },
    }),
  });

  const outSha = wbTestSha256(`out-${mediaAssetId}`);
  fake.seed.mediaAsset({
    id: mediaAssetId,
    sha256: outSha,
    url: `http://media/out-${mediaAssetId}.jpg`,
  });

  const store: WbStore = fake.toWbStore();
  const { experiment } = await createWbExperiment(store, {
    ...createWbCreateExperimentRequest({ seeds, requestId: opts.requestId }),
    requestedById: 1,
  });
  return {
    fake,
    store,
    experimentId: experiment.experimentId,
    outSha,
    mediaAssetId,
  };
}

function execOutputs(mediaAssetId: number): WbExecutedOutput[] {
  return [
    {
      mediaAssetId,
      sha256: wbTestSha256(`out-${mediaAssetId}`),
      outputIndex: 0,
      provenance: 'fresh',
    },
  ];
}

describe('U05 kernel: planning and preview', () => {
  it('resolves frozen cases/variants/seeds and reports counts, diffs, scope and cost', async () => {
    const fake = createFakeWbStore();
    const registry = registryWithAdapters([
      {
        stages: ['character-views'],
        prepare: async ctx =>
          validPrepared(`prompt ${JSON.stringify(ctx.workflow.config)}`, [
            { ...createWbMediaRef(1), role: 'source' },
          ]),
        consent: () => ({
          kind: 'character-photo-consent',
          recordIds: ['consent-abc'],
        }),
      },
    ]);
    const { store, experimentId } = await seedExperiment(fake, {
      mediaAssetId: 501,
    });
    const kernel = createWbExecutionKernel({ store, registry });

    const preview = await kernel.previewExperiment(experimentId);
    expect(preview.status).toBe('planned');
    expect(preview.counts.logicalTrials).toBe(8); // 2 cases x 2 variants x 2 seeds
    expect(preview.counts.physicalExecutions).toBe(8);
    expect(preview.counts.reusedTrials).toBe(0);
    expect(preview.availability.allAvailable).toBe(true);
    expect(preview.availability.blocked).toHaveLength(0);
    expect(preview.scope.hosted).toBe(false);
    expect(preview.scope.consentKinds).toContain('character-photo-consent');
    expect(preview.scope.consentRecordIds).toContain('consent-abc');
    expect(preview.cost).toEqual({ hosted: false });
    expect(preview.trials).toHaveLength(8);

    const controls = preview.trials.filter(t => t.variantLabel === 'baseline');
    const others = preview.trials.filter(t => t.variantLabel === 'action-only');
    for (const c of controls) {
      expect(c.controlPrepared).toBeNull();
      expect(c.differsFromControl).toBe(false);
    }
    for (const t of others) {
      expect(t.prepared?.prompt).not.toEqual(t.controlPrepared?.prompt);
      expect(t.differsFromControl).toBe(true);
    }
    for (const t of preview.trials) {
      if (t.prepared) {
        const base = {
          prompt: t.prepared.prompt,
          imageRefs: t.prepared.imageRefs,
          settings: t.prepared.settings,
        };
        expect(t.prepared.payloadHash).toBe(wbContentHash(base));
      }
    }
  });

  it('reports unregistered adapters as blocked (disabled), never a silent fallback', async () => {
    const fake = createFakeWbStore();
    const { store, experimentId } = await seedExperiment(fake);
    const kernel = createWbExecutionKernel({
      store,
      registry: createWbAdapterRegistry(),
    });

    const preview = await kernel.previewExperiment(experimentId);
    expect(preview.availability.allAvailable).toBe(false);
    expect(preview.availability.blocked).toHaveLength(1);
    expect(preview.availability.blocked[0]?.adapterId).toBe('fixture-adapter');
    expect(preview.availability.blocked[0]?.reason).toBe('disabled');
    for (const t of preview.trials) {
      expect(t.compatible).toBe(false);
      expect(t.available).toBe(false);
      expect(t.prepared).toBeNull();
    }
  });

  it('flags stage-incompatible cases as incompatible with a reason', async () => {
    const fake = createFakeWbStore();
    const registry = registryWithAdapters([{ stages: ['character-views'] }]);
    const { store, experimentId } = await seedExperiment(fake, {
      stage: 'character-creation',
    });
    const kernel = createWbExecutionKernel({ store, registry });

    const preview = await kernel.previewExperiment(experimentId);
    expect(preview.availability.allAvailable).toBe(false);
    expect(preview.availability.blocked).toHaveLength(1);
    expect(preview.availability.blocked[0]?.reason).toBe('incompatible-stage');
    expect(preview.trials[0]?.compatible).toBe(false);
    expect(preview.trials[0]?.incompatibleReason).toContain(
      "case stage 'character-creation'"
    );
  });
});

describe('U05 kernel: start is transactional and idempotent', () => {
  it('starts once: one queued execution per trial, replays are no-ops', async () => {
    const fake = createFakeWbStore();
    const { store, experimentId } = await seedExperiment(fake);
    const kernel = createWbExecutionKernel({
      store,
      registry: registryWithAdapters([]),
      workerIdentity: 'w-test',
    });

    const first = await kernel.startExperiment({ experimentId });
    expect(first.started).toBe(true);
    expect(first.executionsCreated).toBe(8);
    expect(first.trialsReused).toBe(0);

    const second = await kernel.startExperiment({ experimentId });
    expect(second.started).toBe(false);
    expect(second.executionsCreated).toBe(0);
    expect(fake.db.executions).toHaveLength(8);
    expect(fake.db.experiments[0]!.status).toBe('running');
    for (const e of fake.db.executions) {
      expect(e.status).toBe('queued');
      expect(e.provenance).toBe('fresh');
      expect(e.ordinal).toBe(1);
    }
  });

  it('refuses to start a canceled or finished experiment', async () => {
    const fake = createFakeWbStore();
    const { store, experimentId } = await seedExperiment(fake);
    const kernel = createWbExecutionKernel({
      store,
      registry: registryWithAdapters([]),
      workerIdentity: 'w-test',
    });
    await kernel.startExperiment({ experimentId });
    await kernel.cancelExperiment(experimentId);
    await expect(kernel.startExperiment({ experimentId })).rejects.toThrow(
      /canceled/
    );
  });
});

describe('U05 kernel: durable execution lifecycle (all four stages)', () => {
  it.each([
    'character-creation',
    'character-views',
    'environment',
    'scene',
  ] as const)(
    'runs a full %s experiment through the shared lifecycle',
    async stage => {
      const fake = createFakeWbStore();
      const registry = registryWithAdapters([
        {
          stages: [stage],
          prepare: async ctx =>
            validPrepared(
              `${stage} prompt`,
              [{ ...createWbMediaRef(1), role: 'source' }],
              { stage }
            ),
          execute: async () => ({ outputs: execOutputs(600), durationMs: 123 }),
        },
      ]);
      const { store, experimentId, outSha } = await seedExperiment(fake, {
        stage,
        seeds: [0],
        mediaAssetId: 600,
      });
      const kernel = createWbExecutionKernel({
        store,
        registry,
        pools: [{ pool: 'local-gpu', concurrency: 4 }],
        workerIdentity: 'w-test',
      });
      await kernel.startExperiment({ experimentId });

      let claimed = 0;
      while ((await kernel.pollAndRunOne()) !== null) claimed += 1;
      expect(claimed).toBe(4); // 2 cases x 2 variants x 1 seed
      await kernel.settleInFlight();

      expect(fake.db.trials.every(t => t.status === 'succeeded')).toBe(true);
      expect(fake.db.experiments[0]!.status).toBe('finished');
      expect(fake.db.outputBindings).toHaveLength(4);
      for (const b of fake.db.outputBindings) {
        expect(b.sha256).toBe(outSha);
        expect(b.provenance).toBe('fresh');
      }
      const progress = await kernel.getProgress(experimentId);
      expect(progress.status).toBe('finished');
      expect(progress.trialCounts.succeeded).toBe(4);
      expect(progress.trialCounts.planned).toBe(0);
      expect(progress.executionCounts.succeeded).toBe(4);
      expect(progress.executionCounts.queued).toBe(0);
    }
  );
});

describe('U05 kernel: claim/cancel/restart fencing', () => {
  it('cancels queued work, fences in-flight claims; the stale writer is discarded', async () => {
    let releaseExecute!: () => void;
    const gate = new Promise<void>(res => {
      releaseExecute = () => res();
    });
    const fake = createFakeWbStore();
    const registry = registryWithAdapters([
      {
        execute: async () => {
          await gate;
          return { outputs: execOutputs(700) };
        },
      },
    ]);
    const { store, experimentId } = await seedExperiment(fake, {
      seeds: [0],
      mediaAssetId: 700,
    });
    const kernel = createWbExecutionKernel({
      store,
      registry,
      workerIdentity: 'w-a',
    });
    await kernel.startExperiment({ experimentId });

    const claimedId = await kernel.pollAndRunOne();
    expect(claimedId).not.toBeNull();
    // Flush microtasks so the fire-and-forget run reaches 'running'.
    await new Promise(r => setTimeout(r, 0));
    const exec = fake.db.executions.find(e => e.id === claimedId)!;
    expect(exec.status).toBe('running');
    expect(exec.claimWorkerId).toBe('w-a');
    expect(exec.fencingToken).toBe(1);

    const cancel = await kernel.cancelExperiment(experimentId);
    expect(cancel.fencedInFlight).toBe(1);
    expect(cancel.canceledQueued).toBe(3); // 4 trials - 1 in flight
    expect(cancel.trialsCanceled).toBe(4);
    expect(fake.db.experiments[0]!.status).toBe('canceled');
    expect(fake.db.trials.every(t => t.status === 'canceled')).toBe(true);

    // The in-flight worker finally gets its result; its terminal CAS now
    // matches zero rows (fencing token advanced) and must be discarded.
    releaseExecute();
    await kernel.settleInFlight();

    expect(exec.status).toBe('canceled'); // recovery final form, not the stale write
    expect(fake.db.outputBindings).toHaveLength(0); // no leaked binding

    // Recovery sweep of any still-in-flight fenced row is a no-op here
    // because cancel already fenced; a forced stale row would finalize.
    exec.status = 'running'; // simulate a claim that outlived the fence
    const recovered = await kernel.recoverExpiredClaims();
    expect(recovered).toBe(1);
    expect(exec.status).toBe('canceled'); // experiment was canceled

    // A stale generation's claim CAS can never grab the row back.
    const staleClaim = await store.wbExecution.updateMany({
      where: {
        id: Number(exec.id),
        status: 'queued',
        fencingToken: 0,
        claimWorkerId: null,
      },
      data: { status: 'claimed', claimWorkerId: 'legacy-worker' },
    });
    expect(staleClaim.count).toBe(0);
  });

  it('a second worker cannot steal a live claim; stale-token writes are refused', async () => {
    let releaseExecute!: () => void;
    const gate = new Promise<void>(res => {
      releaseExecute = () => res();
    });
    const fake = createFakeWbStore();
    const registry = registryWithAdapters([
      {
        execute: async () => {
          await gate;
          return { outputs: [] };
        },
      },
    ]);
    const { store, experimentId } = await seedExperiment(fake, { seeds: [0] });
    const kernelA = createWbExecutionKernel({
      store,
      registry,
      workerIdentity: 'w-A',
    });
    await kernelA.startExperiment({ experimentId });
    const claimed = await kernelA.pollAndRunOne();
    expect(claimed).not.toBeNull();

    const kernelB = createWbExecutionKernel({
      store,
      registry,
      workerIdentity: 'w-B',
    });
    const stolen = await kernelB.pollAndRunOne();
    expect(stolen).toBeNull();

    releaseExecute();
    await kernelA.settleInFlight();
    const exec = fake.db.executions.find(e => e.id === claimed)!;
    expect(exec.status).toBe('succeeded');
    // A restarted/legacy owner writing with a pre-claim token matches nothing.
    const staleWrite = await store.wbExecution.updateMany({
      where: {
        id: Number(exec.id),
        fencingToken: 0,
        claimWorkerId: 'w-B',
        status: { in: ['claimed', 'running'] },
      },
      data: { status: 'succeeded' },
    });
    expect(staleWrite.count).toBe(0);
  });
});

describe('U05 kernel: exact-payload dedup is explicit-only', () => {
  it('shares identical-payload succeeded executions via explicitShares (no new runs)', async () => {
    const fake = createFakeWbStore();
    const registry = registryWithAdapters([{}]);
    const { store, experimentId } = await seedExperiment(fake, {
      seeds: [0],
      mediaAssetId: 800,
    });
    const kernel = createWbExecutionKernel({
      store,
      registry,
      pools: [{ pool: 'local-gpu', concurrency: 4 }],
      workerIdentity: 'w-a',
    });
    await kernel.startExperiment({ experimentId });
    while ((await kernel.pollAndRunOne()) !== null) {
      // drain experiment A to completion
    }
    await kernel.settleInFlight();
    expect(fake.db.executions.every(e => e.status === 'succeeded')).toBe(true);

    // Experiment B: same dataset/variants/seeds -> identical payloadHashes.
    const created = await createWbExperiment(store, {
      ...createWbCreateExperimentRequest({
        requestId: '00000000-0000-4000-9000-0000000000b2',
        seeds: [0],
      }),
      requestedById: 1,
    });
    const expB = created.experiment.experimentId;
    const trialsA = fake.db.trials.filter(t => t.experimentId === experimentId);
    const trialsB = fake.db.trials.filter(t => t.experimentId === expB);
    expect(trialsB).toHaveLength(trialsA.length);
    const shares = trialsB.map((tb, i) => {
      const ta = trialsA[i]!;
      expect(tb.payloadHash).toBe(ta.payloadHash); // identical by construction
      const execA = fake.db.executions.find(e => e.trialId === ta.id)!;
      expect(execA.status).toBe('succeeded');
      return { trialId: Number(tb.id), executionId: Number(execA.id) };
    });

    const startB = await kernel.startExperiment({
      experimentId: expB,
      explicitShares: shares,
    });
    expect(startB.started).toBe(true);
    expect(startB.trialsReused).toBe(shares.length);
    expect(startB.executionsCreated).toBe(0);
    for (const t of trialsB) {
      expect(t.status).toBe('reused');
      expect(typeof (t.reusedExecutionId as number)).toBe('number');
    }
    expect(fake.db.executions).toHaveLength(trialsA.length); // nothing new
  });

  it('rejects shares to failed targets, mismatched hashes, or own-trial executions', async () => {
    const fake = createFakeWbStore();
    const registry = registryWithAdapters([]);
    const { store } = await seedExperiment(fake, { seeds: [0] });
    const kernel = createWbExecutionKernel({
      store,
      registry,
      workerIdentity: 'w-b',
    });

    // Fresh planned experiment B; its trials are the share subjects.
    const created = await createWbExperiment(store, {
      ...createWbCreateExperimentRequest({
        requestId: '00000000-0000-4000-9000-0000000000b3',
      }),
      requestedById: 1,
    });
    const expB = created.experiment.experimentId;
    const trialsB = fake.db.trials.filter(t => t.experimentId === expB);
    const otherTrial = trialsB[1]!;

    // Failed target execution.
    fake.db.executions.push({
      trialId: Number(otherTrial.id),
      experimentId: expB,
      ordinal: 9,
      status: 'failed',
      adapterId: 'fixture-adapter',
      payloadHash: otherTrial.payloadHash as string,
      provenance: 'fresh',
      claimWorkerId: null,
      claimGeneration: null,
      fencingToken: 0,
      claimExpiresAt: null,
      result: null,
      error: 'boom',
      startedAt: null,
      finishedAt: null,
      id: 900,
    } as never);
    await expect(
      kernel.startExperiment({
        experimentId: expB,
        explicitShares: [{ trialId: Number(otherTrial.id), executionId: 900 }],
      })
    ).rejects.toThrow(/must be succeeded/);

    // Mismatched payload hash (succeeded, other trial, different payload).
    fake.db.executions.push({
      trialId: Number(trialsB[0]!.id),
      experimentId: expB,
      ordinal: 9,
      status: 'succeeded',
      adapterId: 'fixture-adapter',
      payloadHash: 'f'.repeat(64),
      provenance: 'fresh',
      claimWorkerId: null,
      claimGeneration: null,
      fencingToken: 0,
      claimExpiresAt: null,
      result: null,
      error: null,
      startedAt: null,
      finishedAt: null,
      id: 901,
    } as never);
    await expect(
      kernel.startExperiment({
        experimentId: expB,
        explicitShares: [{ trialId: Number(otherTrial.id), executionId: 901 }],
      })
    ).rejects.toThrow(/payloadHash/);

    // Sharing a trial's own execution is not a share.
    fake.db.executions.push({
      trialId: Number(trialsB[0]!.id),
      experimentId: expB,
      ordinal: 9,
      status: 'succeeded',
      adapterId: 'fixture-adapter',
      payloadHash: trialsB[0]!.payloadHash as string,
      provenance: 'fresh',
      claimWorkerId: null,
      claimGeneration: null,
      fencingToken: 0,
      claimExpiresAt: null,
      result: null,
      error: null,
      startedAt: null,
      finishedAt: null,
      id: 902,
    } as never);
    await expect(
      kernel.startExperiment({
        experimentId: expB,
        explicitShares: [{ trialId: Number(trialsB[0]!.id), executionId: 902 }],
      })
    ).rejects.toThrow(/different trial/);

    // All rejected before any mutation: B still planned, no new executions.
    expect(fake.db.experiments.find(e => e.id === expB)!.status).toBe(
      'planned'
    );
    expect(
      fake.db.executions.filter(
        e => e.experimentId === expB && (e.id as number) < 900
      )
    ).toHaveLength(0);
  });

  it('fresh runs never reference previous executions silently', async () => {
    const fake = createFakeWbStore();
    const registry = registryWithAdapters([]);
    const { store, experimentId } = await seedExperiment(fake, {
      seeds: [0],
      mediaAssetId: 810,
    });
    const kernel = createWbExecutionKernel({
      store,
      registry,
      workerIdentity: 'w-a',
    });
    const res = await kernel.startExperiment({ experimentId }); // no shares
    expect(res.trialsReused).toBe(0);
    for (const e of fake.db.executions) {
      expect(e.provenance).toBe('fresh');
    }
    for (const t of fake.db.trials) {
      expect(t.reusedExecutionId).toBeNull();
      expect(t.status).toBe('running');
    }
  });
});

describe('U05 kernel: fail-closed availability', () => {
  it('model-unavailable executions fail closed with a recorded error', async () => {
    const fake = createFakeWbStore();
    const registry = registryWithAdapters([
      {
        availability: () => ({ available: false, reason: 'model-unavailable' }),
      },
    ]);
    const { store, experimentId } = await seedExperiment(fake, { seeds: [0] });
    const kernel = createWbExecutionKernel({
      store,
      registry,
      pools: [{ pool: 'local-gpu', concurrency: 4 }],
      workerIdentity: 'w-a',
    });
    await kernel.startExperiment({ experimentId });
    while ((await kernel.pollAndRunOne()) !== null) {
      // drain
    }
    await kernel.settleInFlight();
    expect(fake.db.executions.every(e => e.status === 'failed')).toBe(true);
    for (const e of fake.db.executions)
      expect(e.error).toBe('model-unavailable');
    expect(fake.db.experiments[0]!.status).toBe('finished');
    expect(fake.db.outputBindings).toHaveLength(0);
  });

  it('consent-missing availability fails closed the same way', async () => {
    const fake = createFakeWbStore();
    const registry = registryWithAdapters([
      {
        consent: () => ({
          kind: 'hosted-operation',
          recordIds: ['missing-consent'],
        }),
        availability: () => ({ available: false, reason: 'consent-missing' }),
      },
    ]);
    const { store, experimentId } = await seedExperiment(fake, { seeds: [0] });
    const kernel = createWbExecutionKernel({
      store,
      registry,
      pools: [{ pool: 'local-gpu', concurrency: 4 }],
      workerIdentity: 'w-a',
    });
    await kernel.startExperiment({ experimentId });
    while ((await kernel.pollAndRunOne()) !== null) {
      // drain
    }
    await kernel.settleInFlight();
    expect(fake.db.executions.every(e => e.status === 'failed')).toBe(true);
    for (const e of fake.db.executions) expect(e.error).toBe('consent-missing');
  });
});

describe('U05 kernel: adapter-unregistered fails closed at execution time', () => {
  it('stays queued while unregistered; a stale claim records the actionable code', async () => {
    const fake = createFakeWbStore();
    const { store, experimentId } = await seedExperiment(fake, { seeds: [0] });
    const kernel = createWbExecutionKernel({
      store,
      registry: createWbAdapterRegistry(), // 'fixture-adapter' not registered
      workerIdentity: 'w-x',
    });
    await kernel.startExperiment({ experimentId });
    // Unresolvable rows are never claimed: the poller leaves them queued.
    expect(await kernel.pollAndRunOne()).toBeNull();

    // A claim that outlived the registration (recovered / foreign owner)
    // fails closed with the actionable code, not a bare context error.
    const exec = fake.db.executions[0]!;
    const claimed = await store.wbExecution.updateMany({
      where: { id: Number(exec.id), status: 'queued' },
      data: {
        status: 'claimed',
        claimWorkerId: 'w-x',
        claimGeneration: 1,
        fencingToken: 1,
        claimExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    expect(claimed.count).toBe(1);
    await kernel.runExecution(Number(exec.id));
    expect(exec.status).toBe('failed');
    expect(exec.error).toBe(
      'adapter-unregistered: fixture-adapter@r1 is not in the registry — no fallback'
    );
  });
});

describe('U05 kernel: ambiguous submissions are preserved, never replayed', () => {
  it('an uncertain result becomes a preserved submission-ambiguous failure', async () => {
    const fake = createFakeWbStore();
    const registry = registryWithAdapters([
      {
        execute: async () => ({
          outputs: [] as WbExecutedOutput[],
          uncertain: true,
        }),
      },
    ]);
    const { store, experimentId } = await seedExperiment(fake, { seeds: [0] });
    const kernel = createWbExecutionKernel({
      store,
      registry,
      pools: [{ pool: 'local-gpu', concurrency: 4 }],
      workerIdentity: 'w-a',
    });
    await kernel.startExperiment({ experimentId });
    while ((await kernel.pollAndRunOne()) !== null) {
      // drain
    }
    await kernel.settleInFlight();
    for (const e of fake.db.executions) {
      expect(e.status).toBe('failed');
      expect(e.error).toBe('submission-ambiguous');
      const resultJson = e.result as {
        uncertain?: boolean;
        outputs?: unknown[];
      };
      expect(resultJson.uncertain).toBe(true);
    }
    expect(fake.db.trials.every(t => t.status === 'failed')).toBe(true);

    // Nothing is re-queued: the sweep finds no in-flight rows, and no new
    // executions appear. Retrying means a new experiment or explicit share.
    const recovered = await kernel.recoverExpiredClaims();
    expect(recovered).toBe(0);
    expect(fake.db.executions).toHaveLength(4);
    await expect(kernel.startExperiment({ experimentId })).rejects.toThrow(
      /finished/
    );
  });
});

describe('U05 kernel: model-warm selection and legacy isolation', () => {
  it('prefers the warm adapter when a model-warm pool has capacity', async () => {
    const fake = createFakeWbStore();
    // baseline -> warm-a, action-only -> warm-b; two seeds -> order A,B,A,B.
    const registry = registryWithAdapters([
      { id: 'warm-a', stages: ['character-views'] },
      { id: 'warm-b', stages: ['character-views'] },
    ]);
    const { store, experimentId } = await seedExperiment(fake, {
      seeds: [0, 1],
      workflowAdapters: ['warm-a', 'warm-b'],
    });
    const kernel = createWbExecutionKernel({
      store,
      registry,
      pools: [{ pool: 'local-gpu', concurrency: 2, modelWarm: true }],
      workerIdentity: 'w-a',
    });
    await kernel.startExperiment({ experimentId });

    const byTrial = (id: number | null) =>
      fake.db.executions.find(e => e.id === id)!;
    const first = await kernel.pollAndRunOne();
    expect(byTrial(first)?.adapterId).toBe('warm-a'); // FIFO; nothing warm yet
    await kernel.settleInFlight(); // warm-a now recorded warm for this pool
    const second = await kernel.pollAndRunOne();
    // warm-a just succeeded: despite FIFO, the warm adapter is picked next.
    expect(byTrial(second)?.adapterId).toBe('warm-a');
  });

  it('passes taskNamespace=workbench to adapters; legacy claims cannot take workbench rows', async () => {
    const seen: string[] = [];
    const fake = createFakeWbStore();
    const registry = registryWithAdapters([
      {
        execute: async (_payload, env) => {
          seen.push(env.taskNamespace);
          return { outputs: [] };
        },
      },
    ]);
    const { store, experimentId } = await seedExperiment(fake, { seeds: [0] });
    const kernel = createWbExecutionKernel({
      store,
      registry,
      pools: [{ pool: 'local-gpu', concurrency: 4 }],
      workerIdentity: 'w-a',
    });
    await kernel.startExperiment({ experimentId });
    while ((await kernel.pollAndRunOne()) !== null) {
      // drain
    }
    await kernel.settleInFlight();
    expect(seen).toEqual(['workbench', 'workbench', 'workbench', 'workbench']);

    // A legacy worker's claim CAS (stale token, unknown owner) matches no row.
    const legacyClaim = await store.wbExecution.updateMany({
      where: { experimentId, status: 'queued', claimWorkerId: 'legacy-runner' },
      data: { status: 'claimed' },
    });
    expect(legacyClaim.count).toBe(0);
  });
});

describe('U05 kernel: recovery of stale claims', () => {
  it('finalizes stale in-flight claims: canceled exp -> canceled, running exp -> ambiguous failure', async () => {
    const fake = createFakeWbStore();
    const registry = registryWithAdapters([]);
    const { store, experimentId } = await seedExperiment(fake, { seeds: [0] });
    const kernel = createWbExecutionKernel({
      store,
      registry,
      workerIdentity: 'w-recover',
    });

    await kernel.startExperiment({ experimentId });
    const exec = fake.db.executions[0]!;
    exec.status = 'claimed';
    exec.claimWorkerId = 'dead-worker';
    exec.claimGeneration = 1;
    exec.fencingToken = 1;
    exec.claimExpiresAt = new Date(Date.now() - 60_000); // expired

    const recovered = await kernel.recoverExpiredClaims();
    expect(recovered).toBe(1);
    expect(exec.status).toBe('failed');
    expect(exec.error).toBe('submission-ambiguous');
  });

  it('canceled experiments finalize their fenced claims as canceled', async () => {
    const fake = createFakeWbStore();
    const registry = registryWithAdapters([]);
    const { store, experimentId } = await seedExperiment(fake, { seeds: [0] });
    const kernel = createWbExecutionKernel({
      store,
      registry,
      workerIdentity: 'w-recover',
    });
    await kernel.startExperiment({ experimentId });
    await kernel.cancelExperiment(experimentId);
    const exec = fake.db.executions[0]!;
    exec.status = 'running'; // simulate a claim that outlived the cancel fence
    exec.claimWorkerId = null;
    exec.claimExpiresAt = new Date(Date.now() - 1000);

    const recovered = await kernel.recoverExpiredClaims();
    expect(recovered).toBe(1);
    expect(exec.status).toBe('canceled');
    expect(fake.db.trials.every(t => t.status === 'canceled')).toBe(true);
    expect(fake.db.experiments[0]!.status).toBe('canceled');
  });
});

describe('U05 kernel: cancel of planned work and progress snapshot', () => {
  it('cancel on a planned experiment cancels trials without touching executions', async () => {
    const fake = createFakeWbStore();
    const { store, experimentId } = await seedExperiment(fake);
    const kernel = createWbExecutionKernel({
      store,
      registry: registryWithAdapters([]),
      workerIdentity: 'w-a',
    });
    const res = await kernel.cancelExperiment(experimentId);
    expect(res.canceledQueued).toBe(0);
    expect(res.trialsCanceled).toBe(8);
    expect(res.fencedInFlight).toBe(0);
    expect(fake.db.experiments[0]!.status).toBe('canceled');
    expect(fake.db.executions).toHaveLength(0);
  });

  it('progress reports zero-filled counts across all known statuses', async () => {
    const fake = createFakeWbStore();
    const { store, experimentId } = await seedExperiment(fake);
    const kernel = createWbExecutionKernel({
      store,
      registry: createWbAdapterRegistry(),
    });
    const p = await kernel.getProgress(experimentId);
    expect(p.status).toBe('planned');
    for (const s of [
      'planned',
      'reused',
      'running',
      'succeeded',
      'failed',
      'canceled',
    ]) {
      expect(typeof p.trialCounts[s]).toBe('number');
    }
    expect(p.trialCounts.planned).toBe(8);
    for (const s of [
      'queued',
      'claimed',
      'running',
      'succeeded',
      'failed',
      'canceled',
    ]) {
      expect(typeof p.executionCounts[s]).toBe('number');
    }
    expect(p.executionCounts.queued).toBe(0);
  });

  it('throws not-found for a missing experiment', async () => {
    const fake = createFakeWbStore();
    const kernel = createWbExecutionKernel({
      store: fake.toWbStore(),
      registry: createWbAdapterRegistry(),
    });
    await expect(kernel.getProgress(999)).rejects.toThrow(/not found/);
    await expect(kernel.previewExperiment(999)).rejects.toThrow(/not found/);
  });

  it('refuses scheduler entry points without a worker identity', async () => {
    const fake = createFakeWbStore();
    const kernel = createWbExecutionKernel({
      store: fake.toWbStore(),
      registry: createWbAdapterRegistry(),
    });
    await expect(kernel.pollAndRunOne()).rejects.toThrow(/workerIdentity/);
    await expect(kernel.recoverExpiredClaims()).rejects.toThrow(
      /workerIdentity/
    );
  });
});


describe('U05 review blockers', () => {
  it('passes the per-trial seed to the adapter', async () => {
    const fake = createFakeWbStore();
    const {store, experimentId} = await seedExperiment(fake, {seeds: [17, 29]});
    const seen: unknown[] = [];
    const registry = registryWithAdapters([{prepare: async ctx => {
      seen.push((ctx as unknown as {seed?: number}).seed);
      return validPrepared('prompt');
    }}]);
    const kernel = createWbExecutionKernel({store, registry});
    await kernel.previewExperiment(experimentId);
    expect(new Set(seen)).toEqual(new Set([17, 29]));
  });

  it('executes the payload shown in the pre-start preview', async () => {
    const fake = createFakeWbStore();
    const {store, experimentId} = await seedExperiment(fake, {seeds: [17]});
    let prompt = 'reviewed prompt';
    const executed: string[] = [];
    const registry = registryWithAdapters([{
      prepare: async () => validPrepared(prompt),
      execute: async payload => { executed.push(payload.prompt); return {outputs: []}; }
    }]);
    const kernel = createWbExecutionKernel({store, registry, workerIdentity: 'review'});
    const preview = await kernel.previewExperiment(experimentId);
    await kernel.startExperiment({experimentId});
    prompt = 'unreviewed replacement';
    await kernel.pollAndRunOne();
    await kernel.settleInFlight();
    expect(executed).toEqual([preview.trials[0]!.prepared!.prompt]);
  });

  it('reserves the single GPU atomically across concurrent schedulers', async () => {
    const fake = createFakeWbStore();
    const {store, experimentId} = await seedExperiment(fake, {seeds: [17]});
    let release!: () => void;
    const pending = new Promise<void>(resolve => {release = resolve;});
    const registry = registryWithAdapters([{execute: async () => {await pending; return {outputs: []};}}]);
    const first = createWbExecutionKernel({store, registry, workerIdentity: 'one'});
    const second = createWbExecutionKernel({store, registry, workerIdentity: 'two'});
    await first.startExperiment({experimentId});
    // Give each scheduler a distinct first candidate while both see an empty pool.
    // This is the interleaving when another claimant wins the first row of a stale scan.
    const original = store.wbExecution.findMany.bind(store.wbExecution);
    let scans = 0;
    store.wbExecution.findMany = (async (args: any) => {
      const rows = await original(args);
      if (args?.where?.status === 'queued' && ++scans === 2) return rows.slice(1);
      return rows;
    }) as typeof store.wbExecution.findMany;
    let claims: Array<number | null>;
    try {claims = await Promise.all([first.pollAndRunOne(), second.pollAndRunOne()]);}
    finally {release(); await Promise.all([first.settleInFlight(), second.settleInFlight()]);}
    expect(claims!.filter(id => id !== null)).toHaveLength(1);
  });

  it('keeps the GPU occupied after cancellation until the physical run stops', async () => {
    const fake = createFakeWbStore();
    const {store, experimentId} = await seedExperiment(fake, {seeds: [17]});
    let release!: () => void;
    let entered!: () => void;
    const pending = new Promise<void>(resolve => {release = resolve;});
    const started = new Promise<void>(resolve => {entered = resolve;});
    const registry = registryWithAdapters([{execute: async () => {entered(); await pending; return {outputs: []};}}]);
    const kernel = createWbExecutionKernel({store, registry, workerIdentity: 'review'});
    await kernel.startExperiment({experimentId});
    await kernel.pollAndRunOne();
    await started;
    await kernel.cancelExperiment(experimentId);
    // Create a second experiment over the same immutable revisions while GPU call one is alive.
    const next = await createWbExperiment(store, {
      ...createWbCreateExperimentRequest({seeds: [17], requestId: '11111111-1111-4111-8111-111111111119'}), requestedById: 1
    });
    await kernel.startExperiment({experimentId: next.experiment.experimentId});
    let claimed: number | null;
    try {claimed = await kernel.pollAndRunOne();}
    finally {release(); await kernel.settleInFlight();}
    expect(claimed!).toBeNull();
  });
});
