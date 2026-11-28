import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ApiError, isAvailableJob, isJob, isMechanicProfile, readList } from './api';
import type {
  AvailableJob,
  Job,
  MechanicAction,
  MechanicProfile,
  RequestStatus,
  createApi,
} from './api';
import { MapProvider } from './map/map-provider';
import { JobConversation } from './job-engagement';
import { JobPricing, Wallet } from './settlement';
import { useJobUpdate } from './job-updates';
import {
  isMechanicBackgroundLocationRunning,
  publishCurrentMechanicLocation,
  startMechanicBackgroundLocation,
  stopMechanicBackgroundLocation,
} from './mechanic-location';
import { Button, Field, Heading, Notice, styles, useCopy } from './ui';

const NEXT_ACTION_BY_STATUS: Partial<Record<RequestStatus, MechanicAction>> = {
  assigned: 'start_travel',
  en_route: 'arrive',
  arrived: 'start_service',
  in_progress: 'complete',
};

function parseServiceTypes(input: string): string[] {
  const unique = new Set<string>();
  for (const raw of input.split(',')) {
    const trimmed = raw.trim();
    if (trimmed.length > 0 && trimmed.length <= 50) {
      unique.add(trimmed);
    }
  }
  return [...unique];
}

export function Mechanic({
  api,
  expired,
  userId,
  walletSandbox = false,
}: {
  api: ReturnType<typeof createApi>;
  expired: () => void;
  userId: string;
  walletSandbox?: boolean;
}) {
  const c = useCopy();
  const [tab, setTab] = useState<'available' | 'assigned' | 'profile' | 'wallet'>('available');
  const [profile, setProfile] = useState<MechanicProfile | null>(null);
  const [availableJobs, setAvailableJobs] = useState<AvailableJob[]>([]);
  const [assignedJobs, setAssignedJobs] = useState<Job[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [servicesText, setServicesText] = useState('car, motorcycle');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [locationNotice, setLocationNotice] = useState<
    null | 'updated' | 'failed' | 'bg_denied' | 'bg_unsupported'
  >(null);
  const [bgRunning, setBgRunning] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; action: MechanicAction } | null>(null);

  const handleError = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) expired();
    else setError(true);
  };

  const syncProfileForm = (next: MechanicProfile) => {
    setDisplayName(next.displayName);
    setBio(next.bio ?? '');
    setServicesText(next.serviceTypes.join(', '));
  };

  const loadAll = async (initial = false) => {
    let loadedProfile: MechanicProfile | null = null;
    try {
      const rawProfile = await api('/mechanics/me');
      if (!isMechanicProfile(rawProfile)) throw new Error('Invalid server response');
      loadedProfile = rawProfile;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        loadedProfile = null;
      } else {
        throw e;
      }
    }

    setProfile(loadedProfile);
    if (loadedProfile && initial) {
      syncProfileForm(loadedProfile);
    }

    if (!loadedProfile) {
      setAvailableJobs([]);
      setAssignedJobs([]);
      if (initial) setTab('profile');
      return;
    }

    const [avail, assigned, tracking] = await Promise.all([
      loadedProfile.isOnline ? api('/service-requests/available') : Promise.resolve([]),
      api('/service-requests/assigned/me'),
      isMechanicBackgroundLocationRunning(),
    ]);
    setAvailableJobs(readList(avail, isAvailableJob));
    setAssignedJobs(readList(assigned, isJob));
    setBgRunning(tracking);
  };

  useEffect(() => {
    let active = true;
    loadAll(true)
      .catch((e) => {
        if (active) handleError(e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api]);
  const updateAttempt = useRef(0);
  useEffect(
    () => () => {
      updateAttempt.current += 1;
    },
    [api],
  );
  useJobUpdate(({ jobId, open }) => {
    const current = ++updateAttempt.current;
    void api('/service-requests/assigned/me')
      .then((result) => {
        if (current !== updateAttempt.current) return;
        const updated = readList(result, isJob);
        setAssignedJobs(updated);
        if (open && jobId && updated.some((job) => job.id === jobId)) {
          setTab('assigned');
          setDetail(jobId);
          setConfirm(null);
        }
      })
      .catch(() => undefined);
  });

  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(false);
    setConflict(false);
    setLocationNotice(null);
    try {
      await work();
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  const parsedServices = parseServiceTypes(servicesText);
  const canSaveProfile =
    displayName.trim().length > 0 &&
    displayName.trim().length <= 100 &&
    bio.trim().length <= 500 &&
    parsedServices.length >= 1 &&
    parsedServices.length <= 10;

  return (
    <>
      <Button title={c('mechanic.available_jobs')} onPress={() => setTab('available')} />
      <Button title={c('mechanic.assigned_jobs')} onPress={() => setTab('assigned')} />
      <Button title={c('mechanic.profile_and_status')} onPress={() => setTab('profile')} />
      {walletSandbox && <Button title={c('settlement.wallet')} onPress={() => setTab('wallet')} />}
      {walletSandbox && tab === 'wallet' && <Wallet api={api} />}
      {(loading || busy) && <Text accessibilityLiveRegion="polite">{c('mechanic.loading')}</Text>}
      {error && <Notice>{c('mechanic.unable_to_save_or_load')}</Notice>}
      {conflict && <Notice>{c('mechanic.job_already_taken')}</Notice>}
      <Button
        title={c('mechanic.refresh')}
        disabled={busy}
        onPress={() => void run(() => loadAll())}
      />

      {tab === 'profile' && (
        <>
          <Heading>{c('mechanic.profile_heading')}</Heading>
          {!loading && !profile && <Notice>{c('mechanic.create_profile_first')}</Notice>}
          <Field
            label={c('mechanic.display_name')}
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={100}
          />
          <Field
            label={c('mechanic.bio')}
            value={bio}
            onChangeText={setBio}
            maxLength={500}
            multiline
          />
          <Field
            label={c('mechanic.services')}
            value={servicesText}
            onChangeText={setServicesText}
          />
          <Button
            title={c('mechanic.save_profile')}
            disabled={busy || !canSaveProfile}
            onPress={() =>
              void run(async () => {
                const body: { displayName: string; bio?: string; serviceTypes: string[] } = {
                  displayName: displayName.trim(),
                  serviceTypes: parsedServices,
                };
                if (bio.trim().length > 0) body.bio = bio.trim();
                const saved = await api('/mechanics/me/profile', body, 'PUT');
                if (!isMechanicProfile(saved)) throw new Error('Invalid server response');
                setProfile(saved);
                syncProfileForm(saved);
                await loadAll();
              })
            }
          />

          {profile && (
            <View style={styles.card}>
              <Text>
                {profile.isOnline ? c('mechanic.status_online') : c('mechanic.status_offline')}
              </Text>
              <Button
                title={profile.isOnline ? c('mechanic.go_offline') : c('mechanic.go_online')}
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    const nextOnline = !profile.isOnline;
                    if (!nextOnline) {
                      await stopMechanicBackgroundLocation();
                      setBgRunning(false);
                    }
                    const updated = await api(
                      '/mechanics/me/availability',
                      { isOnline: nextOnline },
                      'PATCH',
                    );
                    if (!isMechanicProfile(updated)) throw new Error('Invalid server response');
                    setProfile(updated);
                    if (nextOnline) {
                      try {
                        await publishCurrentMechanicLocation(api);
                        setLocationNotice('updated');
                      } catch (e) {
                        if (e instanceof ApiError && e.status === 401) throw e;
                        setLocationNotice('failed');
                      }
                    } else {
                      setAvailableJobs([]);
                    }
                    await loadAll();
                  })
                }
              />
              {profile.isOnline && (
                <>
                  <Button
                    title={c('mechanic.update_location_now')}
                    disabled={busy}
                    onPress={() =>
                      void run(async () => {
                        try {
                          const updated = await publishCurrentMechanicLocation(api);
                          setProfile((prev) =>
                            prev ? { ...prev, locationUpdatedAt: updated.locationUpdatedAt } : prev,
                          );
                          setLocationNotice('updated');
                        } catch (e) {
                          if (e instanceof ApiError && e.status === 401) throw e;
                          setLocationNotice('failed');
                        }
                      })
                    }
                  />
                  <Button
                    title={
                      bgRunning
                        ? c('mechanic.stop_background_tracking')
                        : c('mechanic.start_background_tracking')
                    }
                    disabled={busy}
                    onPress={() =>
                      void run(async () => {
                        if (bgRunning) {
                          await stopMechanicBackgroundLocation();
                          setBgRunning(false);
                        } else {
                          const result = await startMechanicBackgroundLocation({
                            userId,
                            title: c('mechanic.bg_notification_title'),
                            body: c('mechanic.bg_notification_body'),
                          });
                          if (result.started) {
                            setBgRunning(true);
                          } else if (result.reason === 'permission_denied') {
                            setLocationNotice('bg_denied');
                          } else if (result.reason === 'unsupported') {
                            setLocationNotice('bg_unsupported');
                          } else {
                            setLocationNotice('failed');
                          }
                        }
                      })
                    }
                  />
                  {bgRunning && <Text>{c('mechanic.background_tracking_active')}</Text>}
                </>
              )}
              {locationNotice === 'updated' && <Text>{c('mechanic.location_updated')}</Text>}
              {locationNotice === 'failed' && (
                <Notice>{c('mechanic.location_update_failed')}</Notice>
              )}
              {locationNotice === 'bg_denied' && (
                <Notice>{c('mechanic.background_tracking_denied')}</Notice>
              )}
              {locationNotice === 'bg_unsupported' && (
                <Notice>{c('mechanic.background_tracking_unsupported')}</Notice>
              )}
            </View>
          )}
        </>
      )}

      {tab === 'available' && (
        <>
          <Heading>{c('mechanic.available_jobs')}</Heading>
          {!loading && !profile && <Notice>{c('mechanic.create_profile_first')}</Notice>}
          {!loading && profile && !error && !profile.isOnline && (
            <Text>{c('mechanic.go_online_to_browse')}</Text>
          )}
          {!loading && profile?.isOnline && !error && !availableJobs.length && (
            <Text>{c('mechanic.no_available_jobs')}</Text>
          )}
          {profile?.isOnline &&
            availableJobs.map((j) => (
              <View key={j.id} style={styles.card}>
                <Text>
                  {j.vehicle.label} ({j.vehicle.type}) · {j.serviceType}
                </Text>
                <Text>{j.description}</Text>
                <Button
                  title={c('mechanic.accept_job')}
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      try {
                        const accepted = await api(
                          '/service-requests/' + encodeURIComponent(j.id) + '/accept',
                          {},
                        );
                        if (!isJob(accepted)) throw new Error('Invalid server response');
                        setDetail(accepted.id);
                        setTab('assigned');
                        await loadAll();
                      } catch (e) {
                        if (e instanceof ApiError && e.status === 409) {
                          setConflict(true);
                          await loadAll();
                          return;
                        }
                        throw e;
                      }
                    })
                  }
                />
              </View>
            ))}
        </>
      )}

      {tab === 'assigned' && (
        <>
          <Heading>{c('mechanic.assigned_jobs')}</Heading>
          {!loading && !error && !assignedJobs.length && (
            <Text>{c('mechanic.no_assigned_jobs')}</Text>
          )}
          {assignedJobs.map((j) => {
            const nextAction = NEXT_ACTION_BY_STATUS[j.status];
            return (
              <View key={j.id} style={styles.card}>
                <Text>
                  {j.vehicle.label} · {j.serviceType}
                </Text>
                <Text>{c(`status.${j.status}`)}</Text>
                <Button
                  title={c('mechanic.view_details')}
                  onPress={() => setDetail(detail === j.id ? null : j.id)}
                />
                {detail === j.id && (
                  <>
                    <Text>{j.description}</Text>
                    <Text>
                      {j.latitude.toFixed(5)}, {j.longitude.toFixed(5)}
                    </Text>
                    {j.vehicle.registrationNumber && <Text>{j.vehicle.registrationNumber}</Text>}
                    <JobConversation key={j.id} job={j} api={api} userId={userId} />
                    {j.priced && (
                      <JobPricing
                        job={j}
                        api={api}
                        role="mechanic"
                        onStart={
                          nextAction === 'start_service' && !busy
                            ? () => setConfirm({ id: j.id, action: 'start_service' })
                            : undefined
                        }
                      />
                    )}
                    <MapProvider
                      center={{ latitude: j.latitude, longitude: j.longitude }}
                      pins={[
                        {
                          id: j.id,
                          coordinate: { latitude: j.latitude, longitude: j.longitude },
                          title: c('mechanic.pickup_pin_title'),
                          description: j.vehicle.label,
                        },
                      ]}
                      title={c('mechanic.pickup_map_title')}
                      attribution={c('mechanic.pickup_map_attribution')}
                    />
                    {nextAction && !(j.priced && nextAction === 'start_service') && (
                      <Button
                        disabled={busy}
                        title={c(`mechanic.action_${nextAction}`)}
                        onPress={() => setConfirm({ id: j.id, action: nextAction })}
                      />
                    )}
                  </>
                )}
              </View>
            );
          })}
          {confirm && (
            <View style={styles.card}>
              <Text>{c('mechanic.confirm_action')}</Text>
              <Button
                title={c('mechanic.confirm')}
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    await api(
                      '/service-requests/' + encodeURIComponent(confirm.id) + '/transitions',
                      { action: confirm.action },
                    );
                    setConfirm(null);
                    await loadAll();
                  })
                }
              />
              <Button
                title={c('mechanic.go_back')}
                disabled={busy}
                onPress={() => setConfirm(null)}
              />
            </View>
          )}
        </>
      )}
    </>
  );
}
