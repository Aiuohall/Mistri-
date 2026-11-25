import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { ApiError, readList } from './api';
import type { Job, createApi } from './api';
import { useJobUpdate } from './job-updates';
import { Button, Field, Heading, Notice, styles, useCopy } from './ui';

type Api = ReturnType<typeof createApi>;
type Message = { id: string; senderId: string; body: string; createdAt: string };
function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== 'object') return false;
  const item = value as Message;
  return (
    typeof item.id === 'string' &&
    typeof item.senderId === 'string' &&
    typeof item.body === 'string' &&
    typeof item.createdAt === 'string'
  );
}

export function JobConversation({ job, api, userId }: { job: Job; api: Api; userId?: string }) {
  const c = useCopy();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Message[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);
  const [reported, setReported] = useState<string[]>([]);
  const attempt = useRef(0);
  const pending = useRef<{ body: string; clientId: string } | null>(null);
  const path = '/service-requests/' + encodeURIComponent(job.id) + '/messages';

  const load = useCallback(
    async (before?: string) => {
      const current = ++attempt.current;
      setLoading(true);
      setError(false);
      try {
        const result = await api(path + (before ? '?before=' + encodeURIComponent(before) : ''));
        if (
          !result ||
          typeof result !== 'object' ||
          !('items' in result) ||
          !('nextCursor' in result) ||
          (result.nextCursor !== null && typeof result.nextCursor !== 'string')
        ) {
          throw new Error('Invalid conversation');
        }
        const next = readList(result.items, isMessage);
        const nextCursor = result.nextCursor;
        if (current === attempt.current) {
          setItems((previous) =>
            before
              ? [...previous, ...next.filter((item) => !previous.some((p) => p.id === item.id))]
              : next,
          );
          setCursor(nextCursor);
        }
      } catch {
        if (current === attempt.current) setError(true);
      } finally {
        if (current === attempt.current) setLoading(false);
      }
    },
    [api, path],
  );

  useEffect(() => {
    if (open) void load();
    return () => {
      attempt.current += 1;
    };
  }, [open, load]);
  useJobUpdate(() => {
    if (open) void load();
  }, job.id);

  const writable = ['assigned', 'en_route', 'arrived', 'in_progress'].includes(job.status);
  const send = async () => {
    if (sending || !writable || !body.trim()) return;
    setSending(true);
    setError(false);
    try {
      const text = body.trim();
      if (pending.current?.body !== text) pending.current = { body: text, clientId: randomUUID() };
      const saved = await api(path, pending.current);
      if (!isMessage(saved)) throw new Error('Invalid message');
      pending.current = null;
      setBody('');
      await load();
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  };
  const report = async (id: string) => {
    setReporting(id);
    setError(false);
    try {
      await api(path + '/' + encodeURIComponent(id) + '/report', {});
      setReported((previous) => [...previous, id]);
    } catch {
      setError(true);
    } finally {
      setReporting(null);
    }
  };

  return (
    <View style={styles.card}>
      <Button
        title={c(open ? 'engagement.close_chat' : 'engagement.open_chat')}
        onPress={() => setOpen(!open)}
      />
      {open && (
        <>
          <Heading>{c('engagement.chat')}</Heading>
          {loading && <Text accessibilityLiveRegion="polite">{c('customer.loading')}</Text>}
          {error && <Notice>{c('engagement.error')}</Notice>}
          <Button title={c('customer.refresh')} disabled={loading} onPress={() => void load()} />
          {!loading && !error && !items.length && <Text>{c('engagement.no_messages')}</Text>}
          {cursor && (
            <Button
              title={c('engagement.older_messages')}
              disabled={loading}
              onPress={() => void load(cursor)}
            />
          )}
          {[...items].reverse().map((item) => (
            <View key={item.id}>
              <Text>{c(item.senderId === userId ? 'engagement.you' : 'engagement.other')}</Text>
              <Text>{item.body}</Text>
              {item.senderId !== userId &&
                (reported.includes(item.id) ? (
                  <Text>{c('engagement.reported')}</Text>
                ) : (
                  <Button
                    title={c('engagement.report')}
                    disabled={reporting !== null}
                    onPress={() => void report(item.id)}
                  />
                ))}
            </View>
          ))}
          {writable ? (
            <>
              <Field
                label={c('engagement.message')}
                value={body}
                onChangeText={setBody}
                editable={!sending}
                maxLength={1000}
                multiline
              />
              <Button
                title={c('engagement.send')}
                disabled={sending || !body.trim()}
                onPress={() => void send()}
              />
            </>
          ) : (
            <Text>{c('engagement.read_only')}</Text>
          )}
        </>
      )}
    </View>
  );
}

export function JobReview({ jobId, api }: { jobId: string; api: Api }) {
  const c = useCopy();
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'ready' | 'done' | 'conflict' | 'error'>('ready');
  const submit = async () => {
    if (!rating || busy) return;
    setBusy(true);
    try {
      await api('/service-requests/' + encodeURIComponent(jobId) + '/review', { rating, comment });
      setState('done');
    } catch (error) {
      setState(error instanceof ApiError && error.status === 409 ? 'conflict' : 'error');
    } finally {
      setBusy(false);
    }
  };
  if (state === 'done') return <Text>{c('engagement.review_saved')}</Text>;
  if (state === 'conflict') return <Notice>{c('engagement.review_unavailable')}</Notice>;
  return (
    <View style={styles.card}>
      <Button
        title={c(expanded ? 'engagement.close_review' : 'engagement.review')}
        onPress={() => setExpanded(!expanded)}
      />
      {expanded && (
        <>
          <Field
            label={c('engagement.rating')}
            value={rating ? String(rating) : ''}
            onChangeText={(value) => setRating(/^[1-5]$/.test(value) ? Number(value) : 0)}
            keyboardType="number-pad"
            maxLength={1}
            editable={!busy}
          />
          <Field
            label={c('engagement.comment')}
            value={comment}
            onChangeText={setComment}
            maxLength={500}
            editable={!busy}
            multiline
          />
          {state === 'error' && <Notice>{c('engagement.error')}</Notice>}
          <Button
            title={c('engagement.submit_review')}
            disabled={busy || !rating}
            onPress={() => void submit()}
          />
        </>
      )}
    </View>
  );
}
