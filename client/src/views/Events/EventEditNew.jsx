import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import moment from "moment";
import { getEvent } from "../../services/eventService";
import { getMyOrganizations, getOrganizationBusinesses } from "../../services/organizationService";
import { getEventPicture } from "../../utils/common";
import EventCreateNew from "./EventCreateNew";

const parseJwt = (token) => {
  if (!token || typeof token !== 'string' || token.split('.').length !== 3) return null;
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
    return JSON.parse(jsonPayload)["custom:user_id"];
  } catch { return null; }
};

const EventEditNew = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [eventData, setEventData] = useState(null);
  const [prefetchedOrg, setPrefetchedOrg] = useState(null);
  const [, setLoading] = useState(true);

  useEffect(() => {
    // Clear previous event data immediately when eventId changes
    setEventData(null);
    setPrefetchedOrg(null);

    const load = async () => {
      const token = localStorage.getItem("idToken");
      const userId = parseJwt(token);
      if (!userId || !eventId) { setLoading(false); return; }

      const savedBizId = sessionStorage.getItem("selectedBusinessId");
      let apiUserId = userId;

      // Run org lookup and event fetch in PARALLEL
      // We optimistically fetch the event with the logged-in userId,
      // and resolve the correct apiUserId from org data simultaneously
      const orgPromise = getMyOrganizations().catch(() => null);
      
      // Start event fetch immediately — most of the time the logged-in user owns it
      let eventPromise = getEvent(userId, eventId).catch(() => null);

      const orgRes = await orgPromise;
      const orgs = orgRes?.data?.organizations || orgRes?.data || [];
      let orgData = null;

      if (orgs.length > 0) {
        const orgId = orgs[0].organizationId || orgs[0].id || orgs[0]._id;
        const bizRes = await getOrganizationBusinesses(orgId).catch(() => null);
        const businesses = bizRes?.data?.businesses || bizRes?.data || [];

        // Store org data to pass down (avoids duplicate fetch in EventCreateNew)
        orgData = { orgs, businesses, orgId };
        setPrefetchedOrg(orgData);

        // Find the selected business or use the first one
        const targetBizId = savedBizId || (businesses.length > 0 ? businesses[0].linkedBusinessId : null);
        const selectedBiz = businesses.find(b => b.linkedBusinessId === targetBizId);

        if (selectedBiz && selectedBiz.userId && selectedBiz.userId !== userId) {
          apiUserId = selectedBiz.userId;
          // Re-fetch event with correct userId (the first fetch may have failed)
          eventPromise = getEvent(apiUserId, eventId).catch(() => null);
        }
      }

      try {
        const res = await eventPromise;
        if (!res?.data) {
          // If optimistic fetch failed and we have a different apiUserId, try once more
          if (apiUserId !== userId) {
            const retry = await getEvent(apiUserId, eventId);
            if (!retry?.data) throw new Error("Event not found");
            var ev = retry.data;
          } else {
            throw new Error("Event not found");
          }
        } else {
          var ev = res.data;
        }

        // Map API event data to the form shape used by EventCreateNew
        const formData = {
          _id: ev._id,
          adType: ev.showDates?.length > 0 ? "shows" : "event",
          name: ev.name || "",
          cat: ev.category || ev.cat || "Athletics",
          date: ev.startDate ? moment(ev.startDate).format("YYYY-MM-DD") : "",
          t1: ev.startDate ? moment(ev.startDate).format("HH:mm") : "",
          t2: ev.endDate ? moment(ev.endDate).format("HH:mm") : "",
          cap: ev.capacity || "",
          desc: ev.description || "",
          venue: ev.venue || "",
          loc: ev.address1 ? "new" : "biz",
          addr: ev.address1 || "",
          city: ev.city || "",
          zip: ev.zipCode || ev.state ? `${ev.state || ""} ${ev.zipCode || ""}`.trim() : "",
          latitude: ev.latitude || null,
          longitude: ev.longitude || null,
          media: getEventPicture(ev._id),
          mediaFile: null,
          tickType: ev.ticketType === "tabs" ? "tabs" : ev.ticketType === "external" ? "ext" : ev.tickets?.some(t => t.option === "Tabs Tickets" || t.option === "Tickets with Tabs") ? "tabs" : ev.tickets?.some(t => t.option === "External link") ? "ext" : "none",
          extUrl: ev.tickets?.find(t => t.option === "External link")?.link1 || "",
          extName: ev.tickets?.find(t => t.option === "External link")?.type || "",
          freeName: ev.tickets?.find(t => t.option === "Free")?.type || "",
          tickets: (ev.tickets || []).filter(t => t.option === "Tabs Tickets" || t.option === "Tickets with Tabs").map(t => ({
            id: t.id || Math.random().toString(36).slice(2, 8),
            type: t.type || "General Admission",
            price: t.price || "",
            qty: t.quantity || "",
            max: String(t.maxPerPurchase || 10),
            desc: t.description || "",
            showDateId: t.showDateId || "all",
            customName: t.customName || "",
          })),
          kpis: (ev.kpis || []).map(k => ({
            id: k.id || Math.random().toString(36).slice(2, 8),
            label: k.label || "",
            type: k.type || "number",
            target: String(k.target || ""),
            cur: String(k.current || k.cur || "0"),
            unit: k.unit || "",
            alert: k.alert || 70,
          })),
          checkpoints: ev.checkpoints || [90, 30, 14, 7],
          channels: ev.channels || null,
          showDates: ev.showDates || [],
          visibility: ev.visibility || "public",
          eventCode: ev.eventCode || "",
          businessId: ev.businessId || "",
        };

        setEventData(formData);
      } catch (err) {
        console.error("Failed to load event:", err);
        toast.error("Failed to load event");
        navigate("/admin/my-events");
      }
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  if (!eventData) return null;

  return <EventCreateNew editMode={true} editData={eventData} eventId={eventId} prefetchedOrg={prefetchedOrg} />;
};

export default EventEditNew;
