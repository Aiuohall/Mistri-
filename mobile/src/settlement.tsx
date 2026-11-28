import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ApiError, type Job, type createApi } from './api';
import { useJobUpdate } from './job-updates';
import { Button, Field, Heading, Notice, styles, useCopy } from './ui';

type Api = ReturnType<typeof createApi>;
type Quote = {
  id: string;
  version: number;
  amount: number;
  fee: number;
  accepted_at: string | null;
};
type Pricing = { current: Quote | null; accepted: Quote | null; needsTopup: boolean };
type Topup = {
  id: string;
  reference: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
};
type Entry = { id: string; amount: number; kind: 'commission' | 'refund' | 'topup' };
type WalletState = { balance: string; reserved: string; entries: Entry[]; topups: Topup[] };

export function poisha(input: string) {
  const normalized = input
    .trim()
    .replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - '০'.charCodeAt(0)));
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return amount > 0 && amount <= 100000000 ? amount : null;
}
function taka(amount: string | number) {
  const digits = String(amount).replace(/^-/, '').padStart(3, '0');
  return (
    (String(amount).startsWith('-') ? '−' : '') + '৳' + digits.slice(0, -2) + '.' + digits.slice(-2)
  );
}
function isQuote(value: unknown): value is Quote | null {
  if (value === null) return true;
  const q = value as Quote | undefined;
  return (
    !!q &&
    typeof q.id === 'string' &&
    Number.isInteger(q.version) &&
    q.version > 0 &&
    Number.isInteger(q.amount) &&
    q.amount > 0 &&
    Number.isInteger(q.fee) &&
    q.fee >= 0 &&
    (q.accepted_at === null || typeof q.accepted_at === 'string')
  );
}
function readPricing(value: unknown) {
  const p = value as Pricing | null;
  if (!p || !isQuote(p.current) || !isQuote(p.accepted) || typeof p.needsTopup !== 'boolean')
    throw new Error('Invalid pricing');
  return p;
}
function readWallet(value: unknown) {
  const w = value as WalletState | null;
  if (
    !w ||
    typeof w.balance !== 'string' ||
    !/^\d+$/.test(w.balance) ||
    typeof w.reserved !== 'string' ||
    !/^\d+$/.test(w.reserved) ||
    !Array.isArray(w.entries) ||
    !w.entries.every(
      (e) =>
        e &&
        typeof e.id === 'string' &&
        Number.isInteger(e.amount) &&
        ['commission', 'refund', 'topup'].includes(e.kind),
    ) ||
    !Array.isArray(w.topups) ||
    !w.topups.every(
      (t) =>
        t &&
        typeof t.id === 'string' &&
        typeof t.reference === 'string' &&
        Number.isInteger(t.amount) &&
        ['pending', 'approved', 'rejected'].includes(t.status),
    )
  )
    throw new Error('Invalid wallet');
  return w;
}
function useSnapshot<T>(api: Api, path: string, read: (v: unknown) => T) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);
  const reload = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setFailed(false);
    try {
      const next = read(await api(path));
      if (id === request.current) setData(next);
    } catch {
      if (id === request.current) {
        setData(null);
        setFailed(true);
      }
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [api, path, read]);
  useEffect(() => {
    void reload();
    return () => {
      request.current++;
    };
  }, [reload]);
  return { data, loading, failed, reload };
}

export function JobPricing({
  job,
  api,
  role,
  onStart,
}: {
  job: Job;
  api: Api;
  role: 'customer' | 'mechanic';
  onStart?: () => void;
}) {
  const c = useCopy();
  const path = '/service-requests/' + encodeURIComponent(job.id);
  const { data, loading, failed, reload } = useSnapshot(api, path + '/pricing', readPricing);
  useJobUpdate(() => void reload(), job.id);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState<'error' | 'conflict' | null>(null);
  const amount = poisha(input);
  const active = ['assigned', 'en_route', 'arrived', 'in_progress'].includes(job.status);
  async function save() {
    if (!data || busy || loading) return;
    setBusy(true);
    setIssue(null);
    try {
      if (role === 'mechanic' && amount) {
        await api(path + '/quotes', { amount, version: (data.current?.version ?? 0) + 1 });
        setInput('');
      } else if (role === 'customer' && data.current) {
        await api(path + '/quotes/' + encodeURIComponent(data.current.id) + '/accept', {});
      }
    } catch (e) {
      setIssue(e instanceof ApiError && e.status === 409 ? 'conflict' : 'error');
    } finally {
      await reload();
      setBusy(false);
    }
  }
  return (
    <View style={styles.card}>
      <Heading>{c('settlement.pricing')}</Heading>
      {data?.accepted && (
        <>
          <Text>
            {c('settlement.cash')} {taka(data.accepted.amount)}
          </Text>
          <Text>
            {c('settlement.commission')} {taka(data.accepted.fee)}
          </Text>
        </>
      )}
      {data && !data.accepted && <Text>{c('settlement.unagreed')}</Text>}
      {active && data?.current && !data.current.accepted_at && (
        <>
          <Text>
            {c('settlement.proposed')} #{data.current.version} · {taka(data.current.amount)}
          </Text>
          <Text>
            {c('settlement.commission')} {taka(data.current.fee)}
          </Text>
          {role === 'customer' && (
            <Button
              title={c('settlement.accept')}
              disabled={busy || loading}
              onPress={() => void save()}
            />
          )}
        </>
      )}
      {active && data && role === 'mechanic' && (
        <>
          <Field
            label={c('settlement.amount')}
            value={input}
            onChangeText={setInput}
            editable={!busy}
            keyboardType="decimal-pad"
          />
          <Button
            title={c('settlement.propose')}
            disabled={!amount || busy || loading}
            onPress={() => void save()}
          />
        </>
      )}
      {active && data?.needsTopup && (
        <Notice>{c(role === 'mechanic' ? 'settlement.fund' : 'settlement.wait')}</Notice>
      )}
      {onStart && (
        <Button
          title={c('mechanic.action_start_service')}
          disabled={busy || loading || !data?.current?.accepted_at || data.needsTopup}
          onPress={onStart}
        />
      )}
      {(failed || issue) && (
        <Notice>{c(issue === 'conflict' ? 'settlement.conflict' : 'engagement.error')}</Notice>
      )}
      <Button
        title={c('settlement.refresh_quote')}
        disabled={busy || loading}
        onPress={() => {
          setIssue(null);
          void reload();
        }}
      />
    </View>
  );
}
export function Wallet({ api }: { api: Api }) {
  const c = useCopy();
  const { data, loading, failed, reload } = useSnapshot(api, '/wallet/me', readWallet);
  const [input, setInput] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState<'duplicate' | 'error' | null>(null);
  const amount = poisha(input);
  const validReference = /^[a-z0-9]{6,40}$/i.test(reference.trim());
  async function submit() {
    if (!amount || !validReference || busy) return;
    setBusy(true);
    setIssue(null);
    try {
      await api('/wallet/me/topups', { amount, reference: reference.trim().toUpperCase() });
      setInput('');
      setReference('');
    } catch (e) {
      setIssue(e instanceof ApiError && e.status === 409 ? 'duplicate' : 'error');
    } finally {
      await reload();
      setBusy(false);
    }
  }
  return (
    <View style={styles.card}>
      <Heading>{c('settlement.wallet')}</Heading>
      {data && (
        <>
          <Text>
            {c('settlement.balance')} {taka(data.balance)}
          </Text>
          <Text>
            {c('settlement.reserved')} {taka(data.reserved)}
          </Text>
          <Field
            label={c('settlement.amount')}
            value={input}
            onChangeText={setInput}
            keyboardType="decimal-pad"
            editable={!busy}
          />
          <Field
            label={c('settlement.reference')}
            value={reference}
            onChangeText={setReference}
            autoCapitalize="characters"
            editable={!busy}
            maxLength={40}
          />
          <Button
            title={c('settlement.submit')}
            disabled={!validReference || !amount || busy || loading}
            onPress={() => void submit()}
          />
          {data.topups.map((t) => (
            <Text key={t.id}>
              {t.reference} · {taka(t.amount)} · {c(`settlement.${t.status}`)}
            </Text>
          ))}
          {data.entries.length > 0 && <Heading>{c('settlement.history')}</Heading>}
          {data.entries.map((e) => (
            <Text key={e.id}>
              {c(e.kind === 'commission' ? 'settlement.commission_debit' : `settlement.${e.kind}`)}{' '}
              · {taka(e.amount)}
            </Text>
          ))}
        </>
      )}
      {(failed || issue) && (
        <Notice>{c(issue === 'duplicate' ? 'settlement.duplicate' : 'engagement.error')}</Notice>
      )}
      <Button
        title={c('settlement.refresh_wallet')}
        disabled={loading || busy}
        onPress={() => void reload()}
      />
    </View>
  );
}
