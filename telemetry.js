/**
 * PopStacks: Art Toy Atelier — Cookieless PostHog Edge Telemetry
 * Endpoint: https://t.dailypickem.net/i/v0/e/ ($process_person_profile: false)
 */
(function () {
  'use strict';

  const ENDPOINT = 'https://t.dailypickem.net/i/v0/e/';
  const API_KEY = 'phc_ApujkhukihgCLubmryssShJRTKMUXpiVDuVd7An6YjfV';
  const APP_SLUG = 'popstacks';
  const APP_VERSION = '1.0.1';
  const ID_KEY = 'popstacks_distinct_id_v1';

  const Cap = typeof window !== 'undefined' ? window.Capacitor : null;
  const isNative = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());
  const platform = isNative && typeof Cap.getPlatform === 'function' ? Cap.getPlatform() : 'web';
  const host = typeof location !== 'undefined' && location.hostname ? location.hostname : (isNative ? 'native' : 'unknown');
  const isHeadless = Boolean(
    typeof navigator !== 'undefined' &&
    (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent || ''))
  );
  const isStaging = Boolean(
    !isNative && (host.startsWith('test.') || host === '127.0.0.1' || host === 'localhost')
  );

  let distinctId = '';
  try {
    distinctId = (window.localStorage && window.localStorage.getItem(ID_KEY)) || '';
    if (!distinctId) {
      distinctId = 'ps_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
      if (window.localStorage) window.localStorage.setItem(ID_KEY, distinctId);
    }
  } catch (_e) {
    distinctId = 'ps_anon_' + Math.random().toString(36).slice(2, 10);
  }

  let ctxFn = null;
  let sessionStarted = false;
  let firstBurstSent = false;
  let firstUpgradeSent = false;
  let midGateSent = false;
  let reviveOfferSentThisLoss = false;

  function sendBeaconPayload(payload) {
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
        if (navigator.sendBeacon(ENDPOINT, blob)) return true;
      } catch (_e) {}
    }
    if (typeof fetch === 'function') {
      try {
        void fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body,
          keepalive: true
        }).catch(() => {});
        return true;
      } catch (_e) {}
    }
    return false;
  }

  window.PopStacksTelemetry = {
    setContextProvider(fn) {
      ctxFn = typeof fn === 'function' ? fn : null;
    },
    track(event, props = {}) {
      if (!event) return false;
      const baseCtx = ctxFn ? (ctxFn() || {}) : {};
      const properties = {
        $process_person_profile: false,
        app: APP_SLUG,
        app_version: APP_VERSION,
        platform,
        host,
        is_headless: isHeadless,
        is_staging: isStaging,
        is_qa: isHeadless || isStaging,
        ...baseCtx,
        ...props
      };
      if (!Array.isArray(window.__popstacksTelemetryEvents)) {
        window.__popstacksTelemetryEvents = [];
      }
      window.__popstacksTelemetryEvents.push({ event, t: Date.now(), properties });
      if (window.__popstacksTelemetryEvents.length > 80) {
        window.__popstacksTelemetryEvents.shift();
      }
      return sendBeaconPayload({
        api_key: API_KEY,
        event,
        distinct_id: distinctId,
        properties
      });
    },
    trackSessionStart(extra = {}) {
      if (sessionStarted) return false;
      sessionStarted = true;
      return this.track('session_start', {
        screen_width: typeof window !== 'undefined' ? window.innerWidth : 0,
        screen_height: typeof window !== 'undefined' ? window.innerHeight : 0,
        ...extra
      });
    },
    resetRunFlags() {
      reviveOfferSentThisLoss = false;
    },
    trackFirstBurst(extra = {}) {
      if (firstBurstSent) return false;
      firstBurstSent = true;
      return this.track('first_kill', extra);
    },
    trackFirstUpgrade(extra = {}) {
      if (firstUpgradeSent) return false;
      firstUpgradeSent = true;
      return this.track('first_levelup', extra);
    },
    trackMidSessionGate(extra = {}) {
      if (midGateSent) return false;
      midGateSent = true;
      return this.track('3min_mini_boss_reached', extra);
    },
    trackReviveOffered(extra = {}) {
      if (reviveOfferSentThisLoss) return false;
      reviveOfferSentThisLoss = true;
      return this.track('revive_ad_offered', extra);
    }
  };
})();
