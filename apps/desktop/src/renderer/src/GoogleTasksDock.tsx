import { useEffect, useMemo, useState } from 'react'
import type { GoogleTask, GoogleTaskList, GoogleTasksConnectionStatus } from '@tupiniquim/contracts'
import './google-tasks.css'

const projectSuggestions = [
  'Tupiniquim AI Dev Studio',
  'CRM Tupiniquim',
  'GlicoControl-MVP',
  'Top Tech BR',
  'Vanessa Braz',
  'MetalArt',
  'AI-LAB',
  'Geral'
] as const

const initialStatus: GoogleTasksConnectionStatus = {
  configured: false,
  authenticated: false,
  secureStorageAvailable: false,
  scope: 'https://www.googleapis.com/auth/tasks'
}

export const GoogleTasksDock = (): JSX.Element => {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<GoogleTasksConnectionStatus>(initialStatus)
  const [lists, setLists] = useState<GoogleTaskList[]>([])
  const [selectedListId, setSelectedListId] = useState<string>('')
  const [tasks, setTasks] = useState<GoogleTask[]>([])
  const [newListTitle, setNewListTitle] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const selectedList = useMemo(
    () => lists.find((item) => item.id === selectedListId) ?? null,
    [lists, selectedListId]
  )

  const run = async <T,>(operation: () => Promise<T>): Promise<T | null> => {
    setBusy(true)
    setError(null)
    try {
      return await operation()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha inesperada no Google Tasks.')
      return null
    } finally {
      setBusy(false)
    }
  }

  const refreshStatus = async (): Promise<void> => {
    const result = await window.googleTasks.status()
    if (result.ok) setStatus(result.value)
    else setError(result.error.message)
  }

  const loadTasks = async (taskListId: string): Promise<void> => {
    if (taskListId === '') {
      setTasks([])
      return
    }
    const result = await window.googleTasks.listTasks({
      taskListId,
      showCompleted: true,
      showHidden: false,
      maxResults: 100
    })
    if (result.ok) setTasks(result.value)
    else setError(result.error.message)
  }

  const loadLists = async (): Promise<void> => {
    const result = await window.googleTasks.listTaskLists({ maxResults: 100 })
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    setLists(result.value)
    const nextId = result.value.some((item) => item.id === selectedListId)
      ? selectedListId
      : (result.value[0]?.id ?? '')
    setSelectedListId(nextId)
    await loadTasks(nextId)
  }

  useEffect(() => {
    void refreshStatus()
  }, [])

  useEffect(() => {
    if (!open || !status.authenticated) return
    void run(loadLists)
  }, [open, status.authenticated])

  const connect = async (): Promise<void> => {
    await run(async () => {
      const result = await window.googleTasks.connect()
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setStatus(result.value)
      if (result.value.authenticated) await loadLists()
    })
  }

  const disconnect = async (): Promise<void> => {
    await run(async () => {
      const result = await window.googleTasks.disconnect()
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setStatus(result.value)
      setLists([])
      setTasks([])
      setSelectedListId('')
    })
  }

  const createList = async (): Promise<void> => {
    const title = newListTitle.trim()
    if (title === '') return
    await run(async () => {
      const result = await window.googleTasks.createTaskList({ title })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setLists((current) => [...current, result.value])
      setSelectedListId(result.value.id)
      setTasks([])
      setNewListTitle('')
    })
  }

  const createTask = async (): Promise<void> => {
    const title = newTaskTitle.trim()
    if (title === '' || selectedListId === '') return
    await run(async () => {
      const result = await window.googleTasks.createTask({ taskListId: selectedListId, title })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setTasks((current) => [result.value, ...current])
      setNewTaskTitle('')
    })
  }

  const completeTask = async (task: GoogleTask): Promise<void> => {
    if (selectedListId === '' || task.status === 'completed') return
    await run(async () => {
      const result = await window.googleTasks.completeTask({ taskListId: selectedListId, taskId: task.id })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setTasks((current) => current.map((item) => item.id === result.value.id ? result.value : item))
    })
  }

  const deleteTask = async (task: GoogleTask): Promise<void> => {
    if (selectedListId === '') return
    await run(async () => {
      const result = await window.googleTasks.deleteTask({ taskListId: selectedListId, taskId: task.id })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setTasks((current) => current.filter((item) => item.id !== task.id))
    })
  }

  return (
    <aside className={`google-tasks-dock ${open ? 'is-open' : ''}`} aria-label="Google Tasks">
      <button
        className="google-tasks-trigger"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="google-tasks-panel"
      >
        <span aria-hidden="true">✓</span>
        <span>Tasks</span>
      </button>

      {open && (
        <section id="google-tasks-panel" className="google-tasks-panel">
          <header className="google-tasks-header">
            <div>
              <strong>Google Tasks</strong>
              <small>{status.authenticated ? 'Conectado' : status.configured ? 'Pronto para conectar' : 'Configuração pendente'}</small>
            </div>
            <button type="button" className="google-tasks-icon-button" onClick={() => setOpen(false)} aria-label="Fechar Google Tasks">×</button>
          </header>

          {!status.configured && (
            <div className="google-tasks-notice">
              Configure <code>GOOGLE_TASKS_CLIENT_ID</code> em <code>.env.local</code> usando um OAuth Client do tipo Desktop app.
            </div>
          )}

          {status.configured && !status.authenticated && (
            <div className="google-tasks-connect">
              <p>Conecte sua conta Google pelo navegador do sistema. O Tupiniquim solicita somente acesso ao Google Tasks.</p>
              <button type="button" onClick={() => void connect()} disabled={busy}>Conectar Google Tasks</button>
            </div>
          )}

          {status.authenticated && (
            <>
              {!status.secureStorageAvailable && (
                <div className="google-tasks-notice warning">O armazenamento cifrado do sistema não está disponível; o token será mantido somente nesta sessão.</div>
              )}

              <div className="google-tasks-toolbar">
                <select
                  aria-label="Lista Google Tasks"
                  value={selectedListId}
                  onChange={(event) => {
                    const next = event.target.value
                    setSelectedListId(next)
                    void run(async () => await loadTasks(next))
                  }}
                  disabled={busy}
                >
                  {lists.length === 0 && <option value="">Nenhuma lista</option>}
                  {lists.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
                <button type="button" onClick={() => void run(loadLists)} disabled={busy} aria-label="Atualizar listas e tarefas">↻</button>
              </div>

              <div className="google-tasks-create-list">
                <input
                  value={newListTitle}
                  onChange={(event) => setNewListTitle(event.target.value)}
                  placeholder="Nova lista de projeto"
                  maxLength={1024}
                  disabled={busy}
                />
                <button type="button" onClick={() => void createList()} disabled={busy || newListTitle.trim() === ''}>Criar</button>
              </div>

              <div className="google-tasks-suggestions" aria-label="Sugestões de listas">
                {projectSuggestions.map((name) => (
                  <button key={name} type="button" onClick={() => setNewListTitle(name)} disabled={busy}>{name}</button>
                ))}
              </div>

              {selectedList !== null && (
                <div className="google-tasks-create-task">
                  <input
                    value={newTaskTitle}
                    onChange={(event) => setNewTaskTitle(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') void createTask() }}
                    placeholder={`Nova tarefa em ${selectedList.title}`}
                    maxLength={1024}
                    disabled={busy}
                  />
                  <button type="button" onClick={() => void createTask()} disabled={busy || newTaskTitle.trim() === ''}>Adicionar</button>
                </div>
              )}

              <div className="google-tasks-list" aria-live="polite">
                {tasks.length === 0 && <p className="google-tasks-empty">Nenhuma tarefa nesta lista.</p>}
                {tasks.map((task) => (
                  <article key={task.id} className={`google-task-row ${task.status === 'completed' ? 'is-completed' : ''}`}>
                    <button
                      type="button"
                      className="google-task-check"
                      onClick={() => void completeTask(task)}
                      disabled={busy || task.status === 'completed'}
                      aria-label={task.status === 'completed' ? 'Tarefa concluída' : `Concluir ${task.title}`}
                    >
                      {task.status === 'completed' ? '✓' : '○'}
                    </button>
                    <div className="google-task-content">
                      <strong>{task.title || '(sem título)'}</strong>
                      {task.due !== undefined && <small>Prazo: {new Date(task.due).toLocaleDateString('pt-BR')}</small>}
                    </div>
                    <button type="button" className="google-task-delete" onClick={() => void deleteTask(task)} disabled={busy} aria-label={`Excluir ${task.title}`}>×</button>
                  </article>
                ))}
              </div>

              <footer className="google-tasks-footer">
                <span>{busy ? 'Processando…' : `${String(tasks.filter((task) => task.status !== 'completed').length)} pendente(s)`}</span>
                <button type="button" onClick={() => void disconnect()} disabled={busy}>Desconectar</button>
              </footer>
            </>
          )}

          {error !== null && (
            <div className="google-tasks-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} aria-label="Fechar erro">×</button>
            </div>
          )}
        </section>
      )}
    </aside>
  )
}
