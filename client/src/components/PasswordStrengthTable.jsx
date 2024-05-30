import React from "react";
import { MTBInputValidator } from "../components";

export const PasswordStrengthTable = ({validationState}) => {
  return (
    <table>
      <tr colspan='2'>
        <td>
          <MTBInputValidator
            textRequirement={"One uppercase letter"}
            isValid={validationState.hasUppercase}
          />
        </td>
        <td>
          <MTBInputValidator
            textRequirement={"One special character"}
            isValid={validationState.hasSymbol}
          />
        </td>
      </tr>
      <tr colspan='2'>
        <td>
          <MTBInputValidator textRequirement={"One number"} isValid={validationState.hasNumber} />
        </td>
        <td>
          <MTBInputValidator
            textRequirement={"11+ characters"}
            isValid={validationState.hasAtLeastNumCharacters}
          />
        </td>
      </tr>
      <tr colspan='2'>
        <td>
          <MTBInputValidator
            textRequirement={"One lowercase letter"}
            isValid={validationState.hasLowercase}
          />
        </td>
      </tr>
    </table>
  );
};
