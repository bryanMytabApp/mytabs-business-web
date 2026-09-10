import React, { Suspense, lazy, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { getInstance } from "../../services/experienceService";

// The live route (my-events/:eventId/experiences/:experienceId/live) is generic
// across experience types. This dispatcher reads the instance's experienceType
// and renders the type-specific live dashboard, defaulting to the Raffle
// dashboard so existing raffles keep working unchanged.
const RaffleLiveDashboard = lazy(() => import("./RaffleLiveDashboard"));
const LivePollLiveDashboard = lazy(() => import("./LivePollLiveDashboard"));
const PulseFeedbackLiveDashboard = lazy(() => import("./PulseFeedbackLiveDashboard"));
const SurveyResultsDashboard = lazy(() => import("./SurveyResultsDashboard"));
const ScratchOffLiveDashboard = lazy(() => import("./ScratchOffLiveDashboard"));
const InstantWinLiveDashboard = lazy(() => import("./InstantWinLiveDashboard"));
const TriviaLiveDashboard = lazy(() => import("./TriviaLiveDashboard"));
const PredictionLiveDashboard = lazy(() => import("./PredictionLiveDashboard"));
const CheckInChallengeLiveDashboard = lazy(() => import("./CheckInChallengeLiveDashboard"));
const TreasureHuntLiveDashboard = lazy(() => import("./TreasureHuntLiveDashboard"));
const CouponLiveDashboard = lazy(() => import("./CouponLiveDashboard"));
const LoyaltyLiveDashboard = lazy(() => import("./LoyaltyLiveDashboard"));
const SponsorPromotionLiveDashboard = lazy(() => import("./SponsorPromotionLiveDashboard"));
const PhotoContestLiveDashboard = lazy(() => import("./PhotoContestLiveDashboard"));
const SocialWallLiveDashboard = lazy(() => import("./SocialWallLiveDashboard"));
const LeaderboardLiveDashboard = lazy(() => import("./LeaderboardLiveDashboard"));

const Loader = () => (
  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
    <CircularProgress />
  </Box>
);

/**
 * ExperienceLiveRouter — routes the shared live path to the correct per-type
 * live dashboard based on the instance's experienceType.
 */
const ExperienceLiveRouter = () => {
  const { eventId, experienceId } = useParams();
  const [experienceType, setExperienceType] = useState(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getInstance(eventId, experienceId);
        const instance = res.data?.data || res.data;
        if (!cancelled) setExperienceType(instance?.experienceType || null);
      } catch {
        // Fall back to the Raffle dashboard if the instance can't be read.
      } finally {
        if (!cancelled) setResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, experienceId]);

  if (!resolved) return <Loader />;

  let Screen = RaffleLiveDashboard;
  if (experienceType === "live-polls") Screen = LivePollLiveDashboard;
  else if (experienceType === "pulse-feedback") Screen = PulseFeedbackLiveDashboard;
  else if (experienceType === "surveys") Screen = SurveyResultsDashboard;
  else if (experienceType === "digital-scratch-offs") Screen = ScratchOffLiveDashboard;
  else if (experienceType === "instant-win") Screen = InstantWinLiveDashboard;
  else if (experienceType === "trivia-challenges") Screen = TriviaLiveDashboard;
  else if (experienceType === "prediction-challenges") Screen = PredictionLiveDashboard;
  else if (experienceType === "check-in-challenges") Screen = CheckInChallengeLiveDashboard;
  else if (experienceType === "treasure-hunts") Screen = TreasureHuntLiveDashboard;
  else if (experienceType === "digital-coupons") Screen = CouponLiveDashboard;
  else if (experienceType === "loyalty-rewards") Screen = LoyaltyLiveDashboard;
  else if (experienceType === "sponsor-promotions") Screen = SponsorPromotionLiveDashboard;
  else if (experienceType === "photo-contests") Screen = PhotoContestLiveDashboard;
  else if (experienceType === "social-wall") Screen = SocialWallLiveDashboard;
  else if (experienceType === "leaderboards") Screen = LeaderboardLiveDashboard;

  return (
    <Suspense fallback={<Loader />}>
      <Screen />
    </Suspense>
  );
};

export default ExperienceLiveRouter;
