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

const gutterFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const monthYearFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });

function formatDate(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? iso : dateFormatter.format(at);
}

/** Compact ledger format for the timeline gutter: "Nov 21 · 22:05". */
function formatGutter(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? iso : gutterFormatter.format(at).replace(',', ' ·');
}

function formatMonthYear(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '' : monthYearFormatter.format(at);
}

/** Human language name for the meta line: "fr" -> "French". */
function languageLabel(code: string): string {
  try {
    const display = new Intl.DisplayNames([], { type: 'language' });
    return display.of(code) ?? code;
  } catch {
    return code;
  }
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
  return <p className="inline-list">{values.join(' · ')}</p>;
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

function guestInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1] ?? '' : '';
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

/** Deterministic mineral tone per guest, so the list feels inhabited. */
const AVATAR_TONES = ['clay', 'sage', 'sand', 'slate'] as const;

function avatarTone(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return AVATAR_TONES[hash % AVATAR_TONES.length] ?? 'sand';
}

function EmptyState(): ReactNode {
  return (
    <div className="empty-state">
      <span className="monogram" aria-hidden="true">
        L
      </span>
      <h2 className="empty-title">Select a guest</h2>
      <p className="empty-copy">
        Choose a guest to review their memory and prepare the house’s reply. Every draft waits for
        your hand.
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
      setClientsError(cause instanceof Error ? cause.message : 'Unable to load guests.');
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
        <p>{detailLoading ? 'Loading guest…' : 'Guest unavailable.'}</p>
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
              <p className="client-kicker">Guest since {formatMonthYear(client.createdAt)}</p>
              <h1 className="client-title">{client.displayName}</h1>
              <p className="meta-line">
                {[
                  languageLabel(client.language),
                  client.timezone,
                  client.email,
                  client.phone,
                ]
                  .filter((part): part is string => part !== undefined)
                  .join('  ·  ')}
              </p>
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

          <section aria-label="Taste memory">
            <h2 className="panel-title">Memory</h2>
            <div className="memory">
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

          <hr className="section-rule" />

          <section aria-label="Interaction timeline">
            <h2 className="panel-title">Correspondence</h2>
            {timeline.length === 0 ? (
              <p className="quiet">No correspondence yet.</p>
            ) : (
              <ol className="timeline">
                {timeline.map((item) => (
                  <li key={item.id} className={`timeline-item ${item.direction}`}>
                    <time className="timeline-when" dateTime={item.at} title={formatDate(item.at)}>
                      {formatGutter(item.at)}
                    </time>
                    <span
                      className={item.direction === 'outbound' ? 'dir-dot dir-outbound' : 'dir-dot'}
                      aria-hidden="true"
                    />
                    <div className="timeline-body">
                      <p className="timeline-over">
                        <span className="channel-label">{item.channel}</span>
                        <span className="dir-word">
                          {item.direction === 'outbound' ? 'the house' : 'the guest'}
                        </span>
                        {item.advisorId !== undefined && (
                          <span className="advisor-note"> · {item.advisorId}</span>
                        )}
                      </p>
                      <p className="timeline-summary">{item.summary}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <section className="composer" aria-label="Reply composer">
          <div className="composer-head">
            <h2 className="composer-title">The house replies</h2>
            <span className="gate-note">Nothing reaches a guest without your approval.</span>
          </div>

          {pendingDrafts.length > 0 && (
            <div className="pending-drafts">
              <p className="pending-title">
                <span className="pending-dot" aria-hidden="true" />
                {pendingDrafts.length === 1
                  ? 'Awaiting your hand'
                  : `${pendingDrafts.length} awaiting your hand`}
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
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !generating && draft === null) {
                    event.preventDefault();
                    void generateDraft();
                  }
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
                <span className="awaiting-mark">Awaiting your hand</span>
                <span className="draft-meta">
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
                Approving sends this to {client.displayName} via {channelLabel(draft.channel)}.
                Rejecting discards it — nothing is ever sent without your hand.
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
        <span className="wordmark">
          <em>Luxe</em> Copilot
        </span>
        <span className="topbar-pledge">
          <span className="pledge-dot" aria-hidden="true" />
          Every send requires your hand
        </span>
      </header>
      <main className="workspace">
        <aside className="sidebar" aria-label="Client list">
          <div className="sidebar-head">
            <label className="sidebar-title" htmlFor="client-search">
              Guests
            </label>
            <input
              id="client-search"
              className="search"
              type="search"
              placeholder="Search guests…"
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
            <p className="sidebar-status">Loading guests…</p>
          ) : visibleClients.length === 0 ? (
            <p className="sidebar-status">No guests match.</p>
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
                      <span className={`avatar avatar-${avatarTone(client.displayName)}`} aria-hidden="true">
                        {guestInitials(client.displayName)}
                      </span>
                      <span className="client-text">
                        <span className="client-name">{client.displayName}</span>
                        <span className="client-meta">
                          {last !== undefined ? (
                            <span className="client-snippet">{last.summary}</span>
                          ) : (
                            <span className="client-snippet">No correspondence yet</span>
                          )}
                        </span>
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
