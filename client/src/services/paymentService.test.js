import http from '../utils/axios/http';
import configJSON from '../config.json';
import { listEventPayouts } from './paymentService';

// The organizer-payout endpoints live on a SEPARATE REST API (configJSON.payoutsUrl),
// called via the shared `http` client with a per-request baseURL override. Mock that
// shared client so no network happens in tests.
jest.mock('../utils/axios/http', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const PAYOUTS_BASE_URL = configJSON.payoutsUrl;

describe('paymentService.listEventPayouts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('issues GET "payouts/events" against the payouts API scoped to businessId and returns response.data', async () => {
    // Given a businessId and a per-event payout list response…
    const payload = {
      businessId: 'b3acf234',
      currency: 'usd',
      events: [
        {
          eventId: 'ev_123',
          eventName: 'Summer Fest',
          eventDate: '2025-06-13',
          releaseDate: '2025-06-30',
          payoutStatus: 'pending',
          holdActive: false,
          heldAmountCents: 45000,
          releasedAmountCents: 0,
          stripePayoutId: null,
          reason: null,
        },
      ],
    };
    http.get.mockResolvedValue({ data: payload });

    // When listEventPayouts(businessId) is called…
    const result = await listEventPayouts('b3acf234');

    // Then it hits the plural list endpoint on the payouts API with { businessId } params…
    expect(http.get).toHaveBeenCalledTimes(1);
    expect(http.get).toHaveBeenCalledWith('payouts/events', {
      baseURL: PAYOUTS_BASE_URL,
      params: { businessId: 'b3acf234' },
    });
    // …and returns the parsed payload (response.data).
    expect(result).toEqual(payload);
  });

  it('omits the businessId param when none is provided', async () => {
    http.get.mockResolvedValue({ data: { events: [] } });

    await listEventPayouts();

    expect(http.get).toHaveBeenCalledWith('payouts/events', {
      baseURL: PAYOUTS_BASE_URL,
      params: {},
    });
  });

  it('logs and rethrows when the request fails', async () => {
    const err = new Error('boom');
    http.get.mockRejectedValue(err);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(listEventPayouts('b3acf234')).rejects.toThrow('boom');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});
