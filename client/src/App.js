import './App.css';

import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';

import Router from './router/Router';
import {Elements} from "@stripe/react-stripe-js";
import {loadStripe} from "@stripe/stripe-js";

const stripePromise = loadStripe(
  "pk_test_51OkXAwDRk98sgoxdVkMbwDr2h9dgDOQYNM590wGjUOYvcro5IzrapMfETTaN2qlWaRlY15HloJauifSzzG2hvaCU002Ksz9f2l"
);

function App() {
	return (
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
  );
}

export default App;

