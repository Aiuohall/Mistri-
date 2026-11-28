import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AppState, Text } from 'react-native';
import { apiUrl, auth } from './auth';
import { ApiError, createApi } from './api';
import { Customer } from './customer';
import { Mechanic } from './mechanic';
import { JobUpdates } from './job-updates';
import {
  disablePush,
  enablePush,
  refreshPush,
  supportsPush,
  watchPushToken,
} from './push-installation';
import { stopMechanicBackgroundLocation } from './mechanic-location';
import { Button, Field, Heading, Notice, useCopy } from './ui';
import type { TranslationKey } from './i18n/translations';

export function Account() {
  const c = useCopy();
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [role, setRole] = useState<'loading' | 'customer' | 'mechanic' | 'denied' | 'error'>(
    'loading',
  );
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);
  const [walletSandbox, setWalletSandbox] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [authIssue, setAuthIssue] = useState<TranslationKey | null>(null);
  const [sent, setSent] = useState(false);
  const [retry, setRetry] = useState(0);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushError, setPushError] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
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
              setWalletSandbox(
                !!profile &&
                  typeof profile === 'object' &&
                  'walletSandbox' in profile &&
                  profile.walletSandbox === true,
              );
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
  useEffect(() => {
    setPushEnabled(false);
    setPushError(false);
    if (!supportsPush || !verifiedUserId || verifiedUserId !== session?.user.id) return;
    let active = true;
    const refresh = () => {
      void refreshPush(api, verifiedUserId)
        .then((enabled) => {
          if (active) setPushEnabled(enabled);
        })
        .catch(() => undefined);
    };
    refresh();
    const stopWatchingToken = watchPushToken(api, verifiedUserId);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      active = false;
      sub.remove();
      stopWatchingToken();
    };
  }, [api, session?.user.id, verifiedUserId]);
  async function togglePush(userId: string) {
    setPushBusy(true);
    setPushError(false);
    try {
      if (pushEnabled) {
        await disablePush(api, userId);
        setPushEnabled(false);
      } else {
        const enabled = await enablePush(api, userId);
        setPushEnabled(enabled);
        setPushError(!enabled);
      }
    } catch {
      setPushError(true);
    } finally {
      setPushBusy(false);
    }
  }
  async function signOut() {
    setSession(null);
    setPassword('');
    setVerifiedUserId(null);
    void stopMechanicBackgroundLocation();
    try {
      if (session) await disablePush(api, session.user.id).catch(() => undefined);
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
    setAuthIssue(null);
    setSent(false);
    try {
      const result = register
        ? await auth.auth.signUp({ email: email.trim(), password })
        : await auth.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (result.data.session) setSession(result.data.session);
      setPassword('');
      setSent(register && !result.data.session);
    } catch (failure) {
      const detail = failure as { code?: string; name?: string; message?: string };
      if (detail.code === 'email_not_confirmed') {
        setAuthIssue('account.auth_email_not_confirmed');
      } else if (detail.code === 'invalid_credentials') {
        setAuthIssue('account.auth_invalid_credentials');
      } else if (
        detail.name === 'AuthRetryableFetchError' ||
        /fetch|network|timeout/i.test(detail.message ?? '')
      ) {
        setAuthIssue('account.auth_connection_error');
      } else if (detail.code === 'weak_password') {
        setAuthIssue('account.auth_weak_password');
      } else {
        setAuthIssue('account.auth_unknown_error');
      }
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
        {(error || authIssue) && (
          <Notice>
            {c(authIssue ?? 'account.signin_failed_check_your_details_and_connection')}
          </Notice>
        )}
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
      <Button title={c('account.sign_out')} disabled={pushBusy} onPress={() => void signOut()} />
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
      {verifiedUserId === session.user.id && (role === 'customer' || role === 'mechanic') && (
        <JobUpdates key={session.user.id} token={session.access_token}>
          {supportsPush && (
            <Button
              title={c(pushEnabled ? 'engagement.disable_push' : 'engagement.enable_push')}
              disabled={pushBusy}
              onPress={() => void togglePush(session.user.id)}
            />
          )}
          {pushError && <Notice>{c('engagement.push_unavailable')}</Notice>}
          {role === 'customer' ? (
            <Customer userId={session.user.id} api={api} expired={() => void signOut()} />
          ) : (
            <Mechanic
              userId={session.user.id}
              api={api}
              expired={() => void signOut()}
              walletSandbox={walletSandbox}
            />
          )}
        </JobUpdates>
      )}
    </>
  );
}
