import React, {useEffect, useState} from "react";
import {useNavigate, useLocation} from "react-router-dom";
import logo from "../../assets/logo.png";
import backArrow from "../../assets/backArrow.svg";
import lockIcon from "../../assets/lock.svg";
import {useStripe} from "@stripe/react-stripe-js";
import {createCheckoutSession, updateCustomerSubscription} from "../../services/paymentService";
import {toast} from "react-toastify";
import {parseJwt} from "../../utils/common";

let userId;
const SUBSCRIPTION_PLANS = ["Basic", "Plus", "Premium"];

// Prices from Stripe (in display format)
const PRICES = {
  Basic:   { yearly: { perMonth: '7.99',  total: 95.88 },  quarterly: { perMonth: '10.99', total: 32.97 }, monthly: { perMonth: '13.99', total: 13.99 } },
  Plus:    { yearly: { perMonth: '13.98', total: 167.76 }, quarterly: { perMonth: '16.98', total: 50.94 }, monthly: { perMonth: '19.98', total: 19.98 } },
  Premium: { yearly: { perMonth: '18.98', total: 227.76 }, quarterly: { perMonth: '21.98', total: 65.94 }, monthly: { perMonth: '24.98', total: 24.98 } },
};

const SubscriptionViewPart = () => {
  const stripe = useStripe();
  const location = useLocation();
  const navigate = useNavigate();
  const {plan, price, paymentArray, isUpdating} = location.state || { plan: "Basic", price: 0, paymentArray: [], isUpdating: false };

  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutMounted, setCheckoutMounted] = useState(false);
  const [checkoutInstance, setCheckoutInstance] = useState(null);

  const planPrices = PRICES[plan] || PRICES.Basic;

  useEffect(() => {
    const token = localStorage.getItem("idToken");
    userId = parseJwt(token);
    // Fallback: try sub from token if custom:user_id is missing
    if (!userId && token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.sub || payload['cognito:username'];
      } catch (e) { /* ignore */ }
    }
  }, []);

  const getPaymentSubscriptionId = (paymentMethod) => {
    const sub = paymentArray.find((s) => s.sublevel === paymentMethod);
    return sub?._id;
  };

  const handleSelectPeriod = async (period) => {
    if (isLoading) return;
    // Destroy previous checkout if exists
    if (checkoutInstance) {
      try { checkoutInstance.destroy(); } catch (e) { /* ignore */ }
      setCheckoutInstance(null);
      setCheckoutMounted(false);
      const container = document.getElementById("checkout-container");
      if (container) container.innerHTML = "";
    }
    setSelectedPeriod(period);
    setIsLoading(true);

    const subscriptionId = getPaymentSubscriptionId(period);
    if (!subscriptionId) {
      toast.error("Subscription plan not found. Please go back and try again.");
      setIsLoading(false);
      return;
    }

    if (isUpdating) {
      // Update existing subscription
      try {
        const sessionData = { userId, sublevel: period, level: SUBSCRIPTION_PLANS.indexOf(plan) + 1, newSubId: subscriptionId };
        const response = await updateCustomerSubscription(sessionData);
        if (response.data?.subscription?.cancel_at_period_end) {
          const downgradeDate = new Date(response.data.subscription.current_period_end * 1000).toLocaleDateString();
          toast.success(`Plan change scheduled for ${downgradeDate}`);
          navigate("/admin/home");
        } else if (response.data?.sessionId) {
          const result = await stripe.redirectToCheckout({ sessionId: response.data.sessionId });
          if (result?.error) toast.error(result.error.message);
        }
      } catch (error) {
        toast.error(`Error: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    } else {
      // New subscription — mount embedded checkout
      try {
        if (!userId) throw new Error("User not authenticated. Please log in again.");
        const sessionData = { userId, subscriptionId };
        console.log('[Checkout] Creating session:', sessionData);
        const response = await createCheckoutSession(sessionData);
        if (!response.client_secret) throw new Error("No client secret returned from server");

        const checkout = await stripe.initEmbeddedCheckout({ clientSecret: response.client_secret });
        localStorage.setItem("checkoutResult", JSON.stringify({ price: planPrices[period].total, plan }));

        // Clear previous checkout if any
        const container = document.getElementById("checkout-container");
        if (container) container.innerHTML = "";
        checkout.mount("#checkout-container");
        setCheckoutInstance(checkout);
        setCheckoutMounted(true);
      } catch (error) {
        console.error("Checkout error:", error);
        toast.error(error.message || "Failed to load payment form. Please try again.");
        setSelectedPeriod(null);
        setCheckoutMounted(false);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const periods = [
    { id: 'yearly', label: 'Yearly', sub: 'Best value — save up to 43%', price: planPrices.yearly.perMonth, billed: `$${planPrices.yearly.total}/year` },
    { id: 'quarterly', label: 'Quarterly', sub: 'Save up to 21%', price: planPrices.quarterly.perMonth, billed: `$${planPrices.quarterly.total}/quarter` },
    { id: 'monthly', label: 'Monthly', sub: 'Most flexible', price: planPrices.monthly.perMonth, billed: `$${planPrices.monthly.total}/month` },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #c8a96e 0%, #a8c4a0 18%, #5bbfbf 38%, #3aaccc 55%, #2196b8 70%, #1a7ab5 85%, #1560a8 100%)', fontFamily: "'Nunito', 'Outfit', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, overflow: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 1100, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'row', minHeight: 600 }}>

        {/* LEFT PANEL — Plan selection */}
        <div style={{ flex: '0 0 420px', padding: '40px 36px', borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' }}>
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF8AAAA5CAYAAABQ4feyAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAB18SURBVHgB7Vt5eBzFlf919/Sc0kij+7It2cZGNhgMGIhtwGAwG24HzJ2QZZdkyZcNCdlwJCEmQA4gXxbCkYMQEu6bcJgbbDAYMHbAGB/I+JJlSdYtjeae7tr3qrtHLVmSZZPw7R8uu9Q93VWvqn7v1XuvXlED+9P+tD/tT/vT/rQ//cuTgn9++iI0xRjK7Cv9sdD+UtO+DoTrCfxrmLdXSYjhMVWUXNdG6udwFfdlXMJVb6/S3jSyx7LXX3/9oDLr1q0bM/3p06cLmwYDKu9//vOfK4sXL5b3NpgKvx9Ku729XSktLRV8dZ7xbzfdIXT2mLgLQ9t0+me9lu+HA33MTFD2pQw3fO6556o8sGXLlqnO8ylTpsiy3d3dSn9//6B6iURiNzqBQCDX0by8PBGJROTvhoYGeXUAdEBl+kyb75m+m2Yqlcrd+3w+4dBnujYNk6/z5s2TV4cZuUESjo7wMGO5TW6vqqpKNDc379Z36oek4xKa4UAflRF7BT53zukYAaM6APDAS0pK5DWdTiuZTEbJ7tol62ULTMUwTHlfSP+c1GkYiqZpgrPH45FZ13WRn59vdnR0CAdATg6wJUS7y+/XsuGw0lY4JWDmh1R/tk/xRPvNcF9LGjt2AAUFsg71TXi9XtPv95tMNxqNmkybGdLW1sb3YuhsoTLKxIkTFWdc9Fsl8AcxVva9s5Npyz4SPXPLli3CocfMGMIIsUdg9wQ6Szh3rqy3V90y7VhvtP6oSF/N+InQ/eUZ1VMBTfUYurdaVTzVpmKGhOophVAUU1WgwgCLiZwiprz2EIc6kU5tCPR1rC/+cMknxVs+7lNVVRDzGCzT602Y3ZWH+7bPWTglFS471NT9UxUVk01Vq6bRhKGoBaAK4OkvjKxiiijdtSum0aSnYp94+trXlb373OrItrX9xFgzm80aBLxBgmEUFBQYzIzCwkIpvVKASkuVpunHRroqptdD9Y0zNaWQsgISHCUd68rrbt1a8MHSLeHGj5PcT2Ys1TOJASbTo34bzAieYcMwQewT+IsWLVKfO/X7tVmPb65Q9emKos0Swqwv0ETk4Ihfrw/7lTVrNuBDbzHMYBBhTUG+hwBXBMJeDSECP0OketMG+jMmulJZZBRNUlfon7RWptGnJ6Kvlv7jjd/7u9p7m+ecMi8dLj1e6N45JoNM+KrCJLqkivxelHoVBDWV+K0gZRiImwItSQNtsSzSxA8qTQwRTLhTj8WXFmz68L66N+7fQOoya5pmNhgMZpkZDNza+ZdW9k6o/5qp+86H5plIbQUF3FZXcUAyFCPbqWVTK3wdO16YsPzpFaHmhijTYZqhUCjr0K+pqTGYCaziRmOAMhrwLPE3V55Yk4xE1o33aXmX1oYxs0DHtMIgqkJe+FnwqOR3bvwj7luzDZnzLsHvDi7Af02tIOm2SZJtskoZHdOHK2HG2eEceE7C7opoEWrQSfR2m9RSWtuc2GXZM2IU1tNXPdGlKxyVi/mupnzgZI1fhJ+r0Evk73nlgsphETVHdIZETwcx2jMIDTwWHfC8vHHlsSOS/CQkAZRIeTRosnWnRhr5MQthMtcGiB3xZN+wldssTshu1N8HnnwD2VrVYVLDxxNm5/7GVsS6dxIV7HT/seQXm8C0pKoD/rx8aG8bi98WRMnnsGTplURTbAspsr125ER18cakUlgs2ff66ZWY1oMgN0WoB5NNY/pP8pxkRhFkMKtRO02yP4Yxg1Lv7hL7GysRPZmvG5QQtFYIBrQjqiOj1IpVMITj2QZqjlXSi2G6c4bp4YdUU+ypqcjaCJWnKmLieDOqCKhPQ+P/psM0loLzb0JAeMCewL5ZKiAiy54ye445eL8dOZ78KjkxXzW+Y4LBI4IvkZZn38GdaseR6L53wX3z9tASJeFb++50moRSVQKsqTpc88ugGWz80As8FVGHjOBLyMe3Gb7MZzx/4J4CvojMbQrOchNeerUvJ4w4UegZNpxXhcaRAzyPiVBHTkk87XbQPq00bW6KpBzBLCpmWFIIQyIK8sdIFEigw8Zel9CATIPV0wLh83HFqJCmrLCQ0wzhmSuBvufgQI5ePZYBWuzWQJOHvoTFewYVZQW1WOaw4Kw6tliLbtbrKzR/1RKJO4Y0ZsKyqWXIcrG1swuawCS1dvIG/sbJG/4f2VocaNHSavHyn+wh4OAS4zx58p/MBTRQbjRvV29jZ5PR6pKnSasqTk8O8HFuHqgypQGdSlAKvqYBUzWmKoaZ5ahnAAQuslgXHQ5PG46+pLEZhUS6Kjw08GrzrPg/qyfBQSoKqtzqQ7SOVTmQyuuvVevPrBp8g74TTylFRc985W3DZvEuT60XTZLZoigYOPhrHqWZCah5mldjkzSpqNFglVuRrD1z64Hxd95ccwz7tEFMTaP6p+7f7V1GaaSqSpXb5mbE+HdSgH8nKRT2esYwdfDFwGW1+y+OTPe0idVEb7cdv8Opw6uRwDTjxYFqSxIh0oFRBLKksaKcTdwhBiBJYoNq26qjJ8+5yTB7aPLLVuu362v06gN7d34JV3/oE7Hn4RG9uiKJh/JrTxk4FkGk9voIBqIoOb5k1GGQmIKStZOjw46xj0NpaQo94JhYDmGaBo1mKN44FCk34xDtUJzG3rSamnV1Quf2oNNZpUVDVJKiZBUp+gPvA1xQwh6c9y1JMcGNM9qj2CX9SfhuiOIRQUTgxytzI6qROQtN5wTC0BXwZnOc5itW1nG278w6N4d+1m9IeK5NRXSGK/ecxBuPGCE2xPxw3zaEkZxNPcVXGxSLGMLs139BDQqYNnI1JQjnCQVZ8m37XHDSzZ2oNVu9bgumPG40wSFq5rJlYhvv1H8I7bCdHmgSCdrpDqF0mrDQs5okAzZntGaRy38pm3kEn00askIcOxkTjlGDEgRlfJAHI50+FwOEuupsFx/9NPP1088cQTktCYJN9P6kQVfvfW2kAi8Hy6DxMLPFg0rVwuxe0uorWtCydc+hO0ewuQf/zXQAsQO3xCbltlsVQtQ7AfPlE5U7qkJjp7o/ic9C2Lok5Gu6K4ABWlxQPMoP5lsgZWr9+CeF8U18+pxdyjZxLwPmjUoEh3I9H6D2xp3Ip3tvfiySVBrKyrx7VHfQxl193QouSmxnSrwRi7SQqFwr0IkUupxshbSXjxWFtB4slu/UOk++KECUXMlSQDzaBT+/3UDc4xDrQR6KyGshxgmzlzpjvEPFa1Y8/tEWCiRjB7Sg286kCoiBn10AtvoZlCvEXnnE/A+y0KObTH6p5azVoGGHj/440488pbUTTnJAi/FUYoyfNiwfQJ+M7cKehpa8fjLy7DhaediDOOP3qgy2YayU13wdj4EMlkFBPJ8aglef062UFRTNGgZsKQdz6jFBYh6ATZBpD8/mVtIbqnX4pjDq7Cho1bcMtLHyE1+xQKmgXmFS+55Sk1GUsT4BzBjBP4cbpnyY9TVDNB6iZJ6iZNmzhZCrCZvMHiSP3YwVcGfObhGMCrPD+pnqFvTdL1GsVeKDov9SpvcJhSfVpRRxm6x9iSyAVrFBkr0mvqQBu0YGo9RPfxXcBzT2/AZUUx3Pyjy6Db8SQhLGWR3PUAjLY7oeRTwxwxTQgZiFPYO/alofRR+X7KUcisEPDLtofRWHshbv3eZVBJ188/RaAr9Ahu+3A7tMPnFvcdde6MouV/e4PIpwnwlKPrybVPkrqRIWUOMfDu2bRp08yh+7xjX56OlBTLm3lv/TayWaaUeMu1V/Ctc0/GMQdQ3DvabfnWhIOXYu3TIjoW1EYG6esxNDPozjG08okd6DpnSgmuPvdEMuSeXFiZ0+vvfYRtWx+EUkAKPJTlRT+UAHlUPtLz3cSiPh2ih4Snl+DopUp9Kja3+vFAch5uvPIya+FnNYRrLl2E6s7tMFoaldT4GTPT4cqg4A0EyPBWhg0sZwJeGlrS93J7kSR+twXMmNXOiBgRKdq+xdqWbry9owvHjiuyQy4KIuEwXrp7MTY2d6KVpnkhLVrGF4YQodiKZoO2t8laCQtrM8BVn/iJ/5ldJwVBcZVduvITnHXFr/HojTGMK9OkY6BmbGunkTT0ajB7bXUYZ3VD9YkJha0ZnHfSIQj4B9s6L83yb509H9c8vBSFp17gT08+bIK+unkHvTftJHjTnoqavHfMIeWE3O/YXc+OTfKFkosIDI0kcJ9VcskERSGufGMz1nf2wx1TYTDqq0tw/MQiHFYVQTEBrw4CcuyJSyeTycEP7HRIWQjlMmCmDBrlL/70GJAfwfP9Z9PMtFwW58qdl6CTfjfbqF4H1ewgp7zNQCRrIvPcPWjp6M7RcqR/3lEzkW2j+FMfGe9ItfSraSwqr2pp83+3frt9e3caA/hp6T8bWWtYijAHgcYdCpLrKMwsWkiPLnx6LX6/ulG6eSZ793J3ieqZ0geUIeGnXluBvz37uh3ONWVYwLoKVyxT2U1WpKaxQwOqG2TBG+vagCdqk2Cbs6OlHTrF8F/aNQevbj8SStzDQ6JMep/GxFkupDiExSdESEjVjKXTDlR78fpbKwbPemq/tChMqo2Y09dL7qjfT1KvUVY5cfCMmcAhBewhjah2eDUmCyhmRjWR7YgnfAZJiZZb8Cu5zkw/YBw5E8vpPk1umQc3ftCC21a1YGaRholmP4LZODrbOrGBAlsfbWlFOlSIM0+ajWpadRL5HC3+20o7U8N5QsLFASeW7rzhd21J096eVHIOAs+6I2dMxQtNCRIDHVc3fBvZCi9OIS8RvGfM3nlK5TWpzRBFam6pwXkSkJuZyLjHanWghaKYGS5HcQ5Pf2c/Ac1alDMDr5Kul/Ed1d4zcJ8NGhP4nJqamlDUh/beuq9sa4yK6V0kzaXkLw+1kgvnz8Fdj72E7bStp5ZWSob0kyQtbzewXCHfntYIihamHY2J8EzRwMdhXqOBv7x0J7lz0UHWU5STnq0LYCDQb71zTixYGFh63XptzZV17f3oTWdQ4KOwsL0M53+//sElWHPFreiI95OTk8K7m2cj6/XhsLz1qEpT1JL6ISirfE1BZm4nRiGHP0VrcOtxR8mZ6fhlrAXefP8TGg/FqfIjwtfwZqMNMneDgZdBNc60oleGO6k3Kvh8lG7ZsmXy2F3Prk2mkup7ulctnP46bYCcP70yNzCZ6D4/L4Bl9/6KBrYDn2d86E1mYFBAKgvbkMECaag862olDcmyD4ptV5Z8sB6NpjcX6nUnfjZ5fBW+QwYv/5AquU3pOANxCrTd/coHuPaMufZ6wpoT1WUleP3Oa3HzE2/glWQY73V78HJmFsyq8zAn+i6+mlyFKf07UWaQn08Gtz+h4v14AO8UHIIf3Px9jKssky07qjZKu2h3P/Yi9NJqihunWgNN61tM28vjbUMLEkWMxZ4NxxXFOTZCOy+erq4uX3Ty3JruIxe+WhFSq18+n1aLQe9uRyxyANmegdP4aB7N0BUz/77kx7/FS5u7sfaviyk66cFYj45w3fueflWGOi4+7fgcQ2G7oTLe09WHZS0xvLWjBw1dCeyi1WyWpFqNdmEcOfczwhpmjS+h4F0t6ieOJzC5bSskYW2oAz+65V7c8eQrKF5wbraoYekz/s0ffEaFaKkhOmkG8P5nO127aVy9vPAqKipKUSw/S66mE9cZ3dVkQBYtWiQPr/KROG3rex39E6Zf01Jx4F0XPbsu/KdTpqK2IDQkJqPk6lpqwno6WlJGOhpib4zs7Zmdby48CX956lXcdv/T+O7FZw3453Zb1cVhXEThiAsPqpLtULDXOmlCcqTZ6wLFUXO2wReqFaxjd+CGux7GnY+/hvwjjhXhjoZ3A1tWbiPFzgsseVgKVkRT7tuS+jGCwaBobGwUtMAatr8jeju8FOZAEJ9p5CNxpa/c9Xbo83e/vb6tp/Gkx9eJa5c14KOWHoqVW94MH4KyspCxG1PY6ypXHvrbeebeQ3F4ljtRIAamvHPvfuZmG6dLzzkJh9ZPxn9e91u8s6aBQvH2Thv1zTn+wRFVjRD30irYp2vyqqn2cRP7eIj0RhWrnU9oI+bUy2/AzQ++iIKjj8+UomdZ3uq/r+LVLAYCahzn4XOcKT4yyIE0xo6uwjnJPDQNJ/k5884eDx8uJdUjV2/5bz+0On/tmxd2zjpr4f3RuoV/W9teW4KkOsmTRh2FWSLEfD6fyZsdQzW8c0RDcTsOuXcDadOONmRND+57YTlttscB2/nk+hotcDiUwQZOt8PROu8lOLbYZlaGQtcH10/BD2/5M5Ticiz8t2Mxu64MM8aVoTAviD0lg3T4lqZWMqxr8Ngr72Dlpp3QJx5oVh47f3vexrff8+1cu5MELMFBNGovylfqUz9d4xRKSPKxQQ4hk8oxhgxVDMZk+CSf8ykG0lWe6upqvaenx08NBamRfCLMZz4Kk3Wzpqaqpx5shEvqzEB+uanRdpaqhhVTnjxSdiMpn6iDuyGyOs2AwMAjNsAe6cbBcPdGkbEgYZ8lYZea/pjOzu3QztN6xKDFSUpeTQow50WKtGi3UkUh9kn5PpTpAiEzBanWaRETp8317mgC28mN3NTaTUqcvKaiMtOfn9cX8mS3+zevXOffsa6ZxpUiHNgn4iBalO776J7WyOihYFovST0zI06LwSRpngypHGM4fc9pJFczJ/0clyBOZolghuhxsEhjN4qlz7dl5brAtlWNVIzFKUCW2k/7ZxQFh05l5MKD/V6LlnVkhevCOb1CjnhM+CMdargeEkZnr9BUne09K9Du7roFvh/J1oieapKlVFVIZ8nZyZf7KrTKyaRMp5aRXxZMVR1Q1llcXdoRLS02Q6EwdVETup/77kU2nYAaSmuRvITuC/eW97Z2+JpW7NI7GnvIb6OZr7LzxrEbBl6qGsIgSmCz9PcSRlESyhgBniKNkSZ9z6JjjgQ8MLpFzEn/888/rxFXPUTcS9PKRw0FqBNBajiPltN8NoUll49L+Oie1/geeu9h4DmJgVkgmWbYJyJczxzfmItbgmsv17k8rxadBQu7dUySr7IyuXV2XEUGffjeec6/nXI2Xdh94RqakJtqijwv6Dznq12XafD+q8EGlA2qvT2YA59yjNUNYRIj9cz38RQlwipNbnpmX4+Ij8gAPgBETPDRvY8a5aV1gJ4xQ/hwEK/A2PnWedVnA69q2sBuuYsROSAcwLmODbjqemcfohzcJ9NGlQFisOzfwmaGwwjBxzWGgO8wVbNDAaojJMAgHca+OtNmAlLqwUEJy6DKzRPy62UI2d5I4W3DNANPKbt69Wq3vhcjgjsWBvBHEnxqmaaU3EomD0gn8L3UqMzUAXlWhSWeB0aD5iMruViHW/p588XNADsWkmPUkBngrgsbcDFGBgxKDi3ul91mTkC4fbttxanP9Oi1QWN1ztxn7D1ZuTdLs17G7Z3j4OzlMPC8VzuauhkE7FjAd+5pKqkUdtD46DMfgevr6/Nw4lNZnKkzDDrPEj6rIg+M8oDoN4aC6ASg3KC4meWU91irnVwiMHIrSSezAeYrvxsL+NyODfhuAuKmyUc/qIzh+O+w4/ac2avhmD3f8/de9nnMMQE/FNixMkGhWSDP7vf29qp8lDwWi/GM4Cv7WCrpPwk6XeVhIXrOXwbm2nJH/JxDRcRILqeQrswxhK/MxKEdIbUqvzSktnIgswDTcz4fw6DJHI/HB9UjI8iM435y6Ffltvi3a/Zx+5I+12faJEz8jZhB/eAZ4GT+tMigBah0J+3vsEwKyeQMPPYAvBvQvWUAHCZwxI6yyl/s1dTUDPoi0TGs1DFZgZ+5iXHgaeg91+HMx+uc3yN1hr9k5Ct/eejcO1cnzjI0cTvuNpx751SZmzYzgK/Ox2+8SUIut9wsYUl3QOd4vUvaOe05sIO9B3/Euu7PRPk8ovOc3NNR23B/ZsnMG/rcOWI3XHI+x3Q/I5W4x4E77TiCwvdDBYMTf0LqbsP5ltcBfJjPPjmNCXhOXwT8sdYf9AX3SMk5Oj1c7NvNTE7OXoM7uXeLRlrOD9fOUNpDk9OWC2z+uc+Au9MXBf/LovllJXff9wToPgE+UmP/X9NIffzCg98D/X9FW/vT/rQ/7U/70/60P33Z6f8AQ5X/P4zNGTQAAAAASUVORK5CYII=" alt="Tabs" style={{ height: 36, marginBottom: 32 }} />

          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: '#10B981', fontWeight: 600 }}>Selected plan</span>
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#111827', marginBottom: 24 }}>
            {plan}
          </h2>
          <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>Choose your billing period below</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {periods.map((p) => (
              <div
                key={p.id}
                onClick={() => !isLoading && handleSelectPeriod(p.id)}
                style={{
                  border: selectedPeriod === p.id ? '2px solid #4F46E5' : '1px solid #E5E7EB',
                  borderRadius: 14,
                  padding: '16px 20px',
                  cursor: isLoading ? 'wait' : 'pointer',
                  background: selectedPeriod === p.id ? '#EEF2FF' : '#fff',
                  transition: 'all 0.2s',
                  opacity: isLoading && selectedPeriod !== p.id ? 0.5 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{p.label}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{p.sub}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>${p.price}<span style={{ fontSize: 12, fontWeight: 500, color: '#6B7280' }}>/mo</span></div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>{p.billed}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={lockIcon} alt="" style={{ width: 14, opacity: 0.5 }} />
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>Payments secured with <span style={{ color: '#4F46E5', fontWeight: 700 }}>Stripe</span></span>
          </div>

          <div onClick={() => navigate("/subscription")} style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#6B7280', fontWeight: 600 }}>
            <img src={backArrow} alt="" style={{ width: 14 }} /> Back to plans
          </div>
        </div>

        {/* RIGHT PANEL — Stripe checkout */}
        <div style={{ flex: 1, padding: '40px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: checkoutMounted ? 'flex-start' : 'center', overflow: 'auto', maxHeight: '80vh', backgroundColor: '#f4fafa', borderRadius: '0 24px 24px 0' }}>
          {!checkoutMounted && !isLoading && (
            <div style={{ textAlign: 'center', color: '#9CA3AF' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>💳</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#6B7280' }}>Select a billing period</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Payment details will appear here</div>
            </div>
          )}
          {isLoading && !checkoutMounted && (
            <div style={{ textAlign: 'center', color: '#6B7280' }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Loading payment form...</div>
            </div>
          )}
          <div id="checkout-container" style={{ width: '100%' }} />
        </div>
      </div>
    </div>
  );
};

export default SubscriptionViewPart;
