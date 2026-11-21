// SPDX-License-Identifier: Apache-2.0
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import {
  approveDraft,
  draftReply,
  getClient,
  listClients,
  listDrafts,
  rejectDraft,
  type Channel,
  type Client,
  type ClientDetail,
  type Draft,
  type Interaction,
} from './api';

const CHANNEL_OPTIONS: ReadonlyArray<{ value: Channel; label: string }> = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
];

type ComposerOutcome = { kind: 'approved'; channel: string } | { kind: 'rejected' };

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function formatDate(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? iso : dateFormatter.format(at);
}

function channelLabel(channel: string): string {
  const match = CHANNEL_OPTIONS.find((option) => option.value === channel);
  return match === undefined ? channel : match.label;
}

function byNewest(a: Interaction, b: Interaction): number {
  return Date.parse(b.at) - Date.parse(a.at);
}

function latestInteraction(detail: ClientDetail | undefined): Interaction | undefined {
  if (detail === undefined || detail.interactions.length === 0) return undefined;
  const ordered = [...detail.interactions].sort(byNewest);
  return ordered[0];
}

function TagList({ values, empty }: { values: string[]; empty: string }): ReactNode {
  if (values.length === 0) return <p className="quiet">{empty}</p>;
  return (
    <ul className="tag-list">
      {values.map((value) => (
        <li key={value} className="tag">
          {value}
        </li>
      ))}
    </ul>
  );
}

function SizesTable({ sizes }: { sizes: Record<string, string> }): ReactNode {
  const entries = Object.entries(sizes).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return <p className="quiet">No sizes recorded yet.</p>;
  return (
    <table className="sizes-table">
      <tbody>
        {entries.map(([label, value]) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EmptyState(): ReactNode {
  return (
    <div className="empty-state">
      <span className="monogram" aria-hidden="true">
        L
      </span>
      <h2 className="empty-title">Select a client</h2>
      <p className="empty-copy">
        Choose a client from the list to review their memory and prepare a reply. Every draft waits
        for your explicit approval before anything is sent.
      </p>
    </div>
  );
}

export default function App(): ReactNode {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState<boolean>(true);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, ClientDetail>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailNonce, setDetailNonce] = useState<number>(0);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');

  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [intent, setIntent] = useState<string>('');
  const [generating, setGenerating] = useState<boolean>(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftText, setDraftText] = useState<string>('');
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [outcome, setOutcome] = useState<ComposerOutcome | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDrafts, setPendingDrafts] = useState<Draft[]>([]);

  /**
   * Loads the roster and prefetches every client's detail so the sidebar can
   * show last-interaction snippets without further round trips.
   */
  const loadClients = useCallback(async (): Promise<void> => {
    setClientsLoading(true);
    setClientsError(null);
    try {
      const roster = await listClients();
      setClients(roster);
      const fetched = await Promise.all(
        roster.map(async (client): Promise<[string, ClientDetail | null]> => {
          try {
            return [client.id, await getClient(client.id)];
          } catch {
            return [client.id, null];
          }
        }),
      );
      const cache: Record<string, ClientDetail> = {};
      for (const [id, entry] of fetched) {
        if (entry !== null) cache[id] = entry;
      }
      setDetails(cache);
    } catch (cause: unknown) {
      setClientsError(cause instanceof Error ? cause.message : 'Unable to load clients.');
    } finally {
      setClientsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  // Reset the composer whenever the advisor switches clients.
  useEffect(() => {
    setChannel('whatsapp');
    setIntent('');
    setGenerating(false);
    setDraft(null);
    setDraftText('');
    setDecision(null);
    setOutcome(null);
    setActionError(null);
    setPendingDrafts([]);
  }, [selectedId]);

  // Load (or refresh) the selected client's detail and pending drafts.
  useEffect(() => {
    if (selectedId === null) return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    const load = async (): Promise<void> => {
      try {
        const [detail, drafts] = await Promise.all([getClient(selectedId), listDrafts(selectedId)]);
        if (cancelled) return;
        setDetails((previous) => ({ ...previous, [selectedId]: detail }));
        setPendingDrafts(drafts.filter((item) => item.status === 'pending_approval'));
      } catch (cause: unknown) {
        if (!cancelled) setDetailError(cause instanceof Error ? cause.message : 'Unable to load client.');
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedId, detailNonce]);

  const selectedDetail: ClientDetail | undefined =
    selectedId !== null ? details[selectedId] : undefined;

  const visibleClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query === '') return clients;
    return clients.filter((client) => client.displayName.toLowerCase().includes(query));
  }, [clients, search]);

  const timeline: Interaction[] =
    selectedDetail === undefined ? [] : [...selectedDetail.interactions].sort(byNewest);

  const refreshAfterDecision = useCallback(async (clientId: string): Promise<void> => {
    const [detail, drafts] = await Promise.all([getClient(clientId), listDrafts(clientId)]);
    setDetails((previous) => ({ ...previous, [clientId]: detail }));
    setPendingDrafts(drafts.filter((item) => item.status === 'pending_approval'));
  }, []);

  const generateDraft = useCallback(async (): Promise<void> => {
    if (selectedId === null || generating || decision !== null) return;
    setGenerating(true);
    setActionError(null);
    setOutcome(null);
    try {
      const hint = intent.trim();
      const created = await draftReply({
        clientId: selectedId,
        channel,
        intentHint: hint === '' ? undefined : hint,
      });
      setDraft(created);
      setDraftText(created.text);
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : 'Draft generation failed.');
    } finally {
      setGenerating(false);
    }
  }, [selectedId, generating, decision, intent, channel]);

  const approve = useCallback(async (): Promise<void> => {
    if (draft === null || decision !== null) return;
    setDecision('approve');
    setActionError(null);
    try {
      const edited = draftText !== draft.text ? draftText : undefined;
      const final = await approveDraft(draft.id, edited);
      setOutcome({ kind: 'approved', channel: final.channel });
      setDraft(null);
      setDraftText('');
      if (selectedId !== null) await refreshAfterDecision(selectedId);
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : 'Approval failed.');
    } finally {
      setDecision(null);
    }
  }, [draft, decision, draftText, selectedId, refreshAfterDecision]);

  const reject = useCallback(async (): Promise<void> => {
    if (draft === null || decision !== null) return;
    setDecision('reject');
    setActionError(null);
    try {
      await rejectDraft(draft.id);
      setOutcome({ kind: 'rejected' });
      setDraft(null);
      setDraftText('');
      if (selectedId !== null) await refreshAfterDecision(selectedId);
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : 'Rejection failed.');
    } finally {
      setDecision(null);
    }
  }, [draft, decision, selectedId, refreshAfterDecision]);

  const reviewPending = useCallback((pending: Draft): void => {
    setDraft(pending);
    setDraftText(pending.text);
    setOutcome(null);
    setActionError(null);
  }, []);

  let detailNode: ReactNode;
  if (selectedId === null) {
    detailNode = <EmptyState />;
  } else if (detailError !== null) {
    detailNode = (
      <div className="detail-status">
        <div className="panel detail-error-panel">
          <p className="error-text">{detailError}</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setDetailNonce((nonce) => nonce + 1);
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  } else if (selectedDetail === undefined) {
    detailNode = (
      <div className="detail-status">
        <p>{detailLoading ? 'Loading client…' : 'Client unavailable.'}</p>
      </div>
    );
  } else {
    const client = selectedDetail.client;
    const busy = decision !== null;
    detailNode = (
      <div className="detail-inner">
        <div className="detail-scroll">
          <header className="client-header">
            <div>
              <h1 className="client-title">{client.displayName}</h1>
              <div className="chip-row">
                <span className="chip">{client.language}</span>
                {client.timezone !== undefined && <span className="chip">{client.timezone}</span>}
                {client.email !== undefined && <span className="chip">{client.email}</span>}
                {client.phone !== undefined && <span className="chip">{client.phone}</span>}
              </div>
            </div>
            {detailLoading && (
              <span className="refreshing" aria-live="polite">
                Refreshing…
              </span>
            )}
          </header>

          {client.notes !== undefined && client.notes.trim() !== '' && (
            <blockquote className="notes">{client.notes}</blockquote>
          )}

          <section className="panel taste" aria-label="Taste memory">
            <h2 className="eyebrow panel-title">Taste memory</h2>
            <div className="taste-grid">
              <div>
                <h3 className="mini-label">Preferred brands</h3>
                <TagList values={client.taste.preferredBrands} empty="No brands recorded yet." />
              </div>
              <div>
                <h3 className="mini-label">Sizes</h3>
                <SizesTable sizes={client.taste.sizes} />
              </div>
              <div>
                <h3 className="mini-label">Interests</h3>
                <TagList values={client.taste.interests} empty="No interests recorded yet." />
              </div>
            </div>
          </section>

          <section className="panel timeline-panel" aria-label="Interaction timeline">
            <h2 className="eyebrow panel-title">Timeline</h2>
            {timeline.length === 0 ? (
              <p className="quiet">No interactions recorded yet.</p>
            ) : (
              <ol className="timeline">
                {timeline.map((item) => (
                  <li key={item.id} className={`timeline-item ${item.direction}`}>
                    <span
                      className={item.direction === 'outbound' ? 'dir-badge dir-outbound' : 'dir-badge'}
                      aria-hidden="true"
                    >
                      {item.direction === 'outbound' ? '⟶' : '⟵'}
                    </span>
                    <div className="timeline-body">
                      <div className="timeline-top">
                        <span className="channel-label">{item.channel}</span>
                        <span className="dir-word">
                          {item.direction === 'outbound' ? 'Outbound' : 'Inbound'}
                        </span>
                        <time className="timeline-date" dateTime={item.at}>
                          {formatDate(item.at)}
                        </time>
                      </div>
                      <p className="timeline-summary">{item.summary}</p>
                      {item.advisorId !== undefined && (
                        <p className="advisor-note">Handled by advisor {item.advisorId}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <section className="composer" aria-label="Reply composer">
          <div className="composer-head">
            <h2 className="eyebrow panel-title">Draft a reply</h2>
            <span className="gate-note">Advisor review required — nothing is sent until you approve.</span>
          </div>

          {pendingDrafts.length > 0 && (
            <div className="pending-drafts">
              <p className="mini-label">
                {pendingDrafts.length === 1
                  ? '1 draft awaiting your approval'
                  : `${pendingDrafts.length} drafts awaiting your approval`}
              </p>
              <ul>
                {pendingDrafts.map((pending) => (
                  <li key={pending.id}>
                    <span>
                      {pending.intentHint ?? `${channelLabel(pending.channel)} · ${formatDate(pending.createdAt)}`}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        reviewPending(pending);
                      }}
                    >
                      Review
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="composer-form">
            <label className="field">
              <span className="mini-label">Channel</span>
              <select
                value={channel}
                disabled={draft !== null || generating}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                  setChannel(event.target.value as Channel);
                }}
              >
                {CHANNEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field-grow">
              <span className="mini-label">Intent</span>
              <input
                type="text"
                placeholder="e.g. confirm Saturday table"
                value={intent}
                disabled={draft !== null || generating}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setIntent(event.target.value);
                }}
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={generating || busy || draft !== null}
              onClick={() => {
                void generateDraft();
              }}
            >
              {generating ? 'Drafting…' : 'Generate draft'}
            </button>
          </div>

          {generating && draft === null && (
            <div className="draft-editor draft-pending" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              <p className="mini-label">Preparing a draft for your review…</p>
            </div>
          )}

          {draft !== null && (
            <div className="draft-editor">
              <div className="draft-editor-head">
                <span className="eyebrow eyebrow-gold">Advisor review required</span>
                <span className="mini-label">
                  {channelLabel(draft.channel)} · drafted {formatDate(draft.createdAt)}
                </span>
              </div>
              <label className="visually-hidden" htmlFor="draft-text">
                Draft message text
              </label>
              <textarea
                id="draft-text"
                rows={6}
                value={draftText}
                disabled={busy}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                  setDraftText(event.target.value);
                }}
              />
              <div className="draft-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || draftText.trim() === ''}
                  onClick={() => {
                    void approve();
                  }}
                >
                  {decision === 'approve' ? 'Approving…' : 'Approve & send'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy || generating}
                  onClick={() => {
                    void generateDraft();
                  }}
                >
                  {generating ? 'Drafting…' : 'Regenerate'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() => {
                    void reject();
                  }}
                >
                  {decision === 'reject' ? 'Discarding…' : 'Reject'}
                </button>
              </div>
              <p className="gate-note">
                Approving sends this message to {client.displayName} via {channelLabel(draft.channel)}.
                Rejecting discards it — nothing is ever sent without your approval.
              </p>
            </div>
          )}

          {outcome !== null && (
            <div
              className={outcome.kind === 'approved' ? 'outcome approved' : 'outcome rejected'}
              role="status"
            >
              {outcome.kind === 'approved'
                ? `Approved — the ${channelLabel(outcome.channel)} message has been queued for ${client.displayName}.`
                : 'Rejected — the draft was discarded and nothing was sent.'}
            </div>
          )}

          {actionError !== null && (
            <div className="inline-error" role="alert">
              <span>{actionError}</span>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="wordmark">Luxe Copilot</span>
        <span className="approval-pill">
          <span className="approval-pill-dot" aria-hidden="true" />
          Human approval required for every send
        </span>
      </header>
      <p className="policy-banner" role="note">
        No message reaches a client without advisor approval.
      </p>
      <main className="workspace">
        <aside className="sidebar" aria-label="Client list">
          <div className="sidebar-head">
            <label className="eyebrow sidebar-title" htmlFor="client-search">
              Clients
            </label>
            <input
              id="client-search"
              className="search"
              type="search"
              placeholder="Search clients…"
              value={search}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setSearch(event.target.value);
              }}
            />
          </div>
          {clientsError !== null && (
            <div className="sidebar-error" role="alert">
              <span>{clientsError}</span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  void loadClients();
                }}
              >
                Retry
              </button>
            </div>
          )}
          {clientsLoading && clients.length === 0 ? (
            <p className="sidebar-status">Loading clients…</p>
          ) : visibleClients.length === 0 ? (
            <p className="sidebar-status">No clients match.</p>
          ) : (
            <ul className="client-list">
              {visibleClients.map((client) => {
                const last = latestInteraction(details[client.id]);
                return (
                  <li key={client.id}>
                    <button
                      type="button"
                      className={client.id === selectedId ? 'client-row is-active' : 'client-row'}
                      aria-current={client.id === selectedId}
                      onClick={() => {
                        setSelectedId(client.id);
                      }}
                    >
                      <span className="client-name">{client.displayName}</span>
                      <span className="client-meta">
                        <span className="tag tag-lang">{client.language}</span>
                        {last !== undefined && <span className="client-snippet">{last.summary}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
        <section className="detail" aria-label="Client detail">
          {detailNode}
        </section>
      </main>
    </div>
  );
}
