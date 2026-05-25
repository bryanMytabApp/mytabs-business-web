import React from "react";
import { MTBInputValidator } from "../components";

export const PasswordStrengthTable = ({validationState}) => {
  return (
    <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px"}}>
      <MTBInputValidator
        textRequirement={"One uppercase letter"}
        isValid={validationState.hasUppercase}
      />
      <MTBInputValidator
        textRequirement={"One special character"}
        isValid={validationState.hasSymbol}
      />
      <MTBInputValidator textRequirement={"One number"} isValid={validationState.hasNumber} />
      <MTBInputValidator
        textRequirement={"11+ characters"}
        isValid={validationState.hasAtLeastNumCharacters}
      />
      <MTBInputValidator
        textRequirement={"One lowercase letter"}
        isValid={validationState.hasLowercase}
      />
    </div>
  );
};
