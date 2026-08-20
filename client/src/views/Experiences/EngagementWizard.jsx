import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  RadioGroup,
  Radio,
  FormControlLabel,
  Stepper,
  Step,
  StepLabel,
  Chip,
  IconButton,
  Fade,
  Checkbox,
  FormGroup,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AutoFixHighOutlinedIcon from "@mui/icons-material/AutoFixHighOutlined";

const ACCENT = "#F09925";

/**
 * Wizard steps definition
 */
const STEPS = [
  { label: "Goal" },
  { label: "Features" },
  { label: "Budget" },
  { label: "Results" },
];

/**
 * Primary goal options
 */
const GOAL_OPTIONS = [
  {
    id: "engagement-loyalty",
    label: "Engagement & Loyalty",
    description: "Keep attendees coming back with rewards, points, and interactive content.",
  },
  {
    id: "feedback-surveys",
    label: "Feedback & Surveys",
    description: "Gather opinions, sentiment, and structured feedback from attendees.",
  },
  {
    id: "contests-giveaways",
    label: "Contests & Giveaways",
    description: "Run prize-based activities like raffles, scratch-offs, and instant wins.",
  },
  {
    id: "games-challenges",
    label: "Games & Challenges",
    description: "Entertain and motivate attendees with trivia, hunts, and leaderboards.",
  },
  {
    id: "social-community",
    label: "Social & Community",
    description: "Build community through photo sharing, social walls, and user-generated content.",
  },
];

/**
 * Feature/need options for step 2
 */
const FEATURE_OPTIONS = [
  { id: "gift-prizes", label: "Gift / prize giveaways" },
  { id: "real-time-interaction", label: "Real-time audience interaction" },
  { id: "data-collection", label: "Data collection & analytics" },
  { id: "sponsor-activation", label: "Sponsor activation & ROI" },
  { id: "gamification", label: "Gamification & competition" },
  { id: "location-based", label: "Location-based activities" },
  { id: "ai-assistance", label: "AI-powered assistance" },
  { id: "loyalty-program", label: "Loyalty / repeat attendance program" },
];

/**
 * Budget ranges for step 3
 */
const BUDGET_OPTIONS = [
  { id: "no-prizes", label: "No prizes / gifts", description: "Focus on engagement without physical giveaways." },
  { id: "low", label: "Under $500 in prizes", description: "Small gifts, digital coupons, discount codes." },
  { id: "medium", label: "$500 – $2,000 in prizes", description: "Moderate prizes — gift cards, merchandise, experiences." },
  { id: "high", label: "Over $2,000 in prizes", description: "Premium prizes — electronics, travel, large cash prizes." },
];

/**
 * Recommendation engine: maps wizard answers to experience type suggestions.
 */
function getRecommendations(answers) {
  const { goal, features, budget } = answers;

  // Goal-based suggestions
  const goalMap = {
    "engagement-loyalty": ["loyalty-rewards", "ai-concierge", "digital-coupons", "sponsor-promotions"],
    "feedback-surveys": ["surveys", "live-polls", "pulse-feedback"],
    "contests-giveaways": ["raffles", "instant-win", "digital-scratch-offs"],
    "games-challenges": ["trivia-challenges", "prediction-challenges", "check-in-challenges", "treasure-hunts", "leaderboards"],
    "social-community": ["photo-contests", "social-wall"],
  };

  const goalTypes = goalMap[goal] || [];

  // Feature-based boosting
  const featureMap = {
    "gift-prizes": ["raffles", "instant-win", "digital-scratch-offs", "digital-coupons"],
    "real-time-interaction": ["live-polls", "trivia-challenges", "leaderboards"],
    "data-collection": ["surveys", "pulse-feedback", "live-polls"],
    "sponsor-activation": ["sponsor-promotions", "digital-coupons"],
    "gamification": ["trivia-challenges", "check-in-challenges", "leaderboards", "prediction-challenges"],
    "location-based": ["treasure-hunts", "check-in-challenges"],
    "ai-assistance": ["ai-concierge"],
    "loyalty-program": ["loyalty-rewards", "check-in-challenges"],
  };

  const featureTypes = (features || []).flatMap((f) => featureMap[f] || []);

  // Budget-based filtering
  const budgetExclusions = {
    "no-prizes": ["raffles", "instant-win", "digital-scratch-offs"],
    low: [],
    medium: [],
    high: [],
  };

  const exclusions = budgetExclusions[budget] || [];

  // Budget-based boosting for prize-heavy types
  const budgetBoosts = {
    medium: ["raffles", "instant-win"],
    high: ["raffles", "instant-win", "digital-scratch-offs", "treasure-hunts"],
  };

  const boosts = budgetBoosts[budget] || [];

  // Score each type
  const allTypes = [
    { typeId: "raffles", name: "Raffles", category: "Contests & Giveaways", reason: "Prize giveaways with drawing schedules and winner selection." },
    { typeId: "live-polls", name: "Live Polls", category: "Feedback & Surveys", reason: "Real-time polling with instant results." },
    { typeId: "trivia-challenges", name: "Trivia Challenges", category: "Games & Challenges", reason: "Timed trivia with leaderboard rankings." },
    { typeId: "prediction-challenges", name: "Prediction Challenges", category: "Games & Challenges", reason: "Let attendees predict outcomes for points." },
    { typeId: "surveys", name: "Surveys", category: "Feedback & Surveys", reason: "Multi-question structured feedback forms." },
    { typeId: "pulse-feedback", name: "Pulse Feedback", category: "Feedback & Surveys", reason: "Quick sentiment reactions throughout the event." },
    { typeId: "instant-win", name: "Instant Win", category: "Contests & Giveaways", reason: "Instant-reveal prize experiences with configurable odds." },
    { typeId: "digital-scratch-offs", name: "Digital Scratch-Offs", category: "Contests & Giveaways", reason: "Interactive scratch-off cards with tiered prizes." },
    { typeId: "treasure-hunts", name: "Treasure Hunts", category: "Games & Challenges", reason: "Location-based scavenger hunts with QR codes." },
    { typeId: "check-in-challenges", name: "Check-In Challenges", category: "Games & Challenges", reason: "Reward attendees for visiting locations or sessions." },
    { typeId: "photo-contests", name: "Photo Contests", category: "Social & Community", reason: "Photo submission contests with community voting." },
    { typeId: "social-wall", name: "Social Wall", category: "Social & Community", reason: "Live feed of attendee posts and photos." },
    { typeId: "digital-coupons", name: "Digital Coupons", category: "Engagement & Loyalty", reason: "Redeemable digital coupons for vendors." },
    { typeId: "sponsor-promotions", name: "Sponsor Promotions", category: "Engagement & Loyalty", reason: "Branded sponsor content and offers." },
    { typeId: "loyalty-rewards", name: "Loyalty & Rewards", category: "Engagement & Loyalty", reason: "Point-based loyalty programs for repeat attendance." },
    { typeId: "leaderboards", name: "Leaderboards", category: "Games & Challenges", reason: "Ranked standings across experiences." },
  ];

  const scored = allTypes.map((type) => {
    let score = 0;
    if (goalTypes.includes(type.typeId)) score += 3;
    if (featureTypes.includes(type.typeId)) score += 2;
    if (boosts.includes(type.typeId)) score += 1;
    if (exclusions.includes(type.typeId)) score -= 5;
    return { ...type, score };
  });

  // Return top 5 non-negative scores
  return scored
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/**
 * EngagementWizard — modal wizard that asks questions to recommend engagement types.
 */
const EngagementWizard = ({ open, onClose, onSelectType, catalogTypes }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [answers, setAnswers] = useState({
    goal: "",
    features: [],
    budget: "",
  });

  const handleNext = () => {
    if (activeStep < STEPS.length - 1) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setAnswers({ goal: "", features: [], budget: "" });
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0:
        return !!answers.goal;
      case 1:
        return answers.features.length > 0;
      case 2:
        return !!answers.budget;
      default:
        return true;
    }
  };

  const recommendations = activeStep === 3 ? getRecommendations(answers) : [];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: "85vh",
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1 }}>
        <AutoFixHighOutlinedIcon sx={{ color: ACCENT }} />
        <Typography sx={{ fontWeight: 700, fontSize: 18, flex: 1 }}>
          Engagement Recommendation Wizard
        </Typography>
        <IconButton size="small" onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Box sx={{ px: 3 }}>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 2 }}>
          {STEPS.map((step) => (
            <Step key={step.label}>
              <StepLabel
                StepIconProps={{
                  sx: {
                    "&.Mui-active": { color: ACCENT },
                    "&.Mui-completed": { color: ACCENT },
                  },
                }}
              >
                <Typography sx={{ fontSize: 11, fontWeight: 600 }}>{step.label}</Typography>
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <DialogContent sx={{ pt: 1 }}>
        {/* Step 0: Goal */}
        {activeStep === 0 && (
          <Fade in>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 0.5 }}>
                What is your primary goal?
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#71727A", mb: 2 }}>
                This helps us narrow down the best engagement types for your event.
              </Typography>
              <RadioGroup
                value={answers.goal}
                onChange={(e) => setAnswers({ ...answers, goal: e.target.value })}
              >
                {GOAL_OPTIONS.map((opt) => (
                  <FormControlLabel
                    key={opt.id}
                    value={opt.id}
                    control={<Radio sx={{ "&.Mui-checked": { color: ACCENT } }} />}
                    label={
                      <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{opt.label}</Typography>
                        <Typography sx={{ fontSize: 11, color: "#71727A" }}>{opt.description}</Typography>
                      </Box>
                    }
                    sx={{
                      border: "1px solid",
                      borderColor: answers.goal === opt.id ? ACCENT : "#E0E0E0",
                      borderRadius: 2,
                      mx: 0,
                      mb: 1,
                      px: 1.5,
                      py: 0.5,
                      background: answers.goal === opt.id ? `${ACCENT}08` : "transparent",
                      transition: "all 0.15s",
                    }}
                  />
                ))}
              </RadioGroup>
            </Box>
          </Fade>
        )}

        {/* Step 1: Features */}
        {activeStep === 1 && (
          <Fade in>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 0.5 }}>
                What features are important to you?
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#71727A", mb: 2 }}>
                Select all that apply. This helps refine recommendations.
              </Typography>
              <FormGroup>
                {FEATURE_OPTIONS.map((opt) => (
                  <FormControlLabel
                    key={opt.id}
                    control={
                      <Checkbox
                        checked={answers.features.includes(opt.id)}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...answers.features, opt.id]
                            : answers.features.filter((f) => f !== opt.id);
                          setAnswers({ ...answers, features: updated });
                        }}
                        sx={{ "&.Mui-checked": { color: ACCENT } }}
                      />
                    }
                    label={<Typography sx={{ fontSize: 13, fontWeight: 500 }}>{opt.label}</Typography>}
                    sx={{
                      border: "1px solid",
                      borderColor: answers.features.includes(opt.id) ? ACCENT : "#E0E0E0",
                      borderRadius: 2,
                      mx: 0,
                      mb: 1,
                      px: 1.5,
                      py: 0.25,
                      background: answers.features.includes(opt.id) ? `${ACCENT}08` : "transparent",
                      transition: "all 0.15s",
                    }}
                  />
                ))}
              </FormGroup>
            </Box>
          </Fade>
        )}

        {/* Step 2: Budget */}
        {activeStep === 2 && (
          <Fade in>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 0.5 }}>
                Do you plan to give away prizes or gifts?
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#71727A", mb: 2 }}>
                This helps us recommend the right prize-oriented engagement types.
              </Typography>
              <RadioGroup
                value={answers.budget}
                onChange={(e) => setAnswers({ ...answers, budget: e.target.value })}
              >
                {BUDGET_OPTIONS.map((opt) => (
                  <FormControlLabel
                    key={opt.id}
                    value={opt.id}
                    control={<Radio sx={{ "&.Mui-checked": { color: ACCENT } }} />}
                    label={
                      <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{opt.label}</Typography>
                        <Typography sx={{ fontSize: 11, color: "#71727A" }}>{opt.description}</Typography>
                      </Box>
                    }
                    sx={{
                      border: "1px solid",
                      borderColor: answers.budget === opt.id ? ACCENT : "#E0E0E0",
                      borderRadius: 2,
                      mx: 0,
                      mb: 1,
                      px: 1.5,
                      py: 0.5,
                      background: answers.budget === opt.id ? `${ACCENT}08` : "transparent",
                      transition: "all 0.15s",
                    }}
                  />
                ))}
              </RadioGroup>
            </Box>
          </Fade>
        )}

        {/* Step 3: Results */}
        {activeStep === 3 && (
          <Fade in>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 0.5 }}>
                Recommended Engagements
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#71727A", mb: 2 }}>
                Based on your answers, here are the best engagement types for your event.
              </Typography>
              {recommendations.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 4 }}>
                  <Typography sx={{ color: "#71727A", fontSize: 13 }}>
                    No strong matches found. Try adjusting your answers.
                  </Typography>
                  <Button
                    size="small"
                    onClick={handleReset}
                    sx={{ mt: 1, textTransform: "none", fontWeight: 600, color: ACCENT }}
                  >
                    Start Over
                  </Button>
                </Box>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {recommendations.map((rec, idx) => (
                    <Box
                      key={rec.typeId}
                      sx={{
                        border: "1px solid #E0E0E0",
                        borderRadius: 2,
                        p: 2,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        "&:hover": { borderColor: ACCENT, background: `${ACCENT}06` },
                      }}
                      onClick={() => {
                        onSelectType(rec.typeId);
                        handleClose();
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                          {idx + 1}. {rec.name}
                        </Typography>
                        <Chip
                          label={rec.category}
                          size="small"
                          sx={{ fontSize: 10, fontWeight: 600, height: 18, background: "#F5F5F5", color: "#757575" }}
                        />
                      </Box>
                      <Typography sx={{ fontSize: 12, color: "#71727A" }}>
                        {rec.reason}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Fade>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        {activeStep === 3 ? (
          <>
            <Button
              onClick={handleReset}
              sx={{ textTransform: "none", fontWeight: 600, color: "#616161" }}
            >
              Start Over
            </Button>
            <Button
              onClick={handleClose}
              variant="contained"
              sx={{
                textTransform: "none",
                fontWeight: 700,
                background: ACCENT,
                "&:hover": { background: "#D4820F" },
              }}
            >
              Done
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={activeStep === 0 ? handleClose : handleBack}
              sx={{ textTransform: "none", fontWeight: 600, color: "#616161" }}
            >
              {activeStep === 0 ? "Cancel" : "Back"}
            </Button>
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              variant="contained"
              sx={{
                textTransform: "none",
                fontWeight: 700,
                background: ACCENT,
                "&:hover": { background: "#D4820F" },
                "&.Mui-disabled": { background: "#E0E0E0" },
              }}
            >
              {activeStep === 2 ? "See Recommendations" : "Next"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default EngagementWizard;
