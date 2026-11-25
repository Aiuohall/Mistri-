import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AppState, Text } from 'react-native';
import { apiUrl, auth } from './auth';
import { ApiError, createApi } from './api';
import { Customer } from './customer';
import { Mechanic } from './mechanic';
import { stopMechanicBackgroundLocation } from './mechanic-location';
import { Button, Field, Heading, Notice, useCopy } from './ui';

export function Account() {
  const c = useCopy();
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [role, setRole] = useState<'loading' | 'customer' | 'mechanic' | 'denied' | 'error'>(
    'loading',
  );
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [sent, setSent] = useState(false);
  const [retry, setRetry] = useState(0);
  const api = useMemo(
    () =>
      createApi(apiUrl, async () => {
        const current = (await auth?.auth.getSession())?.data.session;
        return current && current.user.id === session?.user.id ? current.access_token : undefined;
      }),
    [session?.user.id],
  );
  useEffect(() => {
    if (!auth) {
      setRestoring(false);
      return;
    }
    let active = true;
    auth.auth
      .getSession()
      .then(({ data, error }) => {
        if (active) {
          setSession(data.session);
          setError(!!error);
          setRestoring(false);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
          setRestoring(false);
        }
      });
    const { data } = auth.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setRestoring(false);
    });
    if (AppState.currentState === 'active') auth.auth.startAutoRefresh();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') auth?.auth.startAutoRefresh();
      else auth?.auth.stopAutoRefresh();
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
      listener.remove();
      auth?.auth.stopAutoRefresh();
    };
  }, []);
  useEffect(() => {
    let active = true;
    setRole('loading');
    setVerifiedUserId(null);
    if (session)
      api('/auth/me')
        .then((profile) => {
          if (active) {
            const nextRole =
              profile && typeof profile === 'object' && 'role' in profile ? profile.role : null;
            if (nextRole === 'customer' || nextRole === 'mechanic') {
              setRole(nextRole);
              setVerifiedUserId(session.user.id);
            } else {
              setRole('denied');
            }
          }
        })
        .catch((error) => {
          if (active) {
            if (error instanceof ApiError && error.status === 401) {
              setSession(null);
              void auth?.auth.signOut({ scope: 'local' }).catch(() => undefined);
            } else setRole('error');
          }
        });
    return () => {
      active = false;
    };
  }, [session?.user.id, api, retry]);
  async function signOut() {
    setSession(null);
    setPassword('');
    setVerifiedUserId(null);
    void stopMechanicBackgroundLocation();
    try {
      const result = await auth?.auth.signOut({ scope: 'local' });
      if (result?.error) setError(true);
    } catch {
      setError(true);
    }
  }
  async function signIn(register: boolean) {
    if (!auth || busy) return;
    setBusy(true);
    setError(false);
    setSent(false);
    try {
      const result = register
        ? await auth.auth.signUp({ email: email.trim(), password })
        : await auth.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      setPassword('');
      setSent(register && !result.data.session);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  if (!auth) return <Notice>{c('account.signin_is_not_available_yet_please_try')}</Notice>;
  if (restoring) return <Text>{c('account.restoring_session')}</Text>;
  if (!session)
    return (
      <>
        <Heading>{c('account.welcome')}</Heading>
        <Field
          label={c('account.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Field
          label={c('account.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
        />
        {error && <Notice>{c('account.signin_failed_check_your_details_and_connection')}</Notice>}
        {sent && <Text>{c('account.check_your_email_to_confirm_your_account')}</Text>}
        <Button
          title={c('account.sign_in')}
          disabled={busy || !email.trim() || !password}
          onPress={() => void signIn(false)}
        />
        <Button
          title={c('account.create_account')}
          disabled={busy || !email.trim() || password.length < 8}
          onPress={() => void signIn(true)}
        />
      </>
    );
  return (
    <>
      <Button title={c('account.sign_out')} onPress={() => void signOut()} />
      {error && <Notice>{c('account.please_try_again')}</Notice>}
      {role === 'loading' && <Text>{c('account.checking_account')}</Text>}
      {role === 'denied' && (
        <Notice>{c('account.this_app_currently_supports_customer_accounts')}</Notice>
      )}
      {role === 'error' && (
        <>
          <Notice>{c('account.unable_to_load_your_account')}</Notice>
          <Button title={c('account.try_again')} onPress={() => setRetry((value) => value + 1)} />
        </>
      )}
      {role === 'customer' && verifiedUserId === session.user.id && (
        <Customer key={session.user.id} api={api} expired={() => void signOut()} />
      )}
      {role === 'mechanic' && verifiedUserId === session.user.id && (
        <Mechanic
          key={session.user.id}
          userId={session.user.id}
          api={api}
          expired={() => void signOut()}
        />
      )}
    </>
  );
}
