import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { io } from 'socket.io-client';
import { apiUrl } from './auth';
import { watchPushResponses } from './push-installation';

type Update = { jobId?: string; open?: boolean };
const UpdateContext = createContext<Update | undefined>(undefined);
const jobIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export function JobUpdates({ token, children }: PropsWithChildren<{ token: string }>) {
  const [update, setUpdate] = useState<Update>();
  useEffect(() => {
    if (!apiUrl || !token) return;
    const socket = io(apiUrl.replace(/\/$/, '') + '/jobs', {
      transports: ['websocket'],
      auth: { token },
      forceNew: true,
    });
    socket.on('connect', () => setUpdate({}));
    socket.on('job:changed', (data: unknown) => {
      if (
        data &&
        typeof data === 'object' &&
        'jobId' in data &&
        typeof data.jobId === 'string' &&
        jobIdPattern.test(data.jobId)
      ) {
        setUpdate({ jobId: data.jobId });
      }
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') setUpdate({});
    });
    return () => {
      appState.remove();
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [token]);

  useEffect(
    () =>
      watchPushResponses((jobId) => {
        if (jobIdPattern.test(jobId)) setUpdate({ jobId, open: true });
      }),
    [],
  );

  return <UpdateContext.Provider value={update}>{children}</UpdateContext.Provider>;
}

export function useJobUpdate(onUpdate: (update: Update) => void, jobId?: string) {
  const update = useContext(UpdateContext);
  const listener = useRef(onUpdate);
  listener.current = onUpdate;
  useEffect(() => {
    if (update && (!jobId || !update.jobId || update.jobId === jobId)) listener.current(update);
  }, [update, jobId]);
}
