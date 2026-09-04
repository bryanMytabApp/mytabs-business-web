import React from "react";
import { MTBInputValidator } from "../components";

export const PasswordStrengthTable = ({validationState}) => {
  return (
    <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px"}}>
      <MTBInputValidator
        textRequirement={"At least 1 uppercase letter"}
        isValid={validationState.hasUppercase}
      />
      <MTBInputValidator
        textRequirement={"At least 1 special character"}
        isValid={validationState.hasSymbol}
      />
      <MTBInputValidator textRequirement={"At least 1 number"} isValid={validationState.hasNumber} />
      <MTBInputValidator
        textRequirement={"11+ characters"}
        isValid={validationState.hasAtLeastNumCharacters}
      />
      <MTBInputValidator
        textRequirement={"At least 1 lowercase letter"}
        isValid={validationState.hasLowercase}
      />
    </div>
  );
};
