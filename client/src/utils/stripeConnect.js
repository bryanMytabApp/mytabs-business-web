// Thin wrapper around Stripe Connect embedded-components libraries.
//
// Isolating these imports here (a) keeps the ESM @stripe/connect-js dependency out of
// component modules so tests can mock this single wrapper (CRA's Jest does not transform
// node_modules ESM), and (b) gives one place to configure ConnectJS.
import { loadConnectAndInitialize } from '@stripe/connect-js';
import { ConnectComponentsProvider, ConnectAccountOnboarding } from '@stripe/react-connect-js';

export { loadConnectAndInitialize, ConnectComponentsProvider, ConnectAccountOnboarding };
