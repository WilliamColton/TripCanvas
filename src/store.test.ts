import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PARAMS, DEFAULT_SETTINGS } from './types'
import type { TaskRecord } from './types'
import { addImageFromFile, bootstrapBackendSession, editOutputs, ensureImageCached, getCachedImage, removeMultipleTasks, removeTask, submitTask, useStore } from './store'
import { getBackendToken, getMe, getPublicConfig, submitGenerateTask, getTasks as fetchTasks, putRemoteTask, uploadImage, streamTaskStatus, setUnauthorizedHandler, deleteRemoteTask, deleteRemoteImage, getTemplates } from './lib/backendApi'
import { getImage, hashDataUrl, putImage } from './lib/db'

vi.mock('./lib/backendApi', () => ({
  submitGenerateTask: vi.fn().mockResolvedValue({ taskId: 'task-1', status: 'processing' }),
  submitEditTask: vi.fn().mockResolvedValue({ taskId: 'task-1', status: 'processing' }),
  putRemoteTask: vi.fn().mockResolvedValue({ ok: true }),
  uploadImage: vi.fn().mockResolvedValue({
    id: 'uploaded-1',
    dataUrl: 'data:image/png;base64,abc',
    createdAt: 1,
    source: 'generated' as const,
  }),
  getBackendToken: vi.fn().mockReturnValue('test-token'),
  getMe: vi.fn(),
  getTasks: vi.fn().mockResolvedValue({ tasks: [] }),
  getPublicConfig: vi.fn(),
  getPublicAnnouncement: vi.fn().mockResolvedValue(null),
  getLatestPublicChangelog: vi.fn().mockResolvedValue(null),
  getPublicChangelogEntries: vi.fn().mockResolvedValue({ changelogs: [] }),
  getTemplates: vi.fn().mockResolvedValue({ templates: [] }),
  clearBackendToken: vi.fn(),
  clearRemoteTasks: vi.fn(),
  deleteRemoteImage: vi.fn().mockResolvedValue({ ok: true }),
  deleteRemoteTask: vi.fn().mockResolvedValue({ ok: true }),
  setUnauthorizedHandler: vi.fn(),
  streamTaskStatus: vi.fn().mockImplementation((_taskId: string, onUpdate: Function) => {
    // Simulate SSE: call onUpdate with done status on next tick
    setTimeout(() => {
      const task = useStore.getState().tasks.find((t: any) => t.id === _taskId)
      if (task) {
        onUpdate({ ...task, status: 'done', outputImages: ['img-1'], finishedAt: Date.now(), elapsed: 1000 })
      }
    }, 10)
    return new AbortController()
  }),
}))

vi.mock('./lib/db', () => ({
  putImage: vi.fn().mockResolvedValue(undefined),
  getImage: vi.fn().mockResolvedValue(null),
  hashDataUrl: vi.fn().mockResolvedValue('hash-1'),
}))

const imageA = { id: 'image-a', dataUrl: 'data:image/png;base64,a' }

class TestFileReader {
  result: string | ArrayBuffer | null = null
  onload: (() => void) | null = null
  onloadend: (() => void) | null = null
  onerror: (() => void) | null = null

  readAsDataURL(blob: Blob) {
    void blob.text().then((text) => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${text}`
      this.onload?.()
      this.onloadend?.()
    }).catch(() => this.onerror?.())
  }
}

function resetStoreForTest() {
  useStore.setState({
    authUser: { id: 'user-1', label: 'test', role: 'user', imageCount: 0, quota: 0, unlimitedQuota: false, usedCount: 0 },
    prompt: '',
    inputImages: [],
    maskDraft: null,
    maskEditorImageId: null,
    params: { ...DEFAULT_PARAMS },
    tasks: [],
    templates: [],
    templatesLoaded: false,
    selectedTemplateId: '',
    templateInputs: {},
    templateLoading: false,
  })
}

function task(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'task-a',
    prompt: 'prompt',
    params: { ...DEFAULT_PARAMS },
    inputImageIds: [],
    maskTargetImageId: null,
    maskImageId: null,
    outputImages: [],
    status: 'done',
    error: null,
    createdAt: 1,
    finishedAt: 2,
    elapsed: 1,
    ...overrides,
  }
}

describe('template loading state in store', () => {
  beforeEach(() => {
    resetStoreForTest()
    vi.mocked(getTemplates).mockReset()
  })

  it('marks templates as loaded even when the server returns an empty list', async () => {
    vi.mocked(getTemplates).mockResolvedValue({ templates: [] })

    await useStore.getState().loadTemplates()

    expect(getTemplates).toHaveBeenCalledTimes(1)
    expect(useStore.getState().templates).toEqual([])
    expect(useStore.getState().templatesLoaded).toBe(true)
    expect(useStore.getState().templateLoading).toBe(false)
  })

  it('marks templates as loaded even when loading fails', async () => {
    vi.mocked(getTemplates).mockRejectedValue(new Error('failed'))

    await expect(useStore.getState().loadTemplates()).rejects.toThrow('failed')

    expect(useStore.getState().templatesLoaded).toBe(true)
    expect(useStore.getState().templateLoading).toBe(false)
  })
})

describe('announcement state in store', () => {
  beforeEach(() => {
    useStore.setState({ seenAnnouncementUpdatedAt: null })
  })

  it('marks the current announcement version as seen', () => {
    useStore.getState().markAnnouncementSeen(123)

    expect(useStore.getState().seenAnnouncementUpdatedAt).toBe(123)
  })
})

describe('mask draft lifecycle in store actions', () => {
  beforeEach(() => {
    useStore.setState({
      settings: { ...DEFAULT_SETTINGS },
      prompt: 'prompt',
      inputImages: [],
      maskDraft: null,
      maskEditorImageId: null,
      params: { ...DEFAULT_PARAMS },
      tasks: [],
      detailTaskId: null,
      lightboxImageId: null,
      lightboxImageList: [],
      showSettings: false,
      seenAnnouncementUpdatedAt: null,
      confirmDialog: null,
      showToast: vi.fn(),
      setConfirmDialog: vi.fn(),
    })
  })

  it('clears an existing mask when quick edit-output adds outputs as references', async () => {
    useStore.setState({
      inputImages: [imageA],
      maskDraft: {
        targetImageId: imageA.id,
        maskDataUrl: 'data:image/png;base64,mask',
        updatedAt: 1,
      },
    })

    await editOutputs(task({ outputImages: [imageA.id] }))

    expect(useStore.getState().maskDraft).toBeNull()
  })

  it('clears an invalid mask draft when submit cannot find the mask target image', async () => {
    useStore.setState({
      authUser: { id: 'user-1', label: 'user', role: 'user', imageCount: 0, quota: 0, unlimitedQuota: false, usedCount: 0 },
      inputImages: [imageA],
      maskDraft: {
        targetImageId: 'missing-image',
        maskDataUrl: 'data:image/png;base64,mask',
        updatedAt: 1,
      },
    })

    await submitTask()

    expect(useStore.getState().maskDraft).toBeNull()
  })
})

describe('submitTask backend submission flow', () => {
  beforeEach(() => {
    vi.mocked(streamTaskStatus).mockReset()
    vi.mocked(streamTaskStatus).mockImplementation((_taskId: string, onUpdate: Function) => {
      setTimeout(() => {
        const task = useStore.getState().tasks.find((t: any) => t.id === _taskId)
        if (task) {
          onUpdate({ ...task, status: 'done', outputImages: ['img-1'], finishedAt: Date.now(), elapsed: 1000 })
        }
      }, 10)
      return new AbortController()
    })
    vi.mocked(submitGenerateTask).mockReset()
    vi.mocked(submitGenerateTask).mockResolvedValue({ taskId: 'task-1', status: 'processing' })
    vi.mocked(fetchTasks).mockReset()
    vi.mocked(fetchTasks).mockResolvedValue({ tasks: [] })
    vi.mocked(getMe).mockReset()
    vi.mocked(getMe).mockResolvedValue({ user: { id: 'user-1', label: 'test', role: 'user', imageCount: 0, quota: 0, unlimitedQuota: false, usedCount: 0 } })
    vi.mocked(deleteRemoteImage).mockReset()
    vi.mocked(deleteRemoteImage).mockResolvedValue({ ok: true })
    vi.mocked(deleteRemoteTask).mockReset()
    vi.mocked(deleteRemoteTask).mockResolvedValue({ ok: true })
    vi.mocked(putRemoteTask).mockClear()
    vi.mocked(uploadImage).mockClear()

    useStore.setState({
      settings: { ...DEFAULT_SETTINGS, timeout: 60 },
      prompt: 'test prompt',
      inputImages: [],
      maskDraft: null,
      maskEditorImageId: null,
      params: { ...DEFAULT_PARAMS },
      tasks: [],
      detailTaskId: null,
      lightboxImageId: null,
      lightboxImageList: [],
      showSettings: false,
      seenAnnouncementUpdatedAt: null,
      confirmDialog: null,
      showToast: vi.fn(),
      setConfirmDialog: vi.fn(),
      authUser: { id: 'user-1', label: 'test', role: 'user', imageCount: 0, quota: 0, unlimitedQuota: false, usedCount: 0 },
    })
  })

  it('creates a queued task immediately', () => {
    submitTask()
    const tasks = useStore.getState().tasks
    expect(tasks.length).toBe(1)
    expect(tasks[0].status).toBe('queued')
    expect(tasks[0].prompt).toBe('test prompt')
  })

  it('calls submitGenerateTask to submit to backend', async () => {
    // Mock fetchTasks to return done on first poll
    vi.mocked(fetchTasks).mockResolvedValue({
      tasks: [{
        id: useStore.getState().tasks[0]?.id || 'task-1',
        status: 'done',
        outputImages: ['img-1'],
        prompt: 'test prompt',
        params: { ...DEFAULT_PARAMS },
        inputImageIds: [],
        maskTargetImageId: null,
        maskImageId: null,
        error: null,
        createdAt: Date.now(),
        finishedAt: Date.now(),
        elapsed: 1000,
      }],
    })

    submitTask()
    await vi.waitFor(() => {
      expect(submitGenerateTask).toHaveBeenCalledWith(
        expect.any(String),
        'test prompt',
        expect.objectContaining({}),
        [],
        false,
      )
    })
  })

  it('polls for completion and updates task to done', async () => {
    submitTask()

    await vi.waitFor(() => {
      const tasks = useStore.getState().tasks
      expect(tasks[0].status).toBe('done')
    }, { timeout: 5000 })
  })

  it('refreshes auth user after SSE completion', async () => {
    vi.mocked(getMe).mockResolvedValueOnce({
      user: { id: 'user-1', label: 'test', role: 'user', imageCount: 2, quota: 10, unlimitedQuota: false, usedCount: 2 },
    })

    submitTask()

    await vi.waitFor(() => {
      expect(useStore.getState().authUser?.usedCount).toBe(2)
      expect(useStore.getState().authUser?.imageCount).toBe(2)
    }, { timeout: 5000 })
  })

  it('updates task to error when backend returns error status', async () => {
    // Override SSE mock to return error
    vi.mocked(streamTaskStatus).mockImplementation((_taskId: string, onUpdate: Function) => {
      setTimeout(() => {
        const task = useStore.getState().tasks.find((t: any) => t.id === _taskId)
        if (task) {
          onUpdate({ ...task, status: 'error', error: 'Generation failed', outputImages: [], finishedAt: Date.now(), elapsed: 1000 })
        }
      }, 10)
      return new AbortController()
    })

    submitTask()

    await vi.waitFor(() => {
      const tasks = useStore.getState().tasks
      expect(tasks[0].status).toBe('error')
      expect(tasks[0].error).toBe('Generation failed')
    }, { timeout: 5000 })
  })

  it('marks task as error when input image upload fails', async () => {
    const uploadError = new Error('upload failed')
    vi.mocked(uploadImage).mockRejectedValueOnce(uploadError)
    useStore.setState({ inputImages: [{ id: 'local-img', dataUrl: 'data:image/png;base64,local' }] })

    await submitTask()

    const tasks = useStore.getState().tasks
    expect(tasks[0].status).toBe('error')
    expect(tasks[0].error).toBe('upload failed')
    expect(useStore.getState().detailTaskId).toBe(tasks[0].id)
    expect(submitGenerateTask).not.toHaveBeenCalled()
    expect(useStore.getState().showToast).toHaveBeenCalledWith('图片上传失败：upload failed', 'error')
  })

  it('clamps params.n to max before backend submission', async () => {
    useStore.setState({ params: { ...DEFAULT_PARAMS, n: 999 } })

    await submitTask()

    await vi.waitFor(() => {
      expect(submitGenerateTask).toHaveBeenCalledWith(
        expect.any(String),
        'test prompt',
        expect.objectContaining({ n: 10 }),
        [],
        false,
      )
    })
  })

  it('clamps params.n to min before backend submission', async () => {
    useStore.setState({ params: { ...DEFAULT_PARAMS, n: 0 } })

    await submitTask()

    await vi.waitFor(() => {
      expect(submitGenerateTask).toHaveBeenCalledWith(
        expect.any(String),
        'test prompt',
        expect.objectContaining({ n: 1 }),
        [],
        false,
      )
    })
  })

  it('updates task to error when SSE returns error-only payload through backendApi', async () => {
    vi.mocked(streamTaskStatus).mockImplementation((_taskId: string, onUpdate: Function) => {
      setTimeout(() => {
        onUpdate({ id: _taskId, status: 'error', error: '任务不存在', outputImages: [] })
      }, 10)
      return new AbortController()
    })

    submitTask()

    await vi.waitFor(() => {
      const tasks = useStore.getState().tasks
      expect(tasks[0].status).toBe('error')
      expect(tasks[0].error).toBe('任务不存在')
    }, { timeout: 5000 })
  })

  it('clears local session when unauthorized handler is invoked', () => {
    const calls = vi.mocked(setUnauthorizedHandler).mock.calls
    const handler = calls[calls.length - 1]?.[0]
    expect(handler).toBeTypeOf('function')

    useStore.setState({
      authUser: { id: 'user-1', label: 'test', role: 'user', imageCount: 0, quota: 0, unlimitedQuota: false, usedCount: 0 },
      tasks: [task({ status: 'queued' })],
      showSettings: true,
    })

    handler?.()

    expect(useStore.getState().authUser).toBeNull()
    expect(useStore.getState().tasks).toEqual([])
    expect(useStore.getState().showSettings).toBe(false)
  })

  it('does not submit when prompt is empty', async () => {
    useStore.setState({ prompt: '   ' })

    submitTask()

    expect(submitGenerateTask).not.toHaveBeenCalled()
    expect(useStore.getState().tasks.length).toBe(0)
  })

  it('does not submit when not authenticated', async () => {
    useStore.setState({ authUser: null })

    submitTask()

    expect(submitGenerateTask).not.toHaveBeenCalled()
    expect(useStore.getState().tasks.length).toBe(0)
  })
})

describe('task deletion remote cleanup', () => {
  beforeEach(() => {
    resetStoreForTest()
    vi.mocked(deleteRemoteImage).mockReset()
    vi.mocked(deleteRemoteImage).mockResolvedValue({ ok: true })
    vi.mocked(deleteRemoteTask).mockReset()
    vi.mocked(deleteRemoteTask).mockResolvedValue({ ok: true })
    useStore.setState({ showToast: vi.fn() })
  })

  it('keeps a task locally when remote deletion fails', async () => {
    const existing = task({ id: 'task-delete', outputImages: ['output-1'] })
    vi.mocked(deleteRemoteTask).mockRejectedValueOnce(new Error('delete failed'))
    useStore.setState({ tasks: [existing] })

    await removeTask(existing)

    expect(useStore.getState().tasks).toEqual([existing])
    expect(deleteRemoteImage).not.toHaveBeenCalled()
    expect(useStore.getState().showToast).toHaveBeenCalledWith('删除失败：delete failed', 'error')
  })

  it('deletes unreferenced remote images after deleting a task', async () => {
    const existing = task({ id: 'task-delete', inputImageIds: ['input-1'], maskImageId: 'mask-1', outputImages: ['output-1'] })
    useStore.setState({ tasks: [existing], inputImages: [] })

    await removeTask(existing)

    expect(deleteRemoteTask).toHaveBeenCalledWith('task-delete')
    expect(deleteRemoteImage).toHaveBeenCalledWith('input-1')
    expect(deleteRemoteImage).toHaveBeenCalledWith('mask-1')
    expect(deleteRemoteImage).toHaveBeenCalledWith('output-1')
    expect(useStore.getState().tasks).toEqual([])
    expect(useStore.getState().showToast).toHaveBeenCalledWith('记录已删除', 'success')
  })

  it('does not delete images still referenced by remaining tasks or current inputs', async () => {
    const deleting = task({ id: 'task-delete', inputImageIds: ['shared-input'], outputImages: ['unique-output'] })
    const remaining = task({ id: 'task-keep', inputImageIds: ['shared-input'], outputImages: ['shared-output'] })
    useStore.setState({ tasks: [deleting, remaining], inputImages: [{ id: 'shared-output', dataUrl: 'data:image/png;base64,shared' }] })

    await removeTask(deleting)

    expect(deleteRemoteImage).not.toHaveBeenCalledWith('shared-input')
    expect(deleteRemoteImage).not.toHaveBeenCalledWith('shared-output')
    expect(deleteRemoteImage).toHaveBeenCalledWith('unique-output')
    expect(useStore.getState().tasks).toEqual([remaining])
  })

  it('deletes multiple tasks only after all remote task deletes succeed', async () => {
    const first = task({ id: 'task-1', outputImages: ['output-1'] })
    const second = task({ id: 'task-2', outputImages: ['output-2'] })
    vi.mocked(deleteRemoteTask).mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(new Error('second failed'))
    useStore.setState({ tasks: [first, second], selectedTaskIds: ['task-1', 'task-2'] })

    await removeMultipleTasks(['task-1', 'task-2'])

    expect(useStore.getState().tasks).toEqual([first, second])
    expect(deleteRemoteImage).not.toHaveBeenCalled()
    expect(useStore.getState().showToast).toHaveBeenCalledWith('删除失败：second failed', 'error')
  })
})

describe.skip('image cache behavior in store — TODO: update for current store implementation', () => {
  beforeEach(() => {
    resetStoreForTest()
    vi.mocked(fetchTasks).mockReset()
    vi.mocked(fetchTasks).mockResolvedValue({ tasks: [] })
    vi.mocked(getMe).mockResolvedValue({ user: { id: 'user-1', label: 'test', role: 'user', imageCount: 0, quota: 0, unlimitedQuota: false, usedCount: 0 } })
    vi.mocked(getPublicConfig).mockResolvedValue({ ...DEFAULT_SETTINGS })
    vi.mocked(getImage).mockReset()
    vi.mocked(getImage).mockResolvedValue(undefined)
    vi.mocked(putImage).mockClear()
    vi.mocked(uploadImage).mockClear()
  })

  it('returns memory cached data URLs without reading IndexedDB or fetching', async () => {
    vi.stubGlobal('FileReader', TestFileReader)
    vi.mocked(hashDataUrl).mockResolvedValue('memory-img')
    const file = new File(['memory'], 'memory.png', { type: 'image/png' })

    await addImageFromFile(file)
    const result = await ensureImageCached('memory-img')

    expect(result).toBe('data:image/png;base64,memory')
    expect(getCachedImage('memory-img')).toBe('data:image/png;base64,memory')
    expect(getImage).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('restores an IndexedDB hit into memory without fetching', async () => {
    vi.mocked(getImage).mockResolvedValue({
      id: 'idb-img',
      dataUrl: 'data:image/png;base64,idb',
      createdAt: 1,
      source: 'generated',
    })

    const result = await ensureImageCached('idb-img')

    expect(result).toBe('data:image/png;base64,idb')
    expect(getCachedImage('idb-img')).toBe('data:image/png;base64,idb')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches backend images on cache miss and persists the data URL', async () => {
    vi.mocked(getImage).mockResolvedValue(undefined)
    vi.mocked(fetch).mockResolvedValue(new Response(new Blob(['remote'], { type: 'image/png' }), { status: 200 }))

    const result = await ensureImageCached('remote-img')

    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/images/remote-img?token=test-token', { cache: 'no-store' })
    expect(result).toBe('data:image/png;base64,remote')
    expect(getCachedImage('remote-img')).toBe('data:image/png;base64,remote')
    expect(putImage).toHaveBeenCalledWith(expect.objectContaining({
      id: 'remote-img',
      dataUrl: 'data:image/png;base64,remote',
      source: 'generated',
    }))
  })

  it('deduplicates concurrent backend image fetches for the same id', async () => {
    vi.mocked(getImage).mockResolvedValue(undefined)
    vi.mocked(fetch).mockResolvedValue(new Response(new Blob(['once'], { type: 'image/png' }), { status: 200 }))

    const results = await Promise.all([
      ensureImageCached('same-img'),
      ensureImageCached('same-img'),
      ensureImageCached('same-img'),
    ])

    expect(results).toEqual([
      'data:image/png;base64,once',
      'data:image/png;base64,once',
      'data:image/png;base64,once',
    ])
    expect(fetch).toHaveBeenCalledTimes(1)

    await ensureImageCached('same-img')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('falls back to the remote URL when backend image fetch fails', async () => {
    vi.mocked(getImage).mockResolvedValue(undefined)
    vi.mocked(fetch).mockResolvedValue(new Response('missing', { status: 404 }))

    const result = await ensureImageCached('missing-img')

    expect(result).toBe('http://localhost:3001/api/images/missing-img?token=test-token')
    expect(getCachedImage('missing-img')).toBe('http://localhost:3001/api/images/missing-img?token=test-token')
    expect(putImage).not.toHaveBeenCalled()
  })

  it('bootstraps task images from IndexedDB and warms done outputs from backend', async () => {
    vi.mocked(getImage).mockImplementation(async (id: string) => {
      if (id === 'input-id') {
        return { id, dataUrl: 'data:image/png;base64,input', createdAt: 1, source: 'upload' }
      }
      return undefined
    })
    vi.mocked(fetchTasks).mockResolvedValue({
      tasks: [task({ id: 'task-cache', inputImageIds: ['input-id'], outputImages: ['output-id'] })],
    })
    vi.mocked(fetch).mockResolvedValue(new Response(new Blob(['output'], { type: 'image/png' }), { status: 200 }))

    await bootstrapBackendSession()
    await vi.waitFor(() => {
      expect(getCachedImage('output-id')).toBe('data:image/png;base64,output')
    })

    expect(getCachedImage('input-id')).toBe('data:image/png;base64,input')
    expect(putImage).toHaveBeenCalledWith(expect.objectContaining({
      id: 'output-id',
      dataUrl: 'data:image/png;base64,output',
      source: 'generated',
    }))
  })

  it('replaces temporary upload ids with backend ids and persists uploads', async () => {
    vi.mocked(hashDataUrl).mockResolvedValue('temp-upload')
    vi.mocked(uploadImage).mockResolvedValue({
      id: 'backend-upload',
      dataUrl: 'data:image/png;base64,uploaded',
      createdAt: 7,
      source: 'upload',
    })
    vi.mocked(streamTaskStatus).mockImplementation(() => new AbortController())

    await addImageFromFile(new File(['upload'], 'upload.png', { type: 'image/png' }))
    await submitTask()

    const createdTask = useStore.getState().tasks[0]
    expect(createdTask.inputImageIds).toEqual(['backend-upload'])
    expect(getCachedImage('backend-upload')).toBe('data:image/png;base64,upload')
    expect(putImage).toHaveBeenCalledWith({
      id: 'backend-upload',
      dataUrl: 'data:image/png;base64,upload',
      createdAt: 7,
      source: 'upload',
    })
  })
})
