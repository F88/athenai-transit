import { describe, expect, it } from 'vitest';
import { Resource, LocalResource, RemoteResource } from './odpt-resources';

const now = new Date('2026-04-01T00:00:00Z');

function makeResource(from: string | null, to: string | null) {
  return new Resource('https://example.com/test.zip', from, to);
}

describe('Resource', () => {
  describe('getPeriodStatus', () => {
    // -----------------------------------------------------------------------
    // from あり + to あり (3 states)
    // -----------------------------------------------------------------------

    it('1. before: today < from (both dates known)', () => {
      const r = makeResource('2026-05-01', '2026-12-31');
      expect(r.getPeriodStatus(now)).toBe('before');
    });

    it('2. in: from <= today <= to (both dates known)', () => {
      const r = makeResource('2026-03-01', '2026-12-31');
      expect(r.getPeriodStatus(now)).toBe('in');
    });

    it('2. in: today equals from (boundary)', () => {
      const r = makeResource('2026-04-01', '2026-12-31');
      expect(r.getPeriodStatus(now)).toBe('in');
    });

    it('2. in: today equals to (boundary)', () => {
      const r = makeResource('2026-03-01', '2026-04-01');
      expect(r.getPeriodStatus(now)).toBe('in');
    });

    it('3. after: today > to (both dates known)', () => {
      const r = makeResource('2025-01-01', '2026-03-31');
      expect(r.getPeriodStatus(now)).toBe('after');
    });

    // -----------------------------------------------------------------------
    // from あり + to null (2 states)
    // -----------------------------------------------------------------------

    it('4. before-no-end: today < from, to unknown', () => {
      const r = makeResource('2026-05-01', null);
      expect(r.getPeriodStatus(now)).toBe('before-no-end');
    });

    it('5. in-no-end: today >= from, to unknown', () => {
      const r = makeResource('2026-03-01', null);
      expect(r.getPeriodStatus(now)).toBe('in-no-end');
    });

    it('5. in-no-end: today equals from (boundary)', () => {
      const r = makeResource('2026-04-01', null);
      expect(r.getPeriodStatus(now)).toBe('in-no-end');
    });

    // -----------------------------------------------------------------------
    // from null + to あり (2 states)
    // -----------------------------------------------------------------------

    it('6. in-no-start: today <= to, from unknown', () => {
      const r = makeResource(null, '2026-12-31');
      expect(r.getPeriodStatus(now)).toBe('in-no-start');
    });

    it('6. in-no-start: today equals to (boundary)', () => {
      const r = makeResource(null, '2026-04-01');
      expect(r.getPeriodStatus(now)).toBe('in-no-start');
    });

    it('7. after-no-start: today > to, from unknown', () => {
      const r = makeResource(null, '2026-03-31');
      expect(r.getPeriodStatus(now)).toBe('after-no-start');
    });

    // -----------------------------------------------------------------------
    // both null (1 state)
    // -----------------------------------------------------------------------

    it('8. unknown: both dates null', () => {
      const r = makeResource(null, null);
      expect(r.getPeriodStatus(now)).toBe('unknown');
    });
  });

  describe('url stripping', () => {
    it('strips acl:consumerKey from url on construction', () => {
      const r = new Resource(
        'https://api.odpt.org/test.zip?date=20260401&acl:consumerKey=SECRET_TOKEN',
        null,
        null,
      );
      expect(r.url).toBe('https://api.odpt.org/test.zip?date=20260401');
      expect(r.url).not.toContain('consumerKey');
    });

    it('keeps url unchanged when no auth params', () => {
      const r = new Resource('https://api-public.odpt.org/test.zip?date=20260401', null, null);
      expect(r.url).toBe('https://api-public.odpt.org/test.zip?date=20260401');
    });

    it('strips acl:consumerKey when it appears first in query', () => {
      const r = new Resource(
        'https://api.odpt.org/test.zip?acl:consumerKey=TOKEN&date=20260401',
        null,
        null,
      );
      expect(r.url).not.toContain('consumerKey');
      expect(r.url).toContain('date=20260401');
    });

    it('strips all occurrences of acl:consumerKey', () => {
      const r = new Resource(
        'https://api.odpt.org/test.zip?acl:consumerKey=TOKEN1&date=20260401&acl:consumerKey=TOKEN2',
        null,
        null,
      );
      expect(r.url).not.toContain('consumerKey');
      expect(r.url).toContain('date=20260401');
    });

    it('redacts malformed URL entirely to prevent credential leakage', () => {
      const r = new Resource('not-a-valid-url?acl:consumerKey=LEAKED', null, null);
      expect(r.url).toBe('[malformed-url-redacted]');
      expect(r.url).not.toContain('LEAKED');
    });
  });
});

describe('LocalResource', () => {
  it('constructor stores all properties', () => {
    const r = new LocalResource(
      {
        url: 'https://api.odpt.org/test.zip?date=20260401',
        from: '2026-04-01',
        to: '2026-12-31',
        downloadedAt: '2026-04-01T05:00:00Z',
        feedVersion: 'v1',
      },
      [],
    );
    expect(r.url).toBe('https://api.odpt.org/test.zip?date=20260401');
    expect(r.from).toBe('2026-04-01');
    expect(r.to).toBe('2026-12-31');
    expect(r.downloadedAt).toBe('2026-04-01T05:00:00Z');
    expect(r.feedVersion).toBe('v1');
  });

  it('inherits getPeriodStatus from Resource', () => {
    const r = new LocalResource(
      {
        url: 'https://api.odpt.org/test.zip?date=20260401',
        from: '2026-04-01',
        to: '2026-12-31',
        downloadedAt: '2026-04-01T05:00:00Z',
      },
      [],
    );
    expect(r.getPeriodStatus(now)).toBe('in');
  });

  it('inherits isExpiringSoon from Resource', () => {
    const r = new LocalResource(
      {
        url: 'https://api.odpt.org/test.zip?date=20260401',
        from: '2026-03-01',
        to: '2026-04-05',
        downloadedAt: '2026-03-01T00:00:00Z',
      },
      [],
    );
    expect(r.isExpiringSoon(now, 10)).toBe(true);
    expect(r.isExpiringSoon(now, 1)).toBe(false);
  });

  it('strips auth params from url', () => {
    const r = new LocalResource(
      {
        url: 'https://api.odpt.org/test.zip?date=20260401&acl:consumerKey=TOKEN',
        from: null,
        to: null,
        downloadedAt: '2026-04-01T00:00:00Z',
      },
      [],
    );
    expect(r.url).not.toContain('consumerKey');
  });

  describe('isAdopted', () => {
    it('true when URL matches a remote URL (auth stripped)', () => {
      const r = new LocalResource(
        {
          url: 'https://api.odpt.org/test.zip?date=20260401&acl:consumerKey=LOCAL_TOKEN',
          from: '2026-04-01',
          to: '2026-12-31',
          downloadedAt: '2026-04-01T00:00:00Z',
        },
        ['https://api.odpt.org/test.zip?date=20260401&acl:consumerKey=REMOTE_TOKEN'],
      );
      expect(r.isAdopted()).toBe(true);
    });

    it('false when URL does not match any remote URL', () => {
      const r = new LocalResource(
        {
          url: 'https://api.odpt.org/test.zip?date=20260401',
          from: '2026-04-01',
          to: '2026-12-31',
          downloadedAt: '2026-04-01T00:00:00Z',
        },
        ['https://api.odpt.org/test.zip?date=20260402'],
      );
      expect(r.isAdopted()).toBe(false);
    });

    it('false when remote list is empty', () => {
      const r = new LocalResource(
        {
          url: 'https://api.odpt.org/test.zip?date=20260401',
          from: '2026-04-01',
          to: '2026-12-31',
          downloadedAt: '2026-04-01T00:00:00Z',
        },
        [],
      );
      expect(r.isAdopted()).toBe(false);
    });
  });
});

describe('RemoteResource', () => {
  it('constructor stores all properties', () => {
    const r = new RemoteResource(
      {
        url: 'https://api.odpt.org/test.zip?date=20260401&acl:consumerKey=TOKEN',
        from: '2026-04-01',
        to: '2026-09-28',
        startAt: '2026-04-01',
        uploadedAt: '2026-03-25T09:00:00+09:00',
      },
      null,
      null,
    );
    expect(r.url).toBe('https://api.odpt.org/test.zip?date=20260401');
    expect(r.from).toBe('2026-04-01');
    expect(r.to).toBe('2026-09-28');
    expect(r.startAt).toBe('2026-04-01');
    expect(r.uploadedAt).toBe('2026-03-25T09:00:00+09:00');
  });

  it('constructor strips auth params from url', () => {
    const r = new RemoteResource(
      {
        url: 'https://api.odpt.org/test.zip?date=20260401&acl:consumerKey=SECRET',
        from: null,
        to: null,
        startAt: '2026-04-01',
        uploadedAt: '2026-03-25T00:00:00Z',
      },
      null,
      null,
    );
    expect(r.url).not.toContain('consumerKey');
    expect(r.url).toContain('date=20260401');
  });

  it('inherits getPeriodStatus from Resource', () => {
    const r = new RemoteResource(
      {
        url: 'https://api.odpt.org/test.zip?date=20260401',
        from: '2026-04-01',
        to: '2026-09-28',
        startAt: '2026-04-01',
        uploadedAt: '2026-03-25T00:00:00Z',
      },
      null,
      null,
    );
    expect(r.getPeriodStatus(now)).toBe('in');
  });

  it('inherits isExpiringSoon from Resource', () => {
    const r = new RemoteResource(
      {
        url: 'https://api.odpt.org/test.zip?date=20260401',
        from: '2026-03-01',
        to: '2026-04-05',
        startAt: '2026-03-01',
        uploadedAt: '2026-03-01T00:00:00Z',
      },
      null,
      null,
    );
    expect(r.isExpiringSoon(now, 10)).toBe(true);
    expect(r.isExpiringSoon(now, 1)).toBe(false);
  });

  describe('isNew', () => {
    it('true when URL not in snapshot', () => {
      const r = new RemoteResource(
        {
          url: 'https://api.odpt.org/test.zip?date=20260401',
          from: '2026-04-01',
          to: '2026-09-28',
          startAt: '2026-04-01',
          uploadedAt: '2026-03-25T00:00:00Z',
        },
        { resourceUrls: [] },
        null,
      );
      expect(r.isNew()).toBe(true);
    });

    it('false when URL in snapshot', () => {
      const url = 'https://api.odpt.org/test.zip?date=20260401';
      const r = new RemoteResource(
        {
          url,
          from: '2026-04-01',
          to: '2026-09-28',
          startAt: '2026-04-01',
          uploadedAt: '2026-03-25T00:00:00Z',
        },
        { resourceUrls: [url] },
        null,
      );
      expect(r.isNew()).toBe(false);
    });

    it('false when snapshot has same URL with different token (auth stripped)', () => {
      const r = new RemoteResource(
        {
          url: 'https://api.odpt.org/test.zip?date=20260401&acl:consumerKey=NEW_TOKEN',
          from: '2026-04-01',
          to: '2026-09-28',
          startAt: '2026-04-01',
          uploadedAt: '2026-03-25T00:00:00Z',
        },
        { resourceUrls: ['https://api.odpt.org/test.zip?date=20260401&acl:consumerKey=OLD_TOKEN'] },
        null,
      );
      expect(r.isNew()).toBe(false);
    });

    it('null when no snapshot', () => {
      const r = new RemoteResource(
        {
          url: 'https://api.odpt.org/test.zip?date=20260401',
          from: '2026-04-01',
          to: '2026-09-28',
          startAt: '2026-04-01',
          uploadedAt: '2026-03-25T00:00:00Z',
        },
        null,
        null,
      );
      expect(r.isNew()).toBeNull();
    });
  });

  describe('isAdopted', () => {
    it('true when URL matches adopted (auth stripped)', () => {
      const r = new RemoteResource(
        {
          url: 'https://api.odpt.org/test.zip?date=20260401&acl:consumerKey=REMOTE_TOKEN',
          from: '2026-04-01',
          to: '2026-09-28',
          startAt: '2026-04-01',
          uploadedAt: '2026-03-25T00:00:00Z',
        },
        null,
        'https://api.odpt.org/test.zip?date=20260401&acl:consumerKey=LOCAL_TOKEN',
      );
      expect(r.isAdopted()).toBe(true);
    });

    it('false when URL differs from adopted', () => {
      const r = new RemoteResource(
        {
          url: 'https://api.odpt.org/test.zip?date=20260402',
          from: '2026-04-02',
          to: '2026-04-30',
          startAt: '2026-04-02',
          uploadedAt: '2026-04-01T00:00:00Z',
        },
        null,
        'https://api.odpt.org/test.zip?date=20260401',
      );
      expect(r.isAdopted()).toBe(false);
    });

    it('false when adoptedUrl is null', () => {
      const r = new RemoteResource(
        {
          url: 'https://api.odpt.org/test.zip?date=20260401',
          from: '2026-04-01',
          to: '2026-09-28',
          startAt: '2026-04-01',
          uploadedAt: '2026-03-25T00:00:00Z',
        },
        null,
        null,
      );
      expect(r.isAdopted()).toBe(false);
    });
  });
});
