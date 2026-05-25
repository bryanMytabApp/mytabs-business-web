import React from "react";
import { Box } from "@mui/material";
import { EventQRPanel } from "../../components/QR";

/**
 * EventQRIntegration - Integrates EventQRPanel into the event edit page.
 * Provides event QR code generation and display on the event edit screen.
 *
 * Integration point: Add this component to EventEdit.jsx inside the
 * "General Details" panel, below the existing form fields.
 *
 * Example integration in EventEdit.jsx:
 *   1. Import: import EventQRIntegration from "./EventQRIntegration";
 *   2. Add state: const [businessCode, setBusinessCode] = useState(null);
 *   3. Fetch business code in init():
 *      getBusiness(userId).then(res => {
 *        setBusinessData(res.data);
 *        setBusinessCode(res.data.businessCode);
 *      });
 *   4. Place below the form in the General Details panel:
 *      <EventQRIntegration
 *        eventId={routeProps.eventId}
 *        businessCode={businessCode}
 *        eventCode={item.eventCode}
 *      />
 *
 * Props:
 * - eventId (string): The event's UUID from route params
 * - businessCode (string): The hosting business's Business_Code
 * - eventCode (string, optional): Existing event code if already generated
 *
 * Requirements: 6.7
 */
export function EventQRIntegration({ eventId, businessCode, eventCode }) {
  if (!eventId) return null;

  return (
    <Box sx={{ mt: 3, px: 2 }}>
      <EventQRPanel
        eventId={eventId}
        businessCode={businessCode}
        eventCode={eventCode}
      />
    </Box>
  );
}

export default EventQRIntegration;
