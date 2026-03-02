import './App.css';

import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';

import Router from './router/Router';
import {Elements} from "@stripe/react-stripe-js";
import {loadStripe} from "@stripe/stripe-js";
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

const stripePromise = loadStripe(
  "pk_live_51SlCBsAWCpiUlH7Qqreh9InNU08elFVvm1du0vuXVJFLJFIBzvzesHRRgJ5xGmTorYHN2OclBJvhH1p8T8PHKgWl00rB7HHtrC"
);

function App() {
	return (
    <LocalizationProvider dateAdapter={AdapterMoment}>
      <Elements stripe={stripePromise}>
        <div className='App'>
          <Router />
          <ToastContainer
            position='top-right'
            autoClose={5000}
            hideProgressBar
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme='colored'
          />
        </div>
      </Elements>
    </LocalizationProvider>
  );
}

export default App;

