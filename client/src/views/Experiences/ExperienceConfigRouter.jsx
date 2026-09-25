import React, { Suspense, lazy, useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { getInstance } from "../../services/experienceService";
import { setHelpRoute } from "../../components/TabsHelp/helpRoute";

// The config route (my-events/:eventId/experiences/:experienceId/config) is
// generic across experience types. This dispatcher reads the instance's
// experienceType and renders the type-specific configuration screen, defaulting
// to the Raffle screen so existing raffles keep working unchanged.
const RaffleConfig = lazy(() => import("./RaffleConfig"));
const LivePollConfig = lazy(() => import("./LivePollConfig"));
const PulseFeedbackConfig = lazy(() => import("./PulseFeedbackConfig"));
const SurveyConfig = lazy(() => import("./SurveyConfig"));
const ScratchOffConfig = lazy(() => import("./ScratchOffConfig"));
const InstantWinConfig = lazy(() => import("./InstantWinConfig"));
const TriviaConfig = lazy(() => import("./TriviaConfig"));
const PredictionConfig = lazy(() => import("./PredictionConfig"));
const CheckInChallengeConfig = lazy(() => import("./CheckInChallengeConfig"));
const TreasureHuntConfig = lazy(() => import("./TreasureHuntConfig"));
const CouponConfig = lazy(() => import("./CouponConfig"));
const LoyaltyConfig = lazy(() => import("./LoyaltyConfig"));
const SponsorPromotionConfig = lazy(() => import("./SponsorPromotionConfig"));
const PhotoContestConfig = lazy(() => import("./PhotoContestConfig"));
const SocialWallConfig = lazy(() => import("./SocialWallConfig"));
const LeaderboardConfig = lazy(() => import("./LeaderboardConfig"));

const Loader = () => (
  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
    <CircularProgress />
  </Box>
);

/**
 * ExperienceConfigRouter — routes the shared config path to the correct
 * per-type configuration screen based on the instance's experienceType.
 */
const ExperienceConfigRouter = () => {
  const { eventId, experienceId } = useParams();
  const location = useLocation();
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
        // Fall back to the Raffle screen if the instance can't be read.
      } finally {
        if (!cancelled) setResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, experienceId]);

  // Scope the Help panel to THIS engagement type. The /config path renders 16
  // different forms depending on experienceType, so the help doc key is the
  // pathname plus a `#<experienceType>` hash (e.g. .../config#raffles). React
  // Router can't see this hash (we never navigate to it), so push it explicitly
  // via setHelpRoute, which also survives the SDK not being loaded yet (the
  // route is buffered and replayed on boot). Falls back to the bare path until
  // the type resolves.
  useEffect(() => {
    if (!experienceType) return;
    setHelpRoute(location.pathname + `#${experienceType}`);
  }, [experienceType, location.pathname]);

  if (!resolved) return <Loader />;

  let Screen = RaffleConfig;
  if (experienceType === "live-polls") Screen = LivePollConfig;
  else if (experienceType === "pulse-feedback") Screen = PulseFeedbackConfig;
  else if (experienceType === "surveys") Screen = SurveyConfig;
  else if (experienceType === "digital-scratch-offs") Screen = ScratchOffConfig;
  else if (experienceType === "instant-win") Screen = InstantWinConfig;
  else if (experienceType === "trivia-challenges") Screen = TriviaConfig;
  else if (experienceType === "prediction-challenges") Screen = PredictionConfig;
  else if (experienceType === "check-in-challenges") Screen = CheckInChallengeConfig;
  else if (experienceType === "treasure-hunts") Screen = TreasureHuntConfig;
  else if (experienceType === "digital-coupons") Screen = CouponConfig;
  else if (experienceType === "loyalty-rewards") Screen = LoyaltyConfig;
  else if (experienceType === "sponsor-promotions") Screen = SponsorPromotionConfig;
  else if (experienceType === "photo-contests") Screen = PhotoContestConfig;
  else if (experienceType === "social-wall") Screen = SocialWallConfig;
  else if (experienceType === "leaderboards") Screen = LeaderboardConfig;

  return (
    <Suspense fallback={<Loader />}>
      <Screen />
    </Suspense>
  );
};

export default ExperienceConfigRouter;
