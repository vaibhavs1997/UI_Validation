'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  BrowserType,
  CreateScheduleRequest,
  CustomCheck,
  FullScanModuleId,
  Schedule,
  Viewport,
} from '@visionqa/contracts';
import { useProjects } from '@/features/projects/project-context';
import { getCustomChecks } from '@/features/projects/project.service';
import {
  createSchedule,
  deleteSchedule,
  getSchedulePreview,
  getScheduleRuns,
  getSchedules,
  runScheduleNow,
  updateSchedule,
} from '@/features/schedules/schedule.service';

const moduleDefaults: Array<{
  id: FullScanModuleId;
  label: string;
  check: string;
}> = [
  {
    id: 'crawl-site-structure',
    label: 'Crawl & site structure',
    check: 'crawl',
  },
  {
    id: 'links-resources',
    label: 'Links & resources',
    check: 'broken-internal-links',
  },
  {
    id: 'visual-responsive',
    label: 'Visual & responsive',
    check: 'horizontal-overflow',
  },
  {
    id: 'interactions-forms',
    label: 'Interactions & forms',
    check: 'basic-form-validation',
  },
  {
    id: 'browser-network',
    label: 'Browser & network',
    check: 'console-errors',
  },
  {
    id: 'accessibility-seo',
    label: 'Accessibility & SEO',
    check: 'accessible-name',
  },
  {
    id: 'performance-compatibility',
    label: 'Performance & compatibility',
    check: 'core-web-vitals',
  },
];
const browsers: BrowserType[] = ['chromium', 'firefox', 'webkit'];
const viewports: Array<{ label: string; value: Viewport }> = [
  { label: 'Mobile · 390×844', value: { width: 390, height: 844 } },
  { label: 'Tablet · 768×1024', value: { width: 768, height: 1024 } },
  { label: 'Desktop · 1366×768', value: { width: 1366, height: 768 } },
];
const timezones = ['UTC', 'Asia/Kolkata', 'America/New_York', 'Europe/London'];
const emptyRecurrence: import('@visionqa/contracts').ScheduleRecurrence = {
  cadence: 'DAILY',
  time: '09:00',
};

function dateLabel(
  value: string | null | undefined,
  timezone?: string,
): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone ?? 'UTC',
  }).format(new Date(value));
}

function recurrenceLabel(schedule: Schedule): string {
  const { recurrence } = schedule;
  if (recurrence.cadence === 'WEEKLY')
    return `Weekly · day ${recurrence.weekday} · ${recurrence.time}`;
  if (recurrence.cadence === 'MONTHLY')
    return `Monthly · day ${recurrence.dayOfMonth} · ${recurrence.time}`;
  return `Daily · ${recurrence.time}`;
}

export default function SchedulesPage() {
  const { selectedProject } = useProjects();
  const router = useRouter();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runs, setRuns] = useState<
    Record<string, Awaited<ReturnType<typeof getScheduleRuns>>>
  >({});
  const [customChecks, setCustomChecks] = useState<CustomCheck[]>([]);
  const [nextPreview, setNextPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    targetUrl: '',
    scope: 'site' as 'single-page' | 'site',
    cadence: emptyRecurrence.cadence,
    time: emptyRecurrence.time,
    weekday: 1,
    dayOfMonth: 1,
    timezone: 'UTC',
    selectedModules: moduleDefaults.map((item) => item.id),
    selectedCustomCheckIds: [] as string[],
    selectedBrowsers: ['chromium'] as BrowserType[],
    selectedViewports: [viewports[2]!.value] as Viewport[],
  });

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    void getSchedules(selectedProject.id)
      .then(setSchedules)
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : 'Unable to load schedules.',
        ),
      )
      .finally(() => setLoading(false));
  }, [selectedProject?.id]);

  useEffect(() => {
    if (!selectedProject) return;
    void getCustomChecks(selectedProject.id)
      .then((checks) =>
        setCustomChecks(checks.filter((check) => check.enabled)),
      )
      .catch(() => setCustomChecks([]));
  }, [selectedProject?.id]);

  const recurrence = useMemo<import('@visionqa/contracts').ScheduleRecurrence>(
    () => ({
      cadence: form.cadence,
      time: form.time,
      ...(form.cadence === 'WEEKLY' ? { weekday: form.weekday } : {}),
      ...(form.cadence === 'MONTHLY' ? { dayOfMonth: form.dayOfMonth } : {}),
    }),
    [form.cadence, form.dayOfMonth, form.time, form.weekday],
  );
  useEffect(() => {
    if (!selectedProject || !showForm) return;
    let active = true;
    setPreviewLoading(true);
    const timer = setTimeout(() => {
      void getSchedulePreview(selectedProject.id, recurrence, form.timezone)
        .then((value) => {
          if (active) setNextPreview(value);
        })
        .catch(() => {
          if (active) setNextPreview(null);
        })
        .finally(() => {
          if (active) setPreviewLoading(false);
        });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [form.timezone, recurrence, selectedProject, showForm]);

  function openCreate() {
    setEditing(null);
    setForm((current) => ({
      ...current,
      name: '',
      description: '',
      targetUrl: selectedProject?.baseUrl ?? '',
    }));
    setShowForm(true);
  }

  function openEdit(schedule: Schedule) {
    setEditing(schedule);
    setForm({
      name: schedule.name,
      description: schedule.description ?? '',
      targetUrl: schedule.template.target.requestedUrl,
      scope: schedule.template.scope === 'single-page' ? 'single-page' : 'site',
      cadence: schedule.recurrence.cadence,
      time: schedule.recurrence.time,
      weekday: schedule.recurrence.weekday ?? 1,
      dayOfMonth: schedule.recurrence.dayOfMonth ?? 1,
      timezone: schedule.timezone,
      selectedModules:
        schedule.template.modules
          ?.map((item) => item.module)
          .filter((item) => item !== 'custom-checks') ?? [],
      selectedCustomCheckIds: schedule.template.customCheckIds,
      selectedBrowsers: schedule.template.browsers,
      selectedViewports: schedule.template.viewports,
    });
    setShowForm(true);
  }

  function toggleModule(id: FullScanModuleId) {
    setForm((current) => ({
      ...current,
      selectedModules: current.selectedModules.includes(id)
        ? current.selectedModules.filter((item) => item !== id)
        : [...current.selectedModules, id],
    }));
  }

  async function save() {
    if (!selectedProject) return;
    setBusy(true);
    setError(null);
    try {
      const input: CreateScheduleRequest = {
        name: form.name.trim(),
        ...(form.description.trim()
          ? { description: form.description.trim() }
          : {}),
        recurrence,
        timezone: form.timezone,
        template: {
          targetUrl: form.targetUrl.trim(),
          scope: form.scope,
          module: 'full-scan',
          modules: [
            ...form.selectedModules.map((id) => ({
              module: id,
              checks: [
                moduleDefaults.find((item) => item.id === id)?.check ?? 'crawl',
              ],
            })),
            ...(form.selectedCustomCheckIds.length
              ? [
                  {
                    module: 'custom-checks' as const,
                    checks: form.selectedCustomCheckIds,
                  },
                ]
              : []),
          ],
          browsers: form.selectedBrowsers,
          viewports: form.selectedViewports,
          options: {
            maxPages: 100,
            maxBrowserPages: 100,
            maxDepth: 3,
            maxTotalBrowserExecutions: 100,
            captureEvidence: true,
          },
          ...(form.selectedCustomCheckIds.length
            ? { customCheckIds: form.selectedCustomCheckIds }
            : {}),
        },
      };
      const saved = editing
        ? await updateSchedule(selectedProject.id, editing.id, input)
        : await createSchedule(selectedProject.id, input);
      setSchedules((current) =>
        editing
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current],
      );
      setShowForm(false);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to save schedule.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function runNow(schedule: Schedule) {
    if (!selectedProject) return;
    setBusy(true);
    try {
      const result = await runScheduleNow(selectedProject.id, schedule.id);
      router.push(`/scans/${result.scan.id}`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to run schedule.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(schedule: Schedule) {
    if (!selectedProject) return;
    try {
      const updated = await updateSchedule(selectedProject.id, schedule.id, {
        enabled: !schedule.enabled,
      });
      setSchedules((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to update schedule.',
      );
    }
  }

  async function remove(schedule: Schedule) {
    if (
      !selectedProject ||
      !window.confirm(
        `Delete “${schedule.name}”? Historical scans and runs remain.`,
      )
    )
      return;
    try {
      await deleteSchedule(selectedProject.id, schedule.id);
      setSchedules((current) =>
        current.filter((item) => item.id !== schedule.id),
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to delete schedule.',
      );
    }
  }

  async function toggleRuns(schedule: Schedule) {
    if (!selectedProject) return;
    if (expandedId === schedule.id) return setExpandedId(null);
    setExpandedId(schedule.id);
    if (runs[schedule.id]) return;
    try {
      const result = await getScheduleRuns(selectedProject.id, schedule.id);
      setRuns((current) => ({ ...current, [schedule.id]: result }));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to load schedule history.',
      );
    }
  }

  return (
    <section className="scan-page schedules-page">
      <div className="dashboard-overview">
        <div>
          <p className="dashboard-eyebrow">AUTOMATION · DURABLE RECURRENCE</p>
          <h1 className="dashboard-page-title">Schedules</h1>
          <p className="dashboard-lead">
            Reusable scan templates create normal VisionQA scans at explicit
            local times. Editing a schedule never changes its historical runs.
          </p>
        </div>
        <button
          className="dashboard-primary-cta liquid-primary"
          type="button"
          onClick={openCreate}
          disabled={!selectedProject}
        >
          ＋ Create schedule
        </button>
      </div>
      {error && (
        <p className="scan-error" role="alert">
          {error}
        </p>
      )}
      {showForm && (
        <div className="scan-detail-card schedule-form" aria-busy={busy}>
          <div className="full-scan-section-heading">
            <div>
              <h2>{editing ? 'Edit schedule' : 'Create schedule'}</h2>
              <p>
                The template is validated again when each run creates its
                immutable Scan plan.
              </p>
            </div>
            <button
              className="schedule-text-button"
              type="button"
              onClick={() => setShowForm(false)}
            >
              Close
            </button>
          </div>
          <div className="scan-settings-grid">
            <label>
              Name
              <input
                className="liquid-control"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder="Weekly production QA"
              />
            </label>
            <label>
              Target URL
              <input
                className="liquid-control"
                type="url"
                value={form.targetUrl}
                onChange={(event) =>
                  setForm({ ...form, targetUrl: event.target.value })
                }
                placeholder="https://example.com"
              />
            </label>
            <label>
              Scope
              <select
                className="liquid-control"
                value={form.scope}
                onChange={(event) =>
                  setForm({
                    ...form,
                    scope: event.target.value as typeof form.scope,
                  })
                }
              >
                <option value="single-page">Single page</option>
                <option value="site">Site · bounded crawl</option>
              </select>
            </label>
            <label>
              Timezone
              <select
                className="liquid-control"
                value={form.timezone}
                onChange={(event) =>
                  setForm({ ...form, timezone: event.target.value })
                }
              >
                {timezones.map((timezone) => (
                  <option key={timezone}>{timezone}</option>
                ))}
              </select>
            </label>
            <label>
              Description
              <input
                className="liquid-control"
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder="Optional context"
              />
            </label>
          </div>
          <div className="schedule-form-grid">
            <fieldset>
              <legend>Modules &amp; checks</legend>
              {moduleDefaults.map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={form.selectedModules.includes(item.id)}
                    onChange={() => toggleModule(item.id)}
                  />
                  {item.label}
                  <small>{item.check}</small>
                </label>
              ))}
              {customChecks.length > 0 && (
                <>
                  <legend className="schedule-sublegend">Custom checks</legend>
                  {customChecks.map((check) => (
                    <label key={check.id}>
                      <input
                        type="checkbox"
                        checked={form.selectedCustomCheckIds.includes(check.id)}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            selectedCustomCheckIds: event.target.checked
                              ? [...form.selectedCustomCheckIds, check.id]
                              : form.selectedCustomCheckIds.filter(
                                  (item) => item !== check.id,
                                ),
                          })
                        }
                      />
                      {check.name}
                      <small>v{check.version}</small>
                    </label>
                  ))}
                </>
              )}
            </fieldset>
            <fieldset>
              <legend>Browsers</legend>
              {browsers.map((browser) => (
                <label key={browser}>
                  <input
                    type="checkbox"
                    checked={form.selectedBrowsers.includes(browser)}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        selectedBrowsers: event.target.checked
                          ? [...form.selectedBrowsers, browser]
                          : form.selectedBrowsers.filter(
                              (item) => item !== browser,
                            ),
                      })
                    }
                  />
                  {browser}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Viewports</legend>
              {viewports.map((item) => (
                <label key={item.label}>
                  <input
                    type="checkbox"
                    checked={form.selectedViewports.some(
                      (value) =>
                        value.width === item.value.width &&
                        value.height === item.value.height,
                    )}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        selectedViewports: event.target.checked
                          ? [...form.selectedViewports, item.value]
                          : form.selectedViewports.filter(
                              (value) =>
                                value.width !== item.value.width ||
                                value.height !== item.value.height,
                            ),
                      })
                    }
                  />
                  {item.label}
                </label>
              ))}
            </fieldset>
          </div>
          <div className="schedule-timing-row">
            <label>
              Cadence
              <select
                className="liquid-control"
                value={form.cadence}
                onChange={(event) =>
                  setForm({
                    ...form,
                    cadence: event.target.value as typeof form.cadence,
                  })
                }
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </label>
            {form.cadence === 'WEEKLY' && (
              <label>
                Weekday
                <select
                  className="liquid-control"
                  value={form.weekday}
                  onChange={(event) =>
                    setForm({ ...form, weekday: Number(event.target.value) })
                  }
                >
                  {[
                    'Monday',
                    'Tuesday',
                    'Wednesday',
                    'Thursday',
                    'Friday',
                    'Saturday',
                    'Sunday',
                  ].map((day, index) => (
                    <option value={index + 1} key={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {form.cadence === 'MONTHLY' && (
              <label>
                Day of month
                <input
                  className="liquid-control"
                  type="number"
                  min="1"
                  max="31"
                  value={form.dayOfMonth}
                  onChange={(event) =>
                    setForm({ ...form, dayOfMonth: Number(event.target.value) })
                  }
                />
              </label>
            )}
            <label>
              Local time
              <input
                className="liquid-control"
                type="time"
                value={form.time}
                onChange={(event) =>
                  setForm({ ...form, time: event.target.value })
                }
              />
            </label>
          </div>
          <div className="schedule-preview">
            <strong>Next run</strong>
            <span>
              {previewLoading
                ? 'Calculating…'
                : nextPreview
                  ? dateLabel(nextPreview, form.timezone)
                  : 'Enter a valid recurrence and timezone.'}{' '}
              · {form.timezone}
            </span>
            <small>
              Calculated by the API. Monthly day 31 runs only in months
              containing day 31. DST follows the timezone library semantics.
            </small>
          </div>
          <div className="custom-check-form-actions">
            <button
              className="dashboard-primary-button"
              type="button"
              disabled={busy || !selectedProject}
              onClick={() => void save()}
            >
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Create schedule'}
            </button>
            <button
              className="schedule-text-button"
              type="button"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {loading ? (
        <div className="scan-detail-card">
          <p>Loading schedules…</p>
        </div>
      ) : !schedules.length ? (
        <div className="dashboard-empty-state schedule-empty">
          <div className="dashboard-empty-icon">◫</div>
          <p className="dashboard-eyebrow">NO AUTOMATION YET</p>
          <h2>No scheduled scans yet.</h2>
          <p>Create a durable recurring scan for this project.</p>
          <button
            className="dashboard-primary-cta liquid-primary"
            type="button"
            onClick={openCreate}
          >
            Create schedule
          </button>
        </div>
      ) : (
        <div className="schedule-list">
          {schedules.map((schedule) => (
            <article className="schedule-card" key={schedule.id}>
              <div className="schedule-card-heading">
                <div>
                  <h2>{schedule.name}</h2>
                  <p>
                    {schedule.template.target.safeDisplayUrl ??
                      schedule.template.target.requestedUrl}
                  </p>
                </div>
                <span
                  className={`schedule-status ${schedule.enabled ? 'enabled' : 'disabled'}`}
                >
                  {schedule.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="schedule-card-meta">
                <span>
                  <small>Cadence</small>
                  <strong>{recurrenceLabel(schedule)}</strong>
                </span>
                <span>
                  <small>Timezone</small>
                  <strong>{schedule.timezone}</strong>
                </span>
                <span>
                  <small>Next run</small>
                  <strong>
                    {schedule.enabled
                      ? dateLabel(schedule.nextRunAt, schedule.timezone)
                      : '—'}
                  </strong>
                </span>
                <span>
                  <small>Last run</small>
                  <strong>
                    {dateLabel(schedule.lastRunAt, schedule.timezone)}
                  </strong>
                </span>
                <span>
                  <small>Checks</small>
                  <strong>
                    {schedule.template.modules?.reduce(
                      (total, module) => total + module.checks.length,
                      0,
                    ) ?? 0}
                  </strong>
                </span>
              </div>
              <div className="schedule-card-actions">
                <button
                  type="button"
                  onClick={() => void runNow(schedule)}
                  disabled={busy}
                >
                  Run now
                </button>
                <button type="button" onClick={() => openEdit(schedule)}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void toggleEnabled(schedule)}
                >
                  {schedule.enabled ? 'Disable' : 'Enable'}
                </button>
                <button type="button" onClick={() => void toggleRuns(schedule)}>
                  {expandedId === schedule.id ? 'Hide history' : 'History'}
                </button>
                <button
                  className="schedule-danger"
                  type="button"
                  onClick={() => void remove(schedule)}
                >
                  Delete
                </button>
              </div>
              {expandedId === schedule.id && (
                <div className="schedule-runs">
                  {runs[schedule.id]?.runs?.length ? (
                    runs[schedule.id]!.runs.map((run) => (
                      <div className="schedule-run-row" key={run.id}>
                        <span>
                          <strong>
                            {dateLabel(run.scheduledFor, schedule.timezone)}
                          </strong>
                          <small>
                            {run.source === 'MANUAL_RUN_NOW'
                              ? 'Manual Run now'
                              : 'Scheduled occurrence'}
                          </small>
                        </span>
                        <span
                          className={`schedule-run-status ${run.status.toLowerCase()}`}
                        >
                          {run.status}
                        </span>
                        <span>
                          {run.scanId ? (
                            <button
                              type="button"
                              onClick={() =>
                                router.push(`/scans/${run.scanId}`)
                              }
                            >
                              Open scan
                            </button>
                          ) : (
                            (run.skipReason ?? run.errorMessage ?? '—')
                          )}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p>Loading or no runs yet.</p>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
