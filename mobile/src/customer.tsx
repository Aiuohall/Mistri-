import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import * as Location from 'expo-location';
import { ApiError, isJob, isNearbyMechanic, isVehicle, readList } from './api';
import type { Job, NearbyMechanic, Vehicle, createApi } from './api';
import { MapProvider } from './map/map-provider';
import { JobConversation, JobReview } from './job-engagement';
import { JobPricing } from './settlement';
import { useJobUpdate } from './job-updates';
import { Button, Field, Heading, Notice, styles, useCopy } from './ui';

const NEARBY_RADIUS_METERS = 5000;
const types = ['car', 'motorcycle', 'cng', 'truck', 'other'] as const;
export function Customer({
  api,
  expired,
  userId,
}: {
  api: ReturnType<typeof createApi>;
  expired: () => void;
  userId?: string;
}) {
  const c = useCopy();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [nearby, setNearby] = useState<NearbyMechanic[] | null>(null);
  const [nearbyPoint, setNearbyPoint] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [tab, setTab] = useState<'jobs' | 'nearby' | 'vehicle' | 'request'>('jobs');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [label, setLabel] = useState('');
  const [type, setType] = useState('car');
  const [vehicleId, setVehicleId] = useState('');
  const [service, setService] = useState('');
  const [description, setDescription] = useState('');
  const [point, setPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; action: string } | null>(null);
  const locationAttempt = useRef(0);
  const validText = (value: string, max: number) =>
    value.trim().length > 0 && value.trim().length <= max;
  const changeTab = (next: typeof tab) => {
    locationAttempt.current += 1;
    setPoint(null);
    setNearbyPoint(null);
    setNearby(null);
    setLocationError(false);
    setConfirm(null);
    setTab(next);
  };
  const handleError = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) expired();
    else setError(true);
  };
  const refresh = async () => {
    const [v, j] = await Promise.all([api('/vehicles'), api('/service-requests/mine')]);
    setVehicles(readList(v, isVehicle));
    setJobs(readList(j, isJob));
  };
  useEffect(() => {
    let active = true;
    Promise.all([api('/vehicles'), api('/service-requests/mine')])
      .then(([v, j]) => {
        if (active) {
          setVehicles(readList(v, isVehicle));
          setJobs(readList(j, isJob));
        }
      })
      .catch((e) => {
        if (active) handleError(e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      locationAttempt.current += 1;
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
    void api('/service-requests/mine')
      .then((result) => {
        if (current !== updateAttempt.current) return;
        const updated = readList(result, isJob);
        setJobs(updated);
        if (open && jobId && updated.some((job) => job.id === jobId)) {
          changeTab('jobs');
          setDetail(jobId);
        }
      })
      .catch(() => undefined);
  });
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await work();
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }
  async function locate() {
    const attempt = ++locationAttempt.current;
    setPoint(null);
    setLocationError(false);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (attempt !== locationAttempt.current) return;
      if (!permission.granted) throw new Error('Permission denied');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (attempt !== locationAttempt.current) return;
      const { latitude, longitude } = location.coords;
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 ||
        Math.abs(longitude) > 180
      )
        throw new Error('Invalid location');
      setPoint({ latitude, longitude });
    } catch {
      if (attempt === locationAttempt.current) setLocationError(true);
    }
  }
  async function searchNearby() {
    const attempt = ++locationAttempt.current;
    setNearbyPoint(null);
    setLocationError(false);
    let coords: { latitude: number; longitude: number };
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (attempt !== locationAttempt.current) return;
      if (!permission.granted) throw new Error('Permission denied');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (attempt !== locationAttempt.current) return;
      const { latitude, longitude } = location.coords;
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 ||
        Math.abs(longitude) > 180
      )
        throw new Error('Invalid location');
      coords = { latitude, longitude };
    } catch {
      if (attempt === locationAttempt.current) setLocationError(true);
      return;
    }
    const query =
      '/mechanics/nearby?latitude=' +
      encodeURIComponent(String(coords.latitude)) +
      '&longitude=' +
      encodeURIComponent(String(coords.longitude)) +
      '&radiusMeters=' +
      String(NEARBY_RADIUS_METERS);
    const results = await api(query);
    if (attempt !== locationAttempt.current) return;
    setNearbyPoint(coords);
    setNearby(readList(results, isNearbyMechanic));
  }
  return (
    <>
      <Button title={c('customer.my_requests')} onPress={() => changeTab('jobs')} />
      <Button title={c('customer.nearby_mechanics')} onPress={() => changeTab('nearby')} />
      <Button title={c('customer.add_vehicle')} onPress={() => changeTab('vehicle')} />
      <Button title={c('customer.request_help')} onPress={() => changeTab('request')} />
      {(loading || busy) && <Text accessibilityLiveRegion="polite">{c('customer.loading')}</Text>}
      {error && <Notice>{c('customer.unable_to_save_or_load_check_your')}</Notice>}
      <Button title={c('customer.refresh')} disabled={busy} onPress={() => void run(refresh)} />
      {tab === 'nearby' && (
        <>
          <Heading>{c('customer.nearby_mechanics')}</Heading>
          <Text>{c('customer.search_nearby_prompt')}</Text>
          <Button
            title={c('customer.find_nearby_mechanics')}
            disabled={busy}
            onPress={() => void run(searchNearby)}
          />
          {locationError && (
            <Notice>{c('customer.location_unavailable_enable_location_permission_and_try')}</Notice>
          )}
          {nearbyPoint && (
            <MapProvider
              center={nearbyPoint}
              radiusMeters={NEARBY_RADIUS_METERS}
              pins={[
                {
                  id: 'customer-location',
                  coordinate: nearbyPoint,
                  title: c('customer.your_location_pin'),
                },
              ]}
              title={c('customer.nearby_map_title')}
              attribution={c('customer.nearby_map_attribution')}
            />
          )}
          {nearby && !nearby.length && <Text>{c('customer.no_nearby_mechanics')}</Text>}
          {nearby?.map((m) => (
            <View key={m.userId} style={styles.card}>
              <Text>{m.displayName}</Text>
              {typeof m.averageRating === 'number' && typeof m.reviewCount === 'number' && (
                <Text>
                  {m.averageRating.toFixed(1)}/5 · {m.reviewCount} {c('engagement.rating_count')}
                </Text>
              )}
              {m.bio && <Text>{m.bio}</Text>}
              <Text>{m.serviceTypes.join(', ')}</Text>
              <Text>
                {m.distanceMeters >= 1000
                  ? `${(m.distanceMeters / 1000).toFixed(1)} ${c('customer.distance_km')}`
                  : `${m.distanceMeters} ${c('customer.distance_meters')}`}
              </Text>
            </View>
          ))}
        </>
      )}
      {tab === 'vehicle' && (
        <>
          <Heading>{c('customer.your_vehicles')}</Heading>
          {!loading && !error && !vehicles.length && (
            <Text>{c('customer.add_your_first_vehicle_to_request_help')}</Text>
          )}
          {vehicles.map((v) => (
            <Text key={v.id}>{v.label}</Text>
          ))}
          <Field
            label={c('customer.vehicle_name')}
            value={label}
            onChangeText={setLabel}
            maxLength={100}
          />
          {types.map((t) => (
            <Button
              key={t}
              title={(type === t ? '✓ ' : '') + c(`vehicleType.${t}`)}
              onPress={() => setType(t)}
            />
          ))}
          <Button
            title={c('customer.save_vehicle')}
            disabled={busy || !validText(label, 100)}
            onPress={() =>
              void run(async () => {
                await api('/vehicles', { label: label.trim(), type });
                setLabel('');
                await refresh();
                setTab('request');
              })
            }
          />
        </>
      )}
      {tab === 'request' && (
        <>
          <Heading>{c('customer.where_do_you_need_help')}</Heading>
          {!loading && !error && !vehicles.length && (
            <Text>{c('customer.add_a_vehicle_first')}</Text>
          )}
          {vehicles.map((v) => (
            <Button
              key={v.id}
              title={(vehicleId === v.id ? '✓ ' : '') + v.label}
              onPress={() => setVehicleId(v.id)}
            />
          ))}
          <Field
            label={c('customer.service_needed')}
            value={service}
            onChangeText={setService}
            maxLength={50}
          />
          <Field
            label={c('customer.describe_the_problem')}
            value={description}
            onChangeText={setDescription}
            maxLength={1000}
            multiline
          />
          <Button
            title={c('customer.use_my_current_location')}
            disabled={busy}
            onPress={() => void run(locate)}
          />
          {locationError && (
            <Notice>{c('customer.location_unavailable_enable_location_permission_and_try')}</Notice>
          )}
          {point && (
            <Text>
              {c('customer.pickup_coordinates')}: {point.latitude.toFixed(5)},{' '}
              {point.longitude.toFixed(5)}
            </Text>
          )}
          <Text>{c('customer.review_your_location_before_sending_exact_pickup')}</Text>
          <Button
            title={c('customer.send_request')}
            disabled={
              busy ||
              !point ||
              !vehicles.some((v) => v.id === vehicleId) ||
              !validText(service, 50) ||
              !validText(description, 1000)
            }
            onPress={() =>
              void run(async () => {
                if (!point) return;
                await api('/service-requests', {
                  vehicleId,
                  serviceType: service.trim(),
                  description: description.trim(),
                  ...point,
                });
                setPoint(null);
                setDescription('');
                setService('');
                setTab('jobs');
                await refresh();
              })
            }
          />
        </>
      )}
      {tab === 'jobs' && (
        <>
          <Heading>{c('customer.my_requests')}</Heading>
          {!loading && !error && !jobs.length && <Text>{c('customer.no_requests_yet')}</Text>}
          {jobs.map((j) => (
            <View key={j.id} style={styles.card}>
              <Text>
                {j.vehicle.label} · {j.serviceType}
              </Text>
              <Text>{c(`status.${j.status}`)}</Text>
              <Button
                title={c('customer.view_details')}
                onPress={() => setDetail(detail === j.id ? null : j.id)}
              />
              {detail === j.id && (
                <>
                  <Text>{j.description}</Text>
                  <Text>
                    {j.latitude}, {j.longitude}
                  </Text>
                  {j.vehicle.registrationNumber && <Text>{j.vehicle.registrationNumber}</Text>}
                  {j.mechanic && <Text>{j.mechanic.displayName}</Text>}
                  {j.mechanic && <JobConversation key={j.id} job={j} api={api} userId={userId} />}
                  {j.priced && <JobPricing job={j} api={api} role="customer" />}
                  {(j.status === 'completed' || j.status === 'paid') && (
                    <JobReview jobId={j.id} api={api} />
                  )}
                  {(j.status === 'open' || j.status === 'completed') && (
                    <Button
                      disabled={busy}
                      title={
                        j.status === 'open'
                          ? c('customer.cancel_request')
                          : c('customer.confirm_cash_paid')
                      }
                      onPress={() =>
                        setConfirm({
                          id: j.id,
                          action: j.status === 'open' ? 'cancel' : 'confirm-cash-payment',
                        })
                      }
                    />
                  )}
                </>
              )}
            </View>
          ))}
          {confirm && (
            <View style={styles.card}>
              <Text>{c('customer.confirm_this_action')}</Text>
              <Button
                title={c('customer.confirm')}
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    await api(
                      '/service-requests/' + encodeURIComponent(confirm.id) + '/' + confirm.action,
                      {},
                    );
                    setConfirm(null);
                    await refresh();
                  })
                }
              />
              <Button
                title={c('customer.go_back')}
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
